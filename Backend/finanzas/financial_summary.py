from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum

from .delinquency import delinquency_report
from .generators import PERIOD_FORMAT
from .models import (
    Comprobante,
    ConceptoItemChoices,
    Cuota,
    Devolucion,
    EstadoComprobanteChoices,
    ItemCuota,
    ItemPago,
    MedioPago,
    TipoMovimientoChoices,
)
from .period_summary import period_summary
from .services import parse_period, pending_amounts, receipt_code, refund_code

ZERO = Decimal("0.00")
CUOTAS_LABEL = "Cuotas"
OTHERS_LABEL = "Otros"
# Extra income concepts shown on their own in the origin chart; the rest are grouped as "Otros"
TOP_CONCEPTS = 2
EVOLUTION_MONTHS = 12


def percentage(part, total):
    if not total:
        return Decimal("0.0")
    return (part * 100 / total).quantize(Decimal("0.1"))


def socio_name(account):
    person = account.socio.persona
    return {"socio_id": account.socio_id, "numero_socio": account.socio.numero_socio, "nombre": person.nombre, "apellido": person.apellido}


def month_receipts(first_day):
    """Receipts issued in the month and still in force: the money that came in (cash basis)."""
    return Comprobante.objects.filter(
        estado=EstadoComprobanteChoices.VIGENTE,
        fecha_emision__year=first_day.year,
        fecha_emision__month=first_day.month,
    )


def income_origin(cuotas_total, extra_rows, total):
    by_concept = {}
    for row in extra_rows:
        by_concept[row["concepto"]] = by_concept.get(row["concepto"], ZERO) + row["monto"]
    ranked = sorted(by_concept.items(), key=lambda pair: pair[1], reverse=True)
    segments = [(CUOTAS_LABEL, cuotas_total), *ranked[:TOP_CONCEPTS]]
    others = sum((amount for _, amount in ranked[TOP_CONCEPTS:]), ZERO)
    if others:
        segments.append((OTHERS_LABEL, others))
    return [
        {"nombre": name, "monto": amount, "porcentaje": percentage(amount, total)}
        for name, amount in segments
        if amount or name == CUOTAS_LABEL
    ]


def extra_income_rows(receipts):
    incomes = (
        receipts.filter(pago__movimiento__tipo_movimiento=TipoMovimientoChoices.INGRESO)
        .select_related("pago__movimiento__cuenta_corriente__socio__persona")
        .order_by("fecha_emision", "numero")
    )
    return [
        {
            "comprobante_id": receipt.pk,
            "codigo": receipt_code(receipt),
            "fecha": receipt.fecha_emision,
            "socio": socio_name(receipt.pago.movimiento.cuenta_corriente),
            "concepto": receipt.pago.movimiento.concepto,
            "monto": receipt.monto_total,
        }
        for receipt in incomes
    ]


def payment_method_rows(receipts, total):
    amounts = dict(
        ItemPago.objects.filter(pago__comprobante__in=receipts)
        .values("medio_de_pago")
        .annotate(total=Sum("monto"))
        .values_list("medio_de_pago", "total")
    )
    names = dict(MedioPago.objects.values_list("codigo", "nombre"))
    codes = set(amounts) | set(MedioPago.objects.filter(activo=True).values_list("codigo", flat=True))
    rows = [
        {
            "codigo": code,
            "nombre": names.get(code, code),
            "monto": amounts.get(code, ZERO),
            "porcentaje": percentage(amounts.get(code, ZERO), total),
        }
        for code in codes
    ]
    return sorted(rows, key=lambda row: (-row["monto"], row["nombre"]))


def refund_rows(first_day):
    refunds = (
        Devolucion.objects.filter(fecha__year=first_day.year, fecha__month=first_day.month)
        .select_related("cuenta_corriente__socio__persona", "comprobante_anulado")
        .order_by("fecha", "pk")
    )
    names = dict(MedioPago.objects.values_list("codigo", "nombre"))
    return [
        {
            "devolucion_id": refund.pk,
            "codigo": refund_code(refund),
            "tipo": refund.tipo,
            "tipo_nombre": refund.get_tipo_display(),
            "fecha": refund.fecha,
            "socio": socio_name(refund.cuenta_corriente),
            "concepto": refund.concepto,
            "monto": refund.monto,
            "medio_de_pago": names.get(refund.medio_de_pago, refund.medio_de_pago),
            "comprobante_anulado": receipt_code(refund.comprobante_anulado) if refund.comprobante_anulado_id else None,
        }
        for refund in refunds
    ]


def cuota_kpis(period):
    totals = period_summary(period)["totals"]
    surcharges = ItemCuota.objects.filter(cuota__periodo=period, cuota__movimiento__isnull=False)
    applied = surcharges.filter(concepto=ConceptoItemChoices.MORA).aggregate(total=Sum("monto"))["total"] or ZERO
    waived = surcharges.filter(concepto=ConceptoItemChoices.CONDONACION_MORA).aggregate(total=Sum("monto"))["total"] or ZERO
    return {
        "esperado": totals["billed"],
        "cobrado": totals["collected"],
        "en_deuda": totals["unpaid_amount"],
        "efectividad": totals["collection_rate"],
        "generadas": totals["generated"],
        "pagas": totals["generated"] - totals["unpaid"],
        "recargos": applied - waived,
    }


def previous_periods(first_day, months=EVOLUTION_MONTHS):
    periods = []
    current = first_day
    for _ in range(months):
        periods.append(current.strftime(PERIOD_FORMAT))
        current = (current - timedelta(days=1)).replace(day=1)
    return list(reversed(periods))


def collection_evolution(first_day):
    """Billed vs collected of the cuotas of the last twelve periods, up to the selected one."""
    periods = previous_periods(first_day)
    cuotas = list(Cuota.objects.filter(periodo__in=periods, movimiento__isnull=False).select_related("movimiento"))
    pending = pending_amounts(cuotas)
    billed = dict.fromkeys(periods, ZERO)
    collected = dict.fromkeys(periods, ZERO)
    for cuota in cuotas:
        billed[cuota.periodo] += cuota.movimiento.monto
        collected[cuota.periodo] += max(ZERO, cuota.movimiento.monto - pending[cuota.pk])
    return [
        {
            "periodo": period,
            "facturado": billed[period],
            "cobrado": collected[period],
            "efectividad": percentage(collected[period], billed[period]) if billed[period] > 0 else None,
        }
        for period in periods
    ]


def debt_overview():
    rows = delinquency_report("activos")["filas"]
    return {
        "socios_en_mora": len(rows),
        "monto_adeudado_total": sum((row["monto_adeudado"] for row in rows), ZERO),
        "cuotas_vencidas": sum(row["cuotas_vencidas"] for row in rows),
        "cuotas_vencidas_1": sum(row["cuotas_vencidas_1"] for row in rows),
        "cuotas_vencidas_2": sum(row["cuotas_vencidas_2"] for row in rows),
    }


def financial_summary(period):
    """Monthly financial summary. Income, payment methods and refunds follow the money that came in
    or went out in the month; the cuota indicators and the evolution follow the cuota period."""
    first_day = parse_period(period)
    receipts = month_receipts(first_day)
    cuotas_total = (
        receipts.filter(pago__movimiento__tipo_movimiento=TipoMovimientoChoices.ABONO)
        .aggregate(total=Sum("monto_total"))["total"] or ZERO
    )
    extra = extra_income_rows(receipts)
    extra_total = sum((row["monto"] for row in extra), ZERO)
    total = cuotas_total + extra_total
    refunds = refund_rows(first_day)
    return {
        "periodo": first_day.strftime(PERIOD_FORMAT),
        **debt_overview(),
        "ingresos": {
            "total": total,
            "cuotas": cuotas_total,
            "extra": extra_total,
            "origen": income_origin(cuotas_total, extra, total),
        },
        "cuotas": cuota_kpis(first_day.strftime(PERIOD_FORMAT)),
        "ingresos_extra": {"total": extra_total, "movimientos": extra},
        "medios_de_pago": {"total": total, "medios": payment_method_rows(receipts, total)},
        "devoluciones": {"total": sum((row["monto"] for row in refunds), ZERO), "movimientos": refunds},
        "evolucion": collection_evolution(first_day),
    }
