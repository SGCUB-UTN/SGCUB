
from datetime import datetime
from decimal import Decimal

from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from configuracion.services import Seccion, record_catalog_update, record_change
from padron.models import Socio

from .models import (
	Beca,
	Comprobante,
	ConceptoItemChoices,
	ConceptoMovimiento,
	ConfiguracionFinanciera,
	CuentaCorriente,
	Cuota,
	Imputacion,
	ItemPago,
	ItemCuota,
	MovimientoCuenta,
	Pago,
	EstadoCuotaChoices,
	EstadoPagoChoices,
	MedioDePagoChoices,
	MedioPago,
	TipoMovimientoChoices,
)
from .delinquency import ReporteMorosidadInvalidoError, delinquency_report, parse_delinquency_params
from .delinquency_pdf import delinquency_filename, render_delinquency_pdf
from .financial_summary_pdf import financial_summary_filename, render_financial_summary_pdf
from .receipts import (
	manual_movement_filename,
	receipt_filename,
	render_manual_movement_pdf,
	render_receipt_pdf,
)
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
	CorreccionPagoSerializer,
	EdicionDescuentoSerializer,
	ComprobanteListSerializer,
	ComprobanteSerializer,
	CuentaCorrienteSerializer,
	CuotaCreateSerializer,
	CuotaSerializer,
	CuotaUpdateSerializer,
	RegistroPagoSerializer,
	ImputacionSerializer,
	ItemPagoSerializer,
	ItemCuotaSerializer,
	MovimientoCuentaSerializer,
	MovimientoManualSerializer,
	PagoSerializer,
	CuentaCorrienteEstadoSerializer,
	ComprobanteDetalleSerializer,
)
from .services import (
	BeneficioInvalidoError,
	ComprobanteInvalidoError,
	CuotaConPagosError,
	CuotaDuplicadaError,
	PagoInvalidoError,
	SocioInactivoError,
	affected_cuotas,
	apply_surcharges,
	assign_benefit,
	cancel_scholarship,
	correct_payment,
	create_cuota,
	delete_cuota,
	ensure_cuota_without_payments,
	generar_cuotas_mensuales,
	grant_scholarship,
	parse_period,
	pending_amounts,
	register_payment,
	create_manual_movement,
	remove_cuota_item,
	reschedule_cuota,
	revert_configuration_version,
	update_discount,
	update_scholarship,
)


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
		cuota = create_cuota(socio, data["periodo"], data.get("fecha_venc1"), data.get("fecha_venc2"))
	except (CuotaDuplicadaError, SocioInactivoError) as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response(CuotaSerializer(_cuotas_queryset().get(pk=cuota.pk)).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Finanzas/Cuota"])
@api_view(["POST"])
def generar_cuotas_mensuales_manual(request):
	return Response(generar_cuotas_mensuales(), status=status.HTTP_200_OK)


@extend_schema(tags=["Finanzas/Cuota"])
@api_view(["POST"])
def aplicar_recargos_manual(request):
	return Response(apply_surcharges(), status=status.HTTP_200_OK)


@extend_schema(tags=["Finanzas/Cuota"], request=CuotaUpdateSerializer, responses=CuotaSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def cuota_detail(request, pk):
	cuota = get_object_or_404(_cuotas_queryset(), pk=pk)
	if request.method == "GET":
		return Response(CuotaSerializer(cuota).data)

	try:
		if request.method == "DELETE":
			delete_cuota(cuota)
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


@extend_schema(tags=["Finanzas/Pago"], request=CorreccionPagoSerializer)
@api_view(["POST"])
def corregir_pago(request, pk):
	serializer = CorreccionPagoSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	data = serializer.validated_data
	try:
		pago_original, comprobante_original, pago, comprobante = correct_payment(
			pk,
			data["cuota_ids"],
			data["medios"],
			data["monto_total"],
			data["motivo"],
			request.user if request.user.is_authenticated else None,
		)
	except Pago.DoesNotExist:
		return Response({"detail": "El pago no existe."}, status=status.HTTP_404_NOT_FOUND)
	except (PagoInvalidoError, ComprobanteInvalidoError) as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

	return Response({
		"pago_original": PagoSerializer(pago_original).data,
		"pago": PagoSerializer(pago).data,
		"comprobante_original": ComprobanteSerializer(comprobante_original).data,
		"comprobante": ComprobanteSerializer(comprobante).data,
		"motivo": data["motivo"],
		"usuario": request.user.get_username() if request.user.is_authenticated else None,
		"fecha": timezone.localtime().isoformat(),
	}, status=status.HTTP_201_CREATED)


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
		)
	except CuentaCorriente.DoesNotExist:
		return Response({"detail": "El socio no tiene cuenta corriente."}, status=status.HTTP_404_NOT_FOUND)
	except (PagoInvalidoError, ComprobanteInvalidoError) as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

	return Response({
		"pago": PagoSerializer(pago).data,
		"comprobante": ComprobanteSerializer(comprobante).data,
	}, status=status.HTTP_201_CREATED)


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
	comprobantes = Comprobante.objects.select_related(
		"pago__movimiento__cuenta_corriente__socio__persona",
	).order_by("pk")
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
			"reemplazado_por",
			"reemplaza_a",
		).prefetch_related("pago__items_pago"),
		pk=pk,
	)
	return Response(ComprobanteDetalleSerializer(comprobante).data)


@extend_schema(tags=["Finanzas/Comprobante"], responses={(200, "application/pdf"): bytes})
@api_view(["GET"])
def comprobante_pdf(request, pk):
	comprobante = get_object_or_404(
		Comprobante.objects.select_related(
			"pago__movimiento__cuenta_corriente__socio__persona",
			"reemplazado_por",
		),
		pk=pk,
	)
	response = HttpResponse(render_receipt_pdf(comprobante), content_type="application/pdf")
	response["Content-Disposition"] = f'attachment; filename="{receipt_filename(comprobante)}"'
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


def _totales_por_medio_de_pago():
	totales = {
		item["medio_de_pago"]: item["total"]
		for item in ItemPago.objects.filter(
			pago__estado_pago=EstadoPagoChoices.ACREDITADO,
		).values("medio_de_pago").annotate(total=Sum("monto"))
	}
	movimientos_manuales = (
		MovimientoCuenta.objects.filter(origen_manual__isnull=False)
		.select_related("movimiento_revertido")
	)
	for mov in movimientos_manuales:
		medio = mov.medio_de_pago or (
			mov.movimiento_revertido.medio_de_pago if mov.movimiento_revertido else None
		)
		if not medio:
			continue
		actual = totales.get(medio, Decimal("0.00"))
		if mov.tipo_movimiento == TipoMovimientoChoices.ABONO:
			totales[medio] = actual + mov.monto
		else:
			totales[medio] = actual - mov.monto
	return totales


@extend_schema(tags=["Finanzas/Resumen"])
@api_view(["GET"])
def resumen_financiero(request):
	reporte = delinquency_report("activos")
	pagos_por_medio = _totales_por_medio_de_pago()
	filas_morosas = reporte["filas"]

	return Response({
		"socios_en_mora": len(filas_morosas),
		"monto_adeudado_total": sum(
			(fila["monto_adeudado"] for fila in filas_morosas),
			Decimal("0.00"),
		),
		"cuotas_vencidas": sum(fila["cuotas_vencidas"] for fila in filas_morosas),
		"cuotas_vencidas_1": sum(fila["cuotas_vencidas_1"] for fila in filas_morosas),
		"cuotas_vencidas_2": sum(fila["cuotas_vencidas_2"] for fila in filas_morosas),
		"transferencia_bancaria": pagos_por_medio.get(
			MedioDePagoChoices.TRANSFERENCIA,
			Decimal("0.00"),
		),
		"billetera_virtual": pagos_por_medio.get(
			MedioDePagoChoices.BILLETERA_VIRTUAL,
			Decimal("0.00"),
		),
		"pago_efectivo": pagos_por_medio.get(
			MedioDePagoChoices.EFECTIVO,
			Decimal("0.00"),
		),
	})


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
	).prefetch_related("cuota__items", "reversiones").order_by("pk")
	socio_id = request.query_params.get("socio_id")
	if socio_id:
		if not socio_id.isdigit():
			return Response({"detail": "El socio indicado no es válido."}, status=status.HTTP_400_BAD_REQUEST)
		movements = movements.filter(cuenta_corriente__socio_id=int(socio_id))
	if request.query_params.get("solo_manuales") == "true":
		movements = movements.filter(origen_manual__isnull=False)
	return Response(MovimientoCuentaSerializer(movements, many=True).data)


@extend_schema(tags=["Finanzas/MovimientoCuenta"], request=MovimientoManualSerializer, responses=MovimientoCuentaSerializer)
@api_view(["POST"])
def movimiento_cuenta_manual(request):
	serializer = MovimientoManualSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
	data = serializer.validated_data
	try:
		movement = create_manual_movement(
			data["socio_id"],
			data["tipo"],
			data["origen"],
			data["concepto"],
			data["monto"],
			data["medio_de_pago"],
			data["movimiento_revertido_id"],
			request.user if request.user.is_authenticated else None,
		)
	except CuentaCorriente.DoesNotExist:
		return Response({"detail": "El socio no tiene cuenta corriente."}, status=status.HTTP_404_NOT_FOUND)
	except PagoInvalidoError as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
	return Response(MovimientoCuentaSerializer(movement).data, status=status.HTTP_201_CREATED)


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
	concept, created = ConceptoMovimiento.objects.get_or_create(
		nombre__iexact=data["nombre"],
		origen=data["origen"],
		defaults={"nombre": data["nombre"]},
	)
	if created:
		record_change(Seccion.FINANZAS, f"Concepto de movimiento {concept.nombre}", "", "Alta", request_user(request))
	return Response(
		ConceptoMovimientoSerializer(concept).data,
		status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
	)


@extend_schema(tags=["Finanzas/MovimientoCuenta"], responses=MovimientoCuentaSerializer)
@api_view(["GET"])
def movimiento_cuenta_detail(request, pk):
	return Response(MovimientoCuentaSerializer(get_object_or_404(MovimientoCuenta, pk=pk)).data)


@extend_schema(tags=["Finanzas/MovimientoCuenta"], responses={(200, "application/pdf"): bytes})
@api_view(["GET"])
def movimiento_cuenta_pdf(request, pk):
	movement = get_object_or_404(
		MovimientoCuenta.objects.select_related(
			"cuenta_corriente__socio__persona",
			"movimiento_revertido__cuota",
		).prefetch_related("reversiones"),
		pk=pk,
		origen_manual__isnull=False,
	)
	response = HttpResponse(render_manual_movement_pdf(movement), content_type="application/pdf")
	response["Content-Disposition"] = f'attachment; filename="{manual_movement_filename(movement)}"'
	return response


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
		if ItemPago.objects.filter(medio_de_pago=medio.codigo).exists():
			return Response(
				{"detail": "El medio de pago ya se usó en pagos registrados: deshabilitalo en lugar de eliminarlo."},
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

MONTHS_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _period_label(period_date):
    return f"{MONTHS_ES[period_date.month - 1].capitalize()} {period_date.year}"


def _build_financial_report(period_date):
    """Build the data dict consumed by render_financial_summary_pdf."""
    period_str = period_date.strftime("%Y-%m")

    period_cuotas = list(Cuota.objects.filter(periodo=period_str))
    cuotas_generadas = len(period_cuotas)
    cuotas_pagas = sum(1 for c in period_cuotas if c.estado_cuota == EstadoCuotaChoices.PAGA)

    total_recaudado_periodo = (
        Comprobante.objects.filter(
            fecha_emision__year=period_date.year,
            fecha_emision__month=period_date.month,
            pago__estado_pago=EstadoPagoChoices.ACREDITADO,
        ).aggregate(total=Sum("monto_total"))["total"]
        or Decimal("0.00")
    )
    movimientos_periodo = MovimientoCuenta.objects.filter(
        origen_manual__isnull=False,
        fecha__year=period_date.year,
        fecha__month=period_date.month,
    ).select_related("movimiento_revertido")
    for m in movimientos_periodo:
        medio = m.medio_de_pago or (m.movimiento_revertido.medio_de_pago if m.movimiento_revertido else None)
        if not medio:
            continue
        total_recaudado_periodo += m.monto if m.tipo_movimiento == TipoMovimientoChoices.ABONO else -m.monto

    reporte_mora = delinquency_report("activos")
    filas_mora = reporte_mora["filas"]

    pagos_por_medio = _totales_por_medio_de_pago()

    current_period = timezone.localdate().strftime("%Y-%m")
    unpaid_cuotas = list(
        Cuota.objects.filter(periodo__lte=current_period)
        .exclude(estado_cuota=EstadoCuotaChoices.PAGA)
        .select_related("movimiento__cuenta_corriente__socio__persona")
        .prefetch_related("items")
    )
    pending = pending_amounts(unpaid_cuotas)

    by_socio = {}
    for cuota in unpaid_cuotas:
        amount = pending.get(cuota.pk, Decimal("0.00"))
        if amount <= 0:
            continue
        movement = getattr(cuota, "movimiento", None)
        if not movement:
            continue
        socio = movement.cuenta_corriente.socio
        if socio.socio_id not in by_socio:
            by_socio[socio.socio_id] = {
                "numero_socio": socio.numero_socio,
                "nombre": socio.persona.nombre,
                "apellido": socio.persona.apellido,
                "dni": socio.persona.dni,
                "deuda_en_fecha": Decimal("0.00"),
                "cuotas_vencidas_1": 0,
                "cuotas_vencidas_2": 0,
                "deuda_vencida": Decimal("0.00"),
            }
        row = by_socio[socio.socio_id]
        if cuota.estado_cuota == EstadoCuotaChoices.EN_FECHA:
            row["deuda_en_fecha"] += amount
        else:
            key = "cuotas_vencidas_2" if cuota.estado_cuota == EstadoCuotaChoices.VENCIDA_2 else "cuotas_vencidas_1"
            row[key] += 1
            row["deuda_vencida"] += amount

    debtors = sorted(by_socio.values(), key=lambda r: (r["apellido"], r["nombre"]))

    return {
        "periodo_label": _period_label(period_date),
        "fecha": timezone.localtime(),
        "cuotas_generadas": cuotas_generadas,
        "cuotas_pagas": cuotas_pagas,
        "cuotas_impagas": cuotas_generadas - cuotas_pagas,
        "total_recaudado_periodo": total_recaudado_periodo,
        "socios_en_mora": len(filas_mora),
        "monto_adeudado_total": sum((f["monto_adeudado"] for f in filas_mora), Decimal("0.00")),
        "cuotas_vencidas": sum(f["cuotas_vencidas"] for f in filas_mora),
        "cuotas_vencidas_1": sum(f["cuotas_vencidas_1"] for f in filas_mora),
        "cuotas_vencidas_2": sum(f["cuotas_vencidas_2"] for f in filas_mora),
        "transferencia_bancaria": pagos_por_medio.get(MedioDePagoChoices.TRANSFERENCIA, Decimal("0.00")),
        "billetera_virtual": pagos_por_medio.get(MedioDePagoChoices.BILLETERA_VIRTUAL, Decimal("0.00")),
        "pago_efectivo": pagos_por_medio.get(MedioDePagoChoices.EFECTIVO, Decimal("0.00")),
        "deudores": debtors,
    }


@extend_schema(tags=["Finanzas/Resumen"], responses={(200, "application/pdf"): bytes})
@api_view(["GET"])
def resumen_financiero_pdf(request):
    """
    Generate and download the financial summary PDF for a given period.

    Query params:
        periodo (str): Period in YYYY-MM format. Defaults to the current month.
    """
    periodo_str = request.query_params.get("periodo", "").strip()
    if periodo_str:
        try:
            period_date = datetime.strptime(periodo_str, "%Y-%m").date()
        except ValueError:
            return Response(
                {"detail": "El período debe tener el formato AAAA-MM."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        today = timezone.localdate()
        period_date = today.replace(day=1)

    report = _build_financial_report(period_date)
    pdf_bytes = render_financial_summary_pdf(report)
    filename = financial_summary_filename(period_date.strftime("%Y-%m"))
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
