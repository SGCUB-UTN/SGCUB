
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
from padron.models import Socio

from .models import (
	Beca,
	Comprobante,
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
)
from .delinquency import ReporteMorosidadInvalidoError, delinquency_report, parse_delinquency_params
from .delinquency_pdf import delinquency_filename, render_delinquency_pdf
from .financial_summary_pdf import financial_summary_filename, render_financial_summary_pdf
from .receipts import receipt_filename, render_receipt_pdf
from .serializers import (
	BecaSerializer,
	BeneficioSerializer,
	ConfiguracionFinancieraSerializer,
	CorreccionPagoSerializer,
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
	apply_surcharges,
	assign_benefit,
	correct_payment,
	create_cuota,
	delete_cuota,
	ensure_cuota_without_payments,
	generar_cuotas_mensuales,
	pending_amounts,
	register_payment,
	reschedule_cuota,
)


def _cuota_con_pagos(error):
	return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)


def _cuotas_queryset():
	return Cuota.objects.select_related(
		"movimiento__cuenta_corriente__socio__persona",
		"movimiento__cuenta_corriente__socio__jugador",
	).prefetch_related("items")


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


@extend_schema(tags=["Finanzas/Resumen"])
@api_view(["GET"])
def resumen_financiero(request):
	reporte = delinquency_report("activos")
	pagos_por_medio = {
		item["medio_de_pago"]: item["total"]
		for item in ItemPago.objects.filter(
			pago__estado_pago=EstadoPagoChoices.ACREDITADO,
		).values("medio_de_pago").annotate(total=Sum("monto"))
	}
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
	return Response(MovimientoCuentaSerializer(MovimientoCuenta.objects.order_by("pk"), many=True).data)


@extend_schema(tags=["Finanzas/MovimientoCuenta"], responses=MovimientoCuentaSerializer)
@api_view(["GET"])
def movimiento_cuenta_detail(request, pk):
	return Response(MovimientoCuentaSerializer(get_object_or_404(MovimientoCuenta, pk=pk)).data)


@extend_schema(tags=["Finanzas/Imputacion"], responses=ImputacionSerializer)
@api_view(["GET"])
def imputacion_list(request):
	return Response(ImputacionSerializer(Imputacion.objects.order_by("pk"), many=True).data)


@extend_schema(tags=["Finanzas/Imputacion"], responses=ImputacionSerializer)
@api_view(["GET"])
def imputacion_detail(request, pk):
	return Response(ImputacionSerializer(get_object_or_404(Imputacion, pk=pk)).data)


@extend_schema(tags=["Finanzas/Configuracion"], request=ConfiguracionFinancieraSerializer, responses=ConfiguracionFinancieraSerializer)
@api_view(["GET", "PUT", "PATCH"])
def configuracion_financiera(request):
	configuracion = ConfiguracionFinanciera.load()
	if request.method == "GET":
		return Response(ConfiguracionFinancieraSerializer(configuracion).data)

	serializer = ConfiguracionFinancieraSerializer(configuracion, data=request.data, partial=request.method == "PATCH")
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
	usuario = request.user if request.user.is_authenticated else None
	return Response(ConfiguracionFinancieraSerializer(serializer.save(usuario_actualizacion=usuario)).data)


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
			data.get("fecha_fin"),
			request.user if request.user.is_authenticated else None,
		)
	except (BeneficioInvalidoError, CuotaConPagosError) as error:
		return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

	return Response({
		"beca": BecaSerializer(beca).data if beca else None,
		"item": ItemCuotaSerializer(item).data if item else None,
		"aplicado_a_cuota": item is not None,
	}, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Finanzas/Beca"], responses=BecaSerializer)
@api_view(["GET"])
def beca_list(request):
	becas = Beca.objects.order_by("-fecha_aplicacion", "-pk")
	socio_id = request.query_params.get("socio_id")
	if socio_id:
		if not socio_id.isdigit():
			return Response({"detail": "El socio indicado no es válido."}, status=status.HTTP_400_BAD_REQUEST)
		becas = becas.filter(socio_id=int(socio_id))
	return Response(BecaSerializer(becas, many=True).data)

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

    reporte_mora = delinquency_report("activos")
    filas_mora = reporte_mora["filas"]

    pagos_por_medio = {
        item["medio_de_pago"]: item["total"]
        for item in ItemPago.objects.filter(
            pago__estado_pago=EstadoPagoChoices.ACREDITADO,
        ).values("medio_de_pago").annotate(total=Sum("monto"))
    }

    unpaid_cuotas = list(
        Cuota.objects.exclude(estado_cuota=EstadoCuotaChoices.PAGA)
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
