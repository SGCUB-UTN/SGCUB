
from datetime import datetime
from decimal import Decimal

from django.db.models import OuterRef, Subquery, Sum
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from configuracion.services import Seccion, record_catalog_update, record_change
from padron.models import Socio
from padron.search import normalize_text

from .models import (
	Beca,
	Comprobante,
	ConceptoItemChoices,
	ConceptoMovimiento,
	ConfiguracionFinanciera,
	CuentaCorriente,
	Cuota,
	Devolucion,
	EjecucionTareaCuota,
	Imputacion,
	ItemPago,
	ItemCuota,
	MovimientoCuenta,
	OrigenEjecucionChoices,
	Pago,
	RegistroAuditoria,
	MedioPago,
)
from .delinquency import ReporteMorosidadInvalidoError, delinquency_report, parse_delinquency_params
from .delinquency_pdf import delinquency_filename, render_delinquency_pdf
from .financial_summary import financial_summary
from .financial_summary_pdf import financial_summary_filename, render_financial_summary_pdf
from .receipts import receipt_filename, refund_filename, render_receipt_pdf, render_refund_pdf
from .serializers import (
	BecaSerializer,
	OtorgarBecaSerializer,
	BeneficioSerializer,
	AnulacionSerializer,
	CUOTA_ITEM_PREFETCHES,
	ConceptoMovimientoSerializer,
	ConfiguracionFinancieraSerializer,
	MedioPagoAceptadoSerializer,
	VersionConfiguracionFinancieraSerializer,
	EdicionDescuentoSerializer,
	ComprobanteListSerializer,
	ComprobanteSerializer,
	CuentaCorrienteSerializer,
	CuotaCreateSerializer,
	CuotaSerializer,
	CuotaUpdateSerializer,
	EjecucionTareaCuotaDetalleSerializer,
	EjecucionTareaCuotaSerializer,
	RegistroPagoSerializer,
	ImputacionSerializer,
	ItemPagoSerializer,
	ItemCuotaSerializer,
	MovimientoCuentaSerializer,
	DevolucionManualSerializer,
	DevolucionSerializer,
	IngresoSerializer,
	NotaCreditoSerializer,
	ReversionPagoSerializer,
	PagoSerializer,
	RegistroAuditoriaSerializer,
	CuentaCorrienteEstadoSerializer,
	ComprobanteDetalleSerializer,
	concept_in_use,
	payment_method_in_use,
)
from .services import (
	BeneficioInvalidoError,
	ComprobanteInvalidoError,
	CuotaConPagosError,
	CuotaDuplicadaError,
	DevolucionInvalidaError,
	PagoInvalidoError,
	SocioInactivoError,
	affected_cuotas,
	assign_benefit,
	cancel_scholarship,
	create_credit_note,
	create_cuota,
	create_manual_refund,
	delete_cuota,
	ensure_cuota_without_payments,
	grant_scholarship,
	parse_period,
	pending_amounts,
	register_income,
	register_payment,
	remove_cuota_item,
	reschedule_cuota,
	revert_configuration_version,
	revert_payment,
	update_discount,
	update_scholarship,
)
from .period_summary import period_cuota_rows, period_summary, requested_period
from .tasks import run_cuota_generation, run_manual_surcharges


def _cuota_con_pagos(error):
	return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)


def _cuotas_queryset():
	return Cuota.objects.select_related(
		"movimiento__cuenta_corriente__socio__persona",
		"movimiento__cuenta_corriente__socio__jugador",
	).prefetch_related(*CUOTA_ITEM_PREFETCHES)


@extend_schema(tags=["Finanzas/Cuota"], request=CuotaCreateSerializer, responses=CuotaSerializer)
@api_view(["GET", "POST"])
def cuota_list_create(request):
	if request.method == "GET":
		cuotas = list(_cuotas_queryset().order_by("pk"))
		return Response(CuotaSerializer(cuotas, many=True, context={"pending": pending_amounts(cuotas)}).data)

	serializer = CuotaCreateSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	socio = get_object_or_404(
		Socio.objects.select_related("estado_administrativo", "jugador__estado"),
		pk=data["socio_id"],
	)
	try:
		cuota = create_cuota(socio, data["periodo"], data.get("fecha_venc1"), data.get("fecha_venc2"), user=_current_user(request))
	except (CuotaDuplicadaError, SocioInactivoError) as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response(CuotaSerializer(_cuotas_queryset().get(pk=cuota.pk)).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Finanzas/Cuota"])
@api_view(["POST"])
def generar_cuotas_mensuales_manual(request):
	result = run_cuota_generation(origin=OrigenEjecucionChoices.MANUAL, user=request.user)
	return Response(result, status=status.HTTP_200_OK)


@extend_schema(tags=["Finanzas/Cuota"])
@api_view(["POST"])
def aplicar_recargos_manual(request):
	return Response(run_manual_surcharges(user=request.user), status=status.HTTP_200_OK)


@extend_schema(tags=["Finanzas/Cuota"], request=CuotaUpdateSerializer, responses=CuotaSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def cuota_detail(request, pk):
	cuota = get_object_or_404(_cuotas_queryset(), pk=pk)
	if request.method == "GET":
		return Response(CuotaSerializer(cuota).data)

	try:
		if request.method == "DELETE":
			delete_cuota(cuota, _current_user(request))
			return Response(status=status.HTTP_204_NO_CONTENT)
		ensure_cuota_without_payments(cuota)
	except CuotaConPagosError as error:
		return _cuota_con_pagos(error)

	serializer = CuotaUpdateSerializer(cuota, data=request.data, partial=request.method == "PATCH")
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
	try:
		reschedule_cuota(
			pk,
			serializer.validated_data.get("fecha_venc1", cuota.fecha_venc1),
			serializer.validated_data.get("fecha_venc2", cuota.fecha_venc2),
			user=_current_user(request),
		)
	except CuotaConPagosError as error:
		return _cuota_con_pagos(error)
	return Response(CuotaSerializer(_cuotas_queryset().get(pk=pk)).data)


@extend_schema(tags=["Finanzas/ItemCuota"], responses=ItemCuotaSerializer)
@api_view(["GET"])
def cuota_item_list(request):
	return Response(ItemCuotaSerializer(ItemCuota.objects.order_by("pk"), many=True).data)


@extend_schema(tags=["Finanzas/ItemCuota"], responses=ItemCuotaSerializer)
@api_view(["GET"])
def cuota_item_detail(request, pk):
	return Response(ItemCuotaSerializer(get_object_or_404(ItemCuota, pk=pk)).data)


def _current_user(request):
	return request.user if request.user.is_authenticated else None


@extend_schema(tags=["Finanzas/ItemCuota"], request=EdicionDescuentoSerializer, responses=ItemCuotaSerializer)
@api_view(["PUT"])
def cuota_item_discount(request, pk):
	get_object_or_404(ItemCuota, pk=pk, concepto=ConceptoItemChoices.DESCUENTO_UNICO)
	serializer = EdicionDescuentoSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	try:
		item = update_discount(pk, data["modalidad"], data["valor"], data["motivo"], data["autorizado_por"], _current_user(request))
	except (BeneficioInvalidoError, CuotaConPagosError) as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response(ItemCuotaSerializer(item).data)


@extend_schema(tags=["Finanzas/ItemCuota"], request=AnulacionSerializer, responses=ItemCuotaSerializer)
@api_view(["POST"])
def cuota_item_annul(request, pk):
	get_object_or_404(ItemCuota, pk=pk)
	serializer = AnulacionSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	try:
		item = remove_cuota_item(pk, data["motivo"], data["autorizado_por"], _current_user(request))
	except (BeneficioInvalidoError, CuotaConPagosError) as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response(ItemCuotaSerializer(ItemCuota.all_objects.get(pk=item.pk)).data)


@extend_schema(tags=["Finanzas/Pago"], responses=PagoSerializer)
@api_view(["GET"])
def pago_list(request):
	return Response(PagoSerializer(Pago.objects.order_by("pk"), many=True).data)


@extend_schema(tags=["Finanzas/Pago"], responses=PagoSerializer)
@api_view(["GET"])
def pago_detail(request, pk):
	pago = get_object_or_404(Pago, pk=pk)
	return Response(PagoSerializer(pago).data)


@extend_schema(tags=["Finanzas/Pago"], request=ReversionPagoSerializer, responses=ComprobanteDetalleSerializer)
@api_view(["POST"])
def revertir_pago(request, pk):
	"""Annuls a payment of cuotas (only the latest of the socio) or an income. The debt goes back to
	what it was, surcharges included, and the receipt is annulled."""
	get_object_or_404(Pago, pk=pk)
	serializer = ReversionPagoSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	try:
		_, comprobante = revert_payment(pk, data["motivo"], data["responsable"], _current_user(request))
	except PagoInvalidoError as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response(ComprobanteDetalleSerializer(comprobante).data)


@extend_schema(tags=["Finanzas/Pago"], request=RegistroPagoSerializer, responses=ComprobanteSerializer)
@api_view(["POST"])
def registrar_pago(request):
	serializer = RegistroPagoSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	try:
		pago, comprobante = register_payment(
			data["socio_id"],
			data["cuota_ids"],
			data["medios"],
			data["monto_total"],
			data["observacion"],
			request.user if request.user.is_authenticated else None,
			data["condonacion_mora"],
			data["nota_credito"],
		)
	except CuentaCorriente.DoesNotExist:
		return Response({"detail": "El socio no tiene cuenta corriente."}, status=status.HTTP_404_NOT_FOUND)
	except Comprobante.DoesNotExist:
		return Response({"detail": "El comprobante anulado no existe."}, status=status.HTTP_404_NOT_FOUND)
	except (PagoInvalidoError, ComprobanteInvalidoError, DevolucionInvalidaError) as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

	return Response({
		"pago": PagoSerializer(pago).data,
		"comprobante": ComprobanteSerializer(comprobante).data,
	}, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Finanzas/Ingreso"], request=IngresoSerializer, responses=ComprobanteDetalleSerializer)
@api_view(["POST"])
def registrar_ingreso(request):
	serializer = IngresoSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	try:
		_, comprobante = register_income(
			data["socio_id"], data["concepto"], data["medios"], data["monto_total"], _current_user(request),
		)
	except CuentaCorriente.DoesNotExist:
		return Response({"detail": "El socio no tiene cuenta corriente."}, status=status.HTTP_404_NOT_FOUND)
	except ComprobanteInvalidoError as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response(ComprobanteDetalleSerializer(comprobante).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Finanzas/ItemPago"], responses=ItemPagoSerializer)
@api_view(["GET"])
def item_pago_list(request):
	return Response(ItemPagoSerializer(ItemPago.objects.order_by("pk"), many=True).data)


@extend_schema(tags=["Finanzas/ItemPago"], responses=ItemPagoSerializer)
@api_view(["GET"])
def item_pago_detail(request, pk):
	return Response(ItemPagoSerializer(get_object_or_404(ItemPago, pk=pk)).data)


@extend_schema(tags=["Finanzas/Comprobante"], responses=ComprobanteListSerializer)
@api_view(["GET"])
def comprobante_list(request):
	refunded = (
		Devolucion.objects.filter(comprobante_anulado=OuterRef("pk"))
		.values("comprobante_anulado")
		.annotate(total=Sum("monto"))
		.values("total")
	)
	comprobantes = Comprobante.objects.select_related(
		"pago__movimiento__cuenta_corriente__socio__persona",
	).annotate(monto_devuelto=Coalesce(Subquery(refunded), Decimal("0.00"))).order_by("pk")
	socio_id = request.query_params.get("socio_id")
	if socio_id:
		if not socio_id.isdigit():
			return Response({"detail": "El socio indicado no es válido."}, status=status.HTTP_400_BAD_REQUEST)
		comprobantes = comprobantes.filter(pago__movimiento__cuenta_corriente__socio_id=int(socio_id))
	cuota_id = request.query_params.get("cuota_id")
	if cuota_id:
		if not cuota_id.isdigit():
			return Response({"detail": "La cuota indicada no es válida."}, status=status.HTTP_400_BAD_REQUEST)
		comprobantes = comprobantes.filter(
			pago__movimiento__imputaciones_origen__movimiento_destino__cuota_id=int(cuota_id),
		).distinct()
	return Response(ComprobanteListSerializer(comprobantes, many=True).data)


@extend_schema(tags=["Finanzas/Comprobante"], responses=ComprobanteDetalleSerializer)
@api_view(["GET"])
def comprobante_detail(request, pk):
	comprobante = get_object_or_404(
		Comprobante.objects.select_related(
			"pago__movimiento__cuenta_corriente__socio__persona",
			"pago__usuario_anulacion",
		).prefetch_related("pago__items_pago"),
		pk=pk,
	)
	return Response(ComprobanteDetalleSerializer(comprobante).data)


@extend_schema(tags=["Finanzas/Comprobante"], responses={(200, "application/pdf"): bytes})
@api_view(["GET"])
def comprobante_pdf(request, pk):
	comprobante = get_object_or_404(
		Comprobante.objects.select_related("pago__movimiento__cuenta_corriente__socio__persona"),
		pk=pk,
	)
	response = HttpResponse(render_receipt_pdf(comprobante), content_type="application/pdf")
	response["Content-Disposition"] = f'attachment; filename="{receipt_filename(comprobante)}"'
	return response


@extend_schema(tags=["Finanzas/Devolucion"], request=NotaCreditoSerializer, responses=DevolucionSerializer)
@api_view(["POST"])
def emitir_nota_credito(request, pk):
	"""Refunds money of an annulled receipt, up to what is left to give back of it."""
	get_object_or_404(Comprobante, pk=pk)
	serializer = NotaCreditoSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	try:
		nota = create_credit_note(
			pk, data["monto"], data["medio_de_pago"], data["motivo"], data["responsable"], _current_user(request),
		)
	except DevolucionInvalidaError as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response(DevolucionSerializer(nota).data, status=status.HTTP_201_CREATED)


def _refunds_queryset():
	return Devolucion.objects.select_related(
		"cuenta_corriente__socio__persona", "comprobante_anulado", "usuario",
	)


@extend_schema(tags=["Finanzas/Devolucion"], request=DevolucionManualSerializer, responses=DevolucionSerializer)
@api_view(["GET", "POST"])
def devolucion_list_create(request):
	if request.method == "GET":
		refunds = _refunds_queryset()
		socio_id = request.query_params.get("socio_id")
		if socio_id:
			if not socio_id.isdigit():
				return Response({"detail": "El socio indicado no es válido."}, status=status.HTTP_400_BAD_REQUEST)
			refunds = refunds.filter(cuenta_corriente__socio_id=int(socio_id))
		if request.query_params.get("tipo"):
			refunds = refunds.filter(tipo=request.query_params["tipo"])
		return Response(DevolucionSerializer(refunds, many=True).data)

	serializer = DevolucionManualSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
	data = serializer.validated_data
	try:
		refund = create_manual_refund(
			data["socio_id"], data["concepto"], data["monto"], data["medio_de_pago"], data["responsable"],
			_current_user(request),
		)
	except CuentaCorriente.DoesNotExist:
		return Response({"detail": "El socio no tiene cuenta corriente."}, status=status.HTTP_404_NOT_FOUND)
	return Response(DevolucionSerializer(refund).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Finanzas/Devolucion"], responses=DevolucionSerializer)
@api_view(["GET"])
def devolucion_detail(request, pk):
	return Response(DevolucionSerializer(get_object_or_404(_refunds_queryset(), pk=pk)).data)


@extend_schema(tags=["Finanzas/Devolucion"], responses={(200, "application/pdf"): bytes})
@api_view(["GET"])
def devolucion_pdf(request, pk):
	refund = get_object_or_404(_refunds_queryset(), pk=pk)
	response = HttpResponse(render_refund_pdf(refund), content_type="application/pdf")
	response["Content-Disposition"] = f'attachment; filename="{refund_filename(refund)}"'
	return response


@extend_schema(tags=["Finanzas/CuentaCorriente"], responses=CuentaCorrienteSerializer)
@api_view(["GET"])
def current_account_list(request):
	accounts = CuentaCorriente.objects.select_related("socio").order_by("pk")
	return Response(CuentaCorrienteSerializer(accounts, many=True).data)


@extend_schema(tags=["Finanzas/CuentaCorriente"], responses=CuentaCorrienteSerializer)
@api_view(["GET"])
def current_account_detail(request, pk):
	account = get_object_or_404(CuentaCorriente.objects.select_related("socio"), pk=pk)
	return Response(CuentaCorrienteSerializer(account).data)


@extend_schema(tags=["Finanzas/EstadoCuenta"], responses=CuentaCorrienteEstadoSerializer)
@api_view(["GET"])
def estado_cuenta_socio(request, socio_id):
	cuenta = get_object_or_404(
		CuentaCorriente.objects.select_related("socio__persona"),
		socio_id=socio_id,
	)
	return Response(CuentaCorrienteEstadoSerializer(cuenta).data)


@extend_schema(tags=["Finanzas/Resumen"])
@api_view(["GET"])
def resumen_financiero(request):
	"""Monthly summary for `periodo` (current month by default) plus the current debt overview."""
	period, error = _period_or_error(request)
	if error:
		return error
	return Response(financial_summary(period))


@extend_schema(tags=["Finanzas/Morosidad"])
@api_view(["GET"])
def reporte_morosidad(request):
	try:
		params = parse_delinquency_params(request.query_params)
	except ReporteMorosidadInvalidoError as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

	report = delinquency_report(**params)
	report["fecha"] = report["fecha"].strftime("%d/%m/%Y %H:%M")
	return Response(report)


@extend_schema(tags=["Finanzas/Morosidad"], responses={(200, "application/pdf"): bytes})
@api_view(["GET"])
def delinquency_report_pdf(request):
	try:
		params = parse_delinquency_params(request.query_params)
	except ReporteMorosidadInvalidoError as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

	report = delinquency_report(**params)
	response = HttpResponse(render_delinquency_pdf(report), content_type="application/pdf")
	response["Content-Disposition"] = f'attachment; filename="{delinquency_filename(report)}"'
	return response


@extend_schema(tags=["Finanzas/MovimientoCuenta"], responses=MovimientoCuentaSerializer)
@api_view(["GET"])
def movimiento_cuenta_list(request):
	movements = MovimientoCuenta.objects.select_related(
		"cuenta_corriente__socio__persona",
		"cuota",
		"pago__comprobante",
	).order_by("pk")
	socio_id = request.query_params.get("socio_id")
	if socio_id:
		if not socio_id.isdigit():
			return Response({"detail": "El socio indicado no es válido."}, status=status.HTTP_400_BAD_REQUEST)
		movements = movements.filter(cuenta_corriente__socio_id=int(socio_id))
	if request.query_params.get("tipo"):
		movements = movements.filter(tipo_movimiento=request.query_params["tipo"])
	return Response(MovimientoCuentaSerializer(movements, many=True).data)


PROTECTED_CONCEPTS = ("Otro ingreso", "Otra devolución")


def _find_matching_concept(name, origin):
	normalized = normalize_text(name)
	for concept in ConceptoMovimiento.objects.filter(origen=origin):
		if normalize_text(concept.nombre) == normalized:
			return concept
	return None


@extend_schema(tags=["Finanzas/MovimientoCuenta"], request=ConceptoMovimientoSerializer, responses=ConceptoMovimientoSerializer)
@api_view(["GET", "POST"])
def concepto_movimiento_list_create(request):
	if request.method == "GET":
		concepts = ConceptoMovimiento.objects.all()
		origin = request.query_params.get("origen")
		if origin:
			concepts = concepts.filter(origen=origin)
		return Response(ConceptoMovimientoSerializer(concepts, many=True).data)

	serializer = ConceptoMovimientoSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
	data = serializer.validated_data
	existing = _find_matching_concept(data["nombre"], data["origen"])
	if existing:
		return Response(ConceptoMovimientoSerializer(existing).data, status=status.HTTP_200_OK)

	concept = ConceptoMovimiento.objects.create(nombre=data["nombre"], origen=data["origen"])
	record_change(Seccion.FINANZAS, f"Concepto de movimiento {concept.nombre}", "", "Alta", request_user(request))
	return Response(ConceptoMovimientoSerializer(concept).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Finanzas/MovimientoCuenta"], responses={204: None})
@api_view(["DELETE"])
def concepto_movimiento_detail(request, pk):
	concept = get_object_or_404(ConceptoMovimiento, pk=pk)
	if concept.nombre in PROTECTED_CONCEPTS:
		return Response(
			{"detail": "Este concepto es del sistema y no puede eliminarse."},
			status=status.HTTP_400_BAD_REQUEST,
		)
	if concept_in_use(concept):
		return Response(
			{"detail": "El concepto ya fue utilizado en ingresos o devoluciones y no puede eliminarse."},
			status=status.HTTP_400_BAD_REQUEST,
		)
	concept.delete()
	record_change(Seccion.FINANZAS, f"Concepto de movimiento {concept.nombre}", "Existente", "Eliminado", request_user(request))
	return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Finanzas/MovimientoCuenta"], responses=MovimientoCuentaSerializer)
@api_view(["GET"])
def movimiento_cuenta_detail(request, pk):
	return Response(MovimientoCuentaSerializer(get_object_or_404(MovimientoCuenta, pk=pk)).data)


@extend_schema(tags=["Finanzas/Auditoria"], responses=RegistroAuditoriaSerializer(many=True))
@api_view(["GET"])
def registro_auditoria_list(request):
	"""Financial audit trail, newest first. Filters: socio_id, accion, desde and hasta (YYYY-MM-DD)."""
	entries = RegistroAuditoria.objects.select_related("usuario", "socio__persona")
	socio_id = request.query_params.get("socio_id")
	if socio_id:
		if not socio_id.isdigit():
			return Response({"detail": "El socio indicado no es válido."}, status=status.HTTP_400_BAD_REQUEST)
		entries = entries.filter(socio_id=int(socio_id))
	if request.query_params.get("accion"):
		entries = entries.filter(accion=request.query_params["accion"])
	for param, lookup in (("desde", "fecha__date__gte"), ("hasta", "fecha__date__lte")):
		value = request.query_params.get(param)
		if value:
			try:
				entries = entries.filter(**{lookup: datetime.strptime(value, "%Y-%m-%d").date()})
			except ValueError:
				return Response({"detail": "Las fechas deben tener el formato AAAA-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
	return Response(RegistroAuditoriaSerializer(entries, many=True).data)


@extend_schema(tags=["Finanzas/Imputacion"], responses=ImputacionSerializer)
@api_view(["GET"])
def imputacion_list(request):
	return Response(ImputacionSerializer(Imputacion.objects.order_by("pk"), many=True).data)


@extend_schema(tags=["Finanzas/Imputacion"], responses=ImputacionSerializer)
@api_view(["GET"])
def imputacion_detail(request, pk):
	return Response(ImputacionSerializer(get_object_or_404(Imputacion, pk=pk)).data)


@extend_schema(tags=["Finanzas/Configuracion"], responses=ConfiguracionFinancieraSerializer)
@api_view(["GET"])
def configuracion_financiera(request):
	"""Version in force for `periodo` (current period by default). New versions are created from
	POST /api/configuracion/guardar/, together with the rest of the configuration and its responsable."""
	configuracion = ConfiguracionFinanciera.load(request.query_params.get("periodo"))
	return Response(ConfiguracionFinancieraSerializer(configuracion).data)


@extend_schema(tags=["Finanzas/Configuracion"])
@api_view(["GET"])
def configuracion_financiera_impacto(request):
	"""How many cuotas a new version from `periodo` would update, to warn before saving it."""
	try:
		periodo = parse_period(request.query_params.get("periodo", "")).strftime("%Y-%m")
	except ValueError as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response({"periodo": periodo, "cuotas_afectadas": affected_cuotas(periodo).count()})


@extend_schema(tags=["Finanzas/Configuracion"], responses=VersionConfiguracionFinancieraSerializer(many=True))
@api_view(["GET"])
def configuracion_financiera_versiones(request):
	versiones = ConfiguracionFinanciera.objects.select_related("usuario_creacion").order_by("-fecha_creacion", "-pk")
	return Response(VersionConfiguracionFinancieraSerializer(versiones, many=True).data)


@extend_schema(tags=["Finanzas/Configuracion"], responses=VersionConfiguracionFinancieraSerializer)
@api_view(["POST"])
def configuracion_financiera_revertir(request, pk):
	version = get_object_or_404(ConfiguracionFinanciera, pk=pk)
	current_period = timezone.localdate().strftime("%Y-%m")
	if version.periodo_vigencia <= current_period:
		return Response(
			{"detail": "Solo se pueden revertir cambios programados para períodos futuros."},
			status=status.HTTP_400_BAD_REQUEST,
		)
	latest = ConfiguracionFinanciera.load(version.periodo_vigencia)
	if latest.pk != version.pk:
		return Response(
			{"detail": "Solo se puede revertir la última versión vigente para ese período."},
			status=status.HTTP_400_BAD_REQUEST,
		)
	responsable = str(request.data.get("responsable") or "").strip()
	try:
		reverted = revert_configuration_version(version, user=request_user(request), responsable=responsable)
	except ValueError as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response(VersionConfiguracionFinancieraSerializer(reverted).data)


PAYMENT_METHOD_FIELDS = {"nombre": "Nombre", "activo": "Habilitado"}


def request_user(request):
	return request.user if request.user.is_authenticated else None


@extend_schema(tags=["Finanzas/MedioPago"], request=MedioPagoAceptadoSerializer, responses=MedioPagoAceptadoSerializer)
@api_view(["GET", "POST"])
def medio_pago_list_create(request):
	if request.method == "GET":
		medios = MedioPago.objects.all()
		if request.query_params.get("activos") in ("1", "true"):
			medios = medios.filter(activo=True)
		return Response(MedioPagoAceptadoSerializer(medios, many=True).data)

	serializer = MedioPagoAceptadoSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
	medio = serializer.save()
	record_change(Seccion.FINANZAS, f"Medio de pago {medio.nombre}", "", "Alta", request_user(request))
	return Response(MedioPagoAceptadoSerializer(medio).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Finanzas/MedioPago"], request=MedioPagoAceptadoSerializer, responses=MedioPagoAceptadoSerializer)
@api_view(["PATCH", "DELETE"])
def medio_pago_detail(request, pk):
	medio = get_object_or_404(MedioPago, pk=pk)
	if request.method == "DELETE":
		if payment_method_in_use(medio.codigo):
			return Response(
				{"detail": "El medio de pago ya se usó en pagos o devoluciones: deshabilitalo en lugar de eliminarlo."},
				status=status.HTTP_400_BAD_REQUEST,
			)
		if medio.activo and not MedioPago.objects.filter(activo=True).exclude(pk=medio.pk).exists():
			return Response({"detail": "Tiene que quedar al menos un medio de pago habilitado."}, status=status.HTTP_400_BAD_REQUEST)
		medio.delete()
		record_change(Seccion.FINANZAS, f"Medio de pago {medio.nombre}", "Existente", "Eliminado", request_user(request))
		return Response(status=status.HTTP_204_NO_CONTENT)

	before = {"nombre": medio.nombre, "activo": medio.activo}
	serializer = MedioPagoAceptadoSerializer(medio, data=request.data, partial=True)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
	medio = serializer.save()
	record_catalog_update(
		Seccion.FINANZAS,
		f"Medio de pago {before['nombre']}",
		before,
		{"nombre": medio.nombre, "activo": medio.activo},
		PAYMENT_METHOD_FIELDS,
		request_user(request),
	)
	return Response(MedioPagoAceptadoSerializer(medio).data)


@extend_schema(tags=["Finanzas/Beca"], request=BeneficioSerializer)
@api_view(["POST"])
def cuota_beneficio(request, pk):
	cuota = get_object_or_404(Cuota.objects.filter(movimiento__isnull=False), pk=pk)
	serializer = BeneficioSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	try:
		beca, item = assign_benefit(
			cuota.pk,
			data["tipo"],
			data["modalidad"],
			data["valor"],
			data["fecha_aplicacion"],
			data["motivo"],
			data["fecha_fin"],
			request.user if request.user.is_authenticated else None,
			data["autorizado_por"],
		)
	except (BeneficioInvalidoError, CuotaConPagosError) as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

	return Response({
		"beca": BecaSerializer(beca).data if beca else None,
		"item": ItemCuotaSerializer(item).data if item else None,
		"aplicado_a_cuota": item is not None,
	}, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Finanzas/Beca"], request=OtorgarBecaSerializer)
@api_view(["POST"])
def socio_beca(request, socio_id):
	serializer = OtorgarBecaSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	try:
		beca, items = grant_scholarship(
			socio_id,
			data["modalidad"],
			data["valor"],
			data["fecha_aplicacion"],
			data["motivo"],
			data["autorizado_por"],
			data["fecha_fin"],
			request.user if request.user.is_authenticated else None,
		)
	except CuentaCorriente.DoesNotExist:
		return Response({"detail": "El socio no tiene cuenta corriente."}, status=status.HTTP_404_NOT_FOUND)
	except BeneficioInvalidoError as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

	return Response({
		"beca": BecaSerializer(beca).data,
		"items": ItemCuotaSerializer(items, many=True).data,
	}, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Finanzas/Beca"], responses=BecaSerializer)
@api_view(["GET"])
def beca_list(request):
	becas = Beca.objects.prefetch_related("exclusiones").order_by("-fecha_aplicacion", "-pk")
	socio_id = request.query_params.get("socio_id")
	if socio_id:
		if not socio_id.isdigit():
			return Response({"detail": "El socio indicado no es válido."}, status=status.HTTP_400_BAD_REQUEST)
		becas = becas.filter(socio_id=int(socio_id))
	return Response(BecaSerializer(becas, many=True).data)


@extend_schema(tags=["Finanzas/Beca"], request=OtorgarBecaSerializer, responses=BecaSerializer)
@api_view(["PUT"])
def beca_detail(request, pk):
	get_object_or_404(Beca, pk=pk)
	serializer = OtorgarBecaSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	try:
		beca = update_scholarship(
			pk,
			data["modalidad"],
			data["valor"],
			data["fecha_aplicacion"],
			data["fecha_fin"],
			data["motivo"],
			data["autorizado_por"],
			_current_user(request),
		)
	except BeneficioInvalidoError as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response(BecaSerializer(beca).data)


@extend_schema(tags=["Finanzas/Beca"], request=AnulacionSerializer, responses=BecaSerializer)
@api_view(["POST"])
def beca_cancel(request, pk):
	get_object_or_404(Beca, pk=pk)
	serializer = AnulacionSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	try:
		beca = cancel_scholarship(pk, data["motivo"], data["autorizado_por"], _current_user(request))
	except BeneficioInvalidoError as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response(BecaSerializer(beca).data)

@extend_schema(tags=["Finanzas/Resumen"], responses={(200, "application/pdf"): bytes})
@api_view(["GET"])
def resumen_financiero_pdf(request):
	period, error = _period_or_error(request)
	if error:
		return error
	response = HttpResponse(render_financial_summary_pdf(financial_summary(period)), content_type="application/pdf")
	response["Content-Disposition"] = f'attachment; filename="{financial_summary_filename(period)}"'
	return response


def _period_or_error(request):
	try:
		return requested_period(request.query_params.get("periodo", "").strip()), None
	except ValueError as error:
		return None, Response({"periodo": [str(error)]}, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["Finanzas/Cuota"], summary="Fases e indicadores de las cuotas de un período")
@api_view(["GET"])
def cuota_periodo_resumen(request):
	period, error = _period_or_error(request)
	if error:
		return error
	return Response(period_summary(period))


@extend_schema(tags=["Finanzas/Cuota"], summary="Cuotas de un período")
@api_view(["GET"])
def cuota_periodo_cuotas(request):
	period, error = _period_or_error(request)
	if error:
		return error
	return Response({"period": period, "results": period_cuota_rows(period)})


@extend_schema(tags=["Finanzas/Cuota"], responses=EjecucionTareaCuotaSerializer(many=True), summary="Ejecuciones de las tareas de cuotas de un período")
@api_view(["GET"])
def cuota_ejecucion_list(request):
	period, error = _period_or_error(request)
	if error:
		return error
	runs = EjecucionTareaCuota.objects.filter(periodo=period).select_related("usuario")
	return Response(EjecucionTareaCuotaSerializer(runs, many=True).data)


@extend_schema(tags=["Finanzas/Cuota"], responses=EjecucionTareaCuotaDetalleSerializer, summary="Registro de una ejecución de tarea de cuotas")
@api_view(["GET"])
def cuota_ejecucion_detail(request, pk):
	run = get_object_or_404(EjecucionTareaCuota.objects.select_related("usuario"), pk=pk)
	return Response(EjecucionTareaCuotaDetalleSerializer(run).data)
