from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal

from django.db import transaction
from django.db.models import Prefetch, Q, Sum
from django.utils import timezone

from padron.models import ESTADO_ADMINISTRATIVO_ACTIVO, Socio

from .allocation import allocate_payment, charge_order, concept_totals
from .generators import GeneradorItemsCuota, benefit_reason, scholarships_for_period
from .models import (
    Beca,
    Comprobante,
    ConceptoItemChoices,
    ConfiguracionFinanciera,
    CuentaCorriente,
    Cuota,
    DetalleImputacion,
    EstadoComprobanteChoices,
    EstadoCuotaChoices,
    EstadoPagoChoices,
    Imputacion,
    ItemCuota,
    ItemPago,
    ModalidadMontoChoices,
    MovimientoCuenta,
    Pago,
    SecuenciaComprobante,
    TipoMovimientoChoices,
)

PERIOD_FORMAT = "%Y-%m"


class CuotaDuplicadaError(Exception):
    pass


class SocioInactivoError(Exception):
    pass


class PagoInvalidoError(Exception):
    pass


class CuotaConPagosError(Exception):
    pass


class BeneficioInvalidoError(Exception):
    pass


class ComprobanteInvalidoError(Exception):
    pass


def next_receipt_number():
    sequence, _ = SecuenciaComprobante.objects.select_for_update().get_or_create(pk=1)
    sequence.ultimo_numero += 1
    sequence.save(update_fields=["ultimo_numero"])
    return sequence.ultimo_numero


def net_amount(items):
    return sum(
        ((-item.monto if item.es_descuento else item.monto) for item in items),
        Decimal("0.00"),
    )


def parse_period(period):
    try:
        return datetime.strptime(str(period).strip(), PERIOD_FORMAT).date()
    except ValueError:
        raise ValueError("El período debe tener el formato AAAA-MM.") from None


def due_date(first_day, day):
    return first_day.replace(day=min(day, monthrange(first_day.year, first_day.month)[1]))


def lock_account(socio):
    account, _ = CuentaCorriente.objects.get_or_create(socio=socio)
    return CuentaCorriente.objects.select_for_update().get(pk=account.pk)


def lock_cuota_charge(cuota):
    account_id = MovimientoCuenta.objects.values_list("cuenta_corriente_id", flat=True).get(cuota=cuota)
    account = CuentaCorriente.objects.select_for_update().get(pk=account_id)
    movement = MovimientoCuenta.objects.select_for_update().get(cuota=cuota)
    return account, movement


@transaction.atomic
def create_cuota(socio, period, first_due_date=None, second_due_date=None, configuration=None, today=None):
    configuration = configuration or ConfiguracionFinanciera.load()
    today = today or timezone.localdate()
    first_day = parse_period(period)
    period = first_day.strftime(PERIOD_FORMAT)
    items = GeneradorItemsCuota(socio, first_day, configuration).build_items()
    if not items:
        raise SocioInactivoError("El socio no está activo; no corresponde generar cuota.")

    account = lock_account(socio)
    if account.cuotas.filter(periodo=period).exists():
        raise CuotaDuplicadaError(f"El socio ya tiene una cuota para el período {period}.")

    cuota = Cuota.objects.create(
        periodo=period,
        fecha_venc1=first_due_date or due_date(first_day, configuration.dia_vencimiento_1),
        fecha_venc2=second_due_date or due_date(first_day, configuration.dia_vencimiento_2),
    )
    for item in items:
        item.cuota = cuota
    ItemCuota.objects.bulk_create(items)

    amount = net_amount(items)
    MovimientoCuenta.objects.create(
        cuenta_corriente=account,
        cuota=cuota,
        tipo_movimiento=TipoMovimientoChoices.CARGO,
        fecha=timezone.now(),
        monto=amount,
        concepto=f"Cuota {period}",
    )
    account.saldo -= amount
    account.save(update_fields=["saldo"])
    if amount <= 0:
        refresh_cuota_state(cuota, amount)
    elif today > cuota.fecha_venc1:
        # A cuota created with due dates already past gets its surcharges and state now,
        # instead of waiting for the daily task.
        apply_cuota_surcharges(cuota.pk, today, configuration)
        cuota.refresh_from_db()
    return cuota


def has_payments(cuota):
    return Imputacion.objects.filter(movimiento_destino__cuota=cuota).exists()


def is_locked(cuota):
    return cuota.estado_cuota == EstadoCuotaChoices.PAGA or has_payments(cuota)


def applied_amount(cuota):
    return Imputacion.objects.filter(
        movimiento_destino__cuota=cuota,
        movimiento_origen__reversion__isnull=True,
    ).aggregate(total=Sum("monto_aplicado"))["total"] or Decimal("0.00")


def ensure_cuota_without_payments(cuota):
    if is_locked(cuota):
        raise CuotaConPagosError("La cuota está paga o tiene pagos aplicados y no puede modificarse.")


@transaction.atomic
def sync_cuota_charge(cuota):
    account, movement = lock_cuota_charge(cuota)
    amount = net_amount(ItemCuota.objects.filter(cuota=cuota))
    account.saldo -= amount - movement.monto
    account.save(update_fields=["saldo"])
    movement.monto = amount
    movement.save(update_fields=["monto"])
    refresh_cuota_state(cuota, amount - applied_amount(cuota))


@transaction.atomic
def delete_cuota(cuota):
    account, movement = lock_cuota_charge(cuota)
    ensure_cuota_without_payments(cuota)
    account.saldo += movement.monto
    account.save(update_fields=["saldo"])
    cuota.delete()


def generar_cuotas_mensuales(fecha=None, today=None):
    today = today or timezone.localdate()
    fecha = fecha or today
    if not isinstance(fecha, date):
        raise TypeError("La fecha de generación debe ser una fecha.")

    period = fecha.strftime(PERIOD_FORMAT)
    configuration = ConfiguracionFinanciera.load()
    socios = (
        Socio.objects.filter(estado_administrativo__nombre__iexact=ESTADO_ADMINISTRATIVO_ACTIVO)
        .select_related("estado_administrativo", "jugador__estado")
        .prefetch_related(Prefetch(
            "becas",
            queryset=scholarships_for_period(parse_period(period)),
            to_attr="becas_del_periodo",
        ))
        .order_by("pk")
    )
    result = {
        "periodo": period,
        "cuotas_creadas": 0,
        "cuotas_existentes": 0,
        "items_sociales": 0,
        "items_deportivos": 0,
    }

    for socio in socios:
        try:
            cuota = create_cuota(socio, period, configuration=configuration, today=today)
        except CuotaDuplicadaError:
            result["cuotas_existentes"] += 1
            continue
        except SocioInactivoError:
            continue

        concepts = list(cuota.items.values_list("concepto", flat=True))
        result["cuotas_creadas"] += 1
        result["items_sociales"] += concepts.count(ConceptoItemChoices.CUOTA_SOCIAL)
        result["items_deportivos"] += concepts.count(ConceptoItemChoices.CUOTA_DEPORTIVA)

    return result


def pending_amounts(cuotas, ignored_origin=None):
    cuota_ids = [cuota.pk for cuota in cuotas]
    imputations = Imputacion.objects.filter(movimiento_destino__cuota__in=cuota_ids)
    imputed_cuota_ids = set(imputations.values_list("movimiento_destino__cuota", flat=True))
    active = imputations.filter(movimiento_origen__reversion__isnull=True)
    if ignored_origin is not None:
        active = active.exclude(movimiento_origen=ignored_origin)
    applied = dict(
        active.values("movimiento_destino__cuota")
        .annotate(total=Sum("monto_aplicado"))
        .values_list("movimiento_destino__cuota", "total")
    )

    pending = {}
    for cuota in cuotas:
        if cuota.estado_cuota == EstadoCuotaChoices.PAGA and cuota.pk not in imputed_cuota_ids:
            pending[cuota.pk] = Decimal("0.00")
        else:
            pending[cuota.pk] = cuota.movimiento.monto - applied.get(cuota.pk, Decimal("0.00"))
    return pending


def cuota_state(cuota, pending, today):
    if pending <= 0:
        return EstadoCuotaChoices.PAGA
    if today > cuota.fecha_venc2:
        return EstadoCuotaChoices.VENCIDA_2
    if today > cuota.fecha_venc1:
        return EstadoCuotaChoices.VENCIDA_1
    return EstadoCuotaChoices.EN_FECHA


def refresh_cuota_state(cuota, pending, today=None):
    state = cuota_state(cuota, pending, today or timezone.localdate())
    if cuota.estado_cuota != state:
        cuota.estado_cuota = state
        cuota.save(update_fields=["estado_cuota"])


def active_allocations(cuota):
    allocated = {}
    details = DetalleImputacion.objects.filter(
        imputacion__movimiento_destino__cuota=cuota,
        imputacion__movimiento_origen__reversion__isnull=True,
    ).values_list("concepto", "monto")
    for concept, amount in details:
        allocated[concept] = allocated.get(concept, Decimal("0.00")) + amount
    return allocated


def imputation_lines(cuota, amount):
    charges, discounts = concept_totals(
        cuota.items.values_list("concepto", "monto", "es_descuento")
    )
    return allocate_payment(charges, discounts, active_allocations(cuota), amount)


def apply_payment(payment_movement, cuotas, amount):
    pending = pending_amounts(cuotas)
    remaining = amount
    today = timezone.localdate()
    imputations = []
    for cuota in sorted(cuotas, key=lambda cuota: (cuota.periodo, cuota.pk)):
        applied = min(remaining, max(pending[cuota.pk], Decimal("0.00")))
        if applied > 0:
            lines = imputation_lines(cuota, applied)
            imputation = Imputacion.objects.create(
                movimiento_origen=payment_movement,
                movimiento_destino=cuota.movimiento,
                fecha=timezone.now(),
                monto_aplicado=applied,
            )
            DetalleImputacion.objects.bulk_create([
                DetalleImputacion(imputacion=imputation, concepto=concept, monto=line_amount)
                for concept, line_amount in lines.items()
            ])
            imputations.append(imputation)
            remaining -= applied
        refresh_cuota_state(cuota, pending[cuota.pk] - applied, today)
    return imputations


RECEIPT_TYPE = "X"
DISCOUNT_CONCEPTS = (ConceptoItemChoices.BECA, ConceptoItemChoices.DESCUENTO_UNICO)


def detail_lines(totals):
    ordered = sorted(totals.items(), key=lambda pair: (pair[0] in DISCOUNT_CONCEPTS, charge_order(pair[0])))
    return [
        {"concepto": concept, "concepto_nombre": ConceptoItemChoices(concept).label, "monto": amount}
        for concept, amount in ordered
    ]


def receipt_detail(receipt):
    payment = receipt.pago
    movement = getattr(payment, "movimiento", None)
    socio = movement.cuenta_corriente.socio if movement else None
    imputations = (
        Imputacion.objects.filter(movimiento_origen=movement)
        .select_related("movimiento_destino__cuota")
        .prefetch_related("detalles")
        .order_by("movimiento_destino__cuota__periodo", "pk")
        if movement else []
    )

    periods, breakdown = [], {}
    for imputation in imputations:
        totals = {}
        for detail in imputation.detalles.all():
            totals[detail.concepto] = totals.get(detail.concepto, Decimal("0.00")) + detail.monto
            breakdown[detail.concepto] = breakdown.get(detail.concepto, Decimal("0.00")) + detail.monto
        cuota = imputation.movimiento_destino.cuota
        periods.append({
            "cuota_id": cuota.pk,
            "periodo": cuota.periodo,
            "monto_aplicado": imputation.monto_aplicado,
            "detalle": detail_lines(totals),
        })

    return {
        "tipo": RECEIPT_TYPE,
        "numero": receipt.numero,
        "fecha_emision": receipt.fecha_emision,
        "estado": receipt.estado,
        "monto_total": receipt.monto_total,
        "socio": {
            "socio_id": socio.socio_id,
            "numero_socio": socio.numero_socio,
            "nombre": socio.persona.nombre,
            "apellido": socio.persona.apellido,
            "dni": socio.persona.dni,
        } if socio else None,
        "periodos": periods,
        "desglose": detail_lines(breakdown),
        "medios": [
            {"medio_de_pago": item.medio_de_pago, "monto": item.monto}
            for item in payment.items_pago.order_by("pk")
        ],
    }


def validate_receipt(receipt):
    detail = receipt_detail(receipt)
    socio = detail["socio"] or {}
    missing = [
        label for label, value in (
            ("fecha", detail["fecha_emision"]),
            ("número de comprobante", detail["numero"]),
            ("nombre del socio", socio.get("nombre")),
            ("apellido del socio", socio.get("apellido")),
            ("DNI del socio", socio.get("dni")),
            ("número de socio", socio.get("numero_socio")),
            ("períodos abonados", detail["periodos"]),
            ("medios de pago", detail["medios"]),
        )
        if not value
    ]
    if missing:
        raise ComprobanteInvalidoError(f"No se puede emitir el comprobante: falta {', '.join(missing)}.")

    total = detail["monto_total"]
    if sum((line["monto"] for line in detail["desglose"]), Decimal("0.00")) != total:
        raise ComprobanteInvalidoError("No se puede emitir el comprobante: el desglose no coincide con el total abonado.")
    if sum((method["monto"] for method in detail["medios"]), Decimal("0.00")) != total:
        raise ComprobanteInvalidoError("No se puede emitir el comprobante: los medios de pago no coinciden con el total abonado.")
    return detail


def lock_account_cuotas(account, cuota_ids):
    cuotas = list(
        Cuota.objects.select_for_update(of=("self",))
        .filter(movimiento__cuenta_corriente=account, cuota_id__in=cuota_ids)
        .select_related("movimiento")
    )
    if len(cuotas) != len(set(cuota_ids)):
        raise PagoInvalidoError("Una o más cuotas no pertenecen a este socio.")
    return cuotas


def validate_payment_amount(pending, total, paid_message):
    if any(amount <= 0 for amount in pending.values()):
        raise PagoInvalidoError(paid_message)
    if total > sum(pending.values(), Decimal("0.00")):
        raise PagoInvalidoError("El pago supera el saldo pendiente de las cuotas seleccionadas.")


def create_payment(account, payment_methods, total, note, user, concept):
    payment = Pago.objects.create(
        usuario=user,
        estado_pago=EstadoPagoChoices.ACREDITADO,
        fecha=timezone.now(),
        observacion=note,
    )
    ItemPago.objects.bulk_create([
        ItemPago(pago=payment, medio_de_pago=method["medio_de_pago"], monto=method["monto"])
        for method in payment_methods
    ])
    receipt = Comprobante.objects.create(
        pago=payment,
        fecha_emision=timezone.localdate(),
        numero=next_receipt_number(),
        monto_total=total,
    )
    movement = MovimientoCuenta.objects.create(
        cuenta_corriente=account,
        pago=payment,
        tipo_movimiento=TipoMovimientoChoices.ABONO,
        fecha=timezone.now(),
        monto=total,
        concepto=concept[:200],
    )
    return payment, receipt, movement


@transaction.atomic
def register_payment(socio_id, cuota_ids, payment_methods, total, note="", user=None):
    account = CuentaCorriente.objects.select_for_update().get(socio_id=socio_id)
    cuotas = lock_account_cuotas(account, cuota_ids)
    validate_payment_amount(pending_amounts(cuotas), total, "No se pueden pagar cuotas ya saldadas.")

    payment, receipt, movement = create_payment(account, payment_methods, total, note, user, "Pago de cuotas")
    account.saldo += total
    account.save(update_fields=["saldo"])
    apply_payment(movement, cuotas, total)
    validate_receipt(receipt)
    return payment, receipt


@transaction.atomic
def correct_payment(payment_id, cuota_ids, payment_methods, total, reason, user=None):
    original = Pago.objects.select_for_update().get(pk=payment_id)
    if original.estado_pago != EstadoPagoChoices.ACREDITADO:
        raise PagoInvalidoError("Solo se pueden corregir pagos acreditados.")
    original_receipt = Comprobante.objects.select_for_update().filter(pago=original).first()
    original_movement = MovimientoCuenta.objects.select_for_update().filter(pago=original).first()
    if original_receipt is None or original_movement is None:
        raise PagoInvalidoError("El pago original no tiene comprobante o movimiento de cuenta para revertir.")

    account = CuentaCorriente.objects.select_for_update().get(pk=original_movement.cuenta_corriente_id)
    cuotas = lock_account_cuotas(account, cuota_ids)
    validate_payment_amount(
        pending_amounts(cuotas, ignored_origin=original_movement),
        total,
        "No se puede imputar la corrección a cuotas ya saldadas.",
    )
    previously_covered_ids = set(
        Imputacion.objects.filter(movimiento_origen=original_movement)
        .values_list("movimiento_destino__cuota", flat=True)
    ) - {cuota.pk for cuota in cuotas}
    previously_covered = list(
        Cuota.objects.select_for_update(of=("self",))
        .filter(pk__in=previously_covered_ids)
        .select_related("movimiento")
    )

    replacement, receipt, movement = create_payment(
        account,
        payment_methods,
        total,
        f"Sustituye al pago #{original.pk}.",
        user,
        f"Pago corregido; sustituye al pago #{original.pk}.",
    )
    MovimientoCuenta.objects.create(
        cuenta_corriente=account,
        movimiento_revertido=original_movement,
        tipo_movimiento=TipoMovimientoChoices.CARGO,
        fecha=timezone.now(),
        monto=original_movement.monto,
        concepto=f"Reversión del pago #{original.pk}. Sustituido por #{replacement.pk}."[:200],
    )
    account.saldo += total - original_movement.monto
    account.save(update_fields=["saldo"])

    original.estado_pago = EstadoPagoChoices.ANULADO
    original.motivo_anulacion = reason
    original.save(update_fields=["estado_pago", "motivo_anulacion"])
    original_receipt.estado = EstadoComprobanteChoices.ANULADO
    original_receipt.reemplazado_por = receipt
    original_receipt.save(update_fields=["estado", "reemplazado_por"])

    apply_payment(movement, cuotas, total)
    pending = pending_amounts(previously_covered)
    for cuota in previously_covered:
        refresh_cuota_state(cuota, pending[cuota.pk])
    validate_receipt(receipt)
    return original, original_receipt, replacement, receipt


BENEFIT_SCHOLARSHIP = "Beca"
BENEFIT_DISCOUNT = "Descuento"


def discount_base(items):
    return net_amount(
        item for item in items
        if not item.es_descuento and item.concepto != ConceptoItemChoices.MORA
    )


def unpaid_late_fees(cuota, items, pending):
    fees = sum(
        (item.monto for item in items if not item.es_descuento and item.concepto == ConceptoItemChoices.MORA),
        Decimal("0.00"),
    )
    if fees <= 0:
        return Decimal("0.00")
    if net_amount(items) - pending <= 0:
        return fees
    paid_fees = active_allocations(cuota).get(ConceptoItemChoices.MORA, Decimal("0.00"))
    return max(fees - paid_fees, Decimal("0.00"))


def discountable_pending(cuota, items, pending):
    """What is left to pay on the cuota without its unpaid late fees: the most a benefit can take off it."""
    return max(pending - unpaid_late_fees(cuota, items, pending), Decimal("0.00"))


def cuota_period_start(cuota):
    try:
        return parse_period(cuota.periodo)
    except ValueError:
        return cuota.fecha_venc1.replace(day=1)


def lock_cuota(cuota_id):
    account_id = MovimientoCuenta.objects.values_list("cuenta_corriente_id", flat=True).get(cuota_id=cuota_id)
    CuentaCorriente.objects.select_for_update().get(pk=account_id)
    return (
        Cuota.objects.select_for_update(of=("self",))
        .select_related("movimiento__cuenta_corriente")
        .get(pk=cuota_id)
    )


SURCHARGE_LABELS = {1: "primer", 2: "segundo"}


def apply_cuota_surcharges(cuota_id, today=None, configuration=None):
    today = today or timezone.localdate()
    configuration = configuration or ConfiguracionFinanciera.load()
    with transaction.atomic():
        cuota = lock_cuota(cuota_id)
        pending = pending_amounts([cuota])[cuota.pk]
        if pending <= 0:
            refresh_cuota_state(cuota, pending, today)
            return []

        base_amount = net_amount(cuota.items.exclude(concepto=ConceptoItemChoices.MORA))
        surcharges = []
        for number, due in ((1, cuota.fecha_venc1), (2, cuota.fecha_venc2)):
            if cuota.recargos_aplicados >= number or today <= due:
                continue
            amount = configuration.surcharge(number, base_amount)
            if amount > 0:
                surcharges.append((number, ItemCuota.objects.create(
                    cuota=cuota,
                    concepto=ConceptoItemChoices.MORA,
                    fecha_aplicacion=today,
                    monto=amount,
                    motivo=f"Recargo por {SURCHARGE_LABELS[number]} vencimiento ({due:%d/%m/%Y})",
                )))
            cuota.recargos_aplicados = number
        cuota.save(update_fields=["recargos_aplicados"])

        if surcharges:
            sync_cuota_charge(cuota)
            cuota.movimiento.refresh_from_db(fields=["monto"])
        refresh_cuota_state(cuota, pending_amounts([cuota])[cuota.pk], today)
        return surcharges


@transaction.atomic
def reschedule_cuota(cuota_id, first_due_date, second_due_date, today=None):
    cuota = lock_cuota(cuota_id)
    ensure_cuota_without_payments(cuota)
    if (cuota.fecha_venc1, cuota.fecha_venc2) != (first_due_date, second_due_date):
        cuota.fecha_venc1 = first_due_date
        cuota.fecha_venc2 = second_due_date
        cuota.recargos_aplicados = 0
        cuota.save(update_fields=["fecha_venc1", "fecha_venc2", "recargos_aplicados"])
        deleted, _ = cuota.items.filter(concepto=ConceptoItemChoices.MORA).delete()
        if deleted:
            sync_cuota_charge(cuota)
    apply_cuota_surcharges(cuota.pk, today)


def stale_state_filter(today):
    return (
        Q(estado_cuota=EstadoCuotaChoices.EN_FECHA, fecha_venc1__lt=today)
        | Q(estado_cuota=EstadoCuotaChoices.VENCIDA_1, fecha_venc2__lt=today)
        | Q(estado_cuota=EstadoCuotaChoices.VENCIDA_1, fecha_venc1__gte=today)
        | Q(estado_cuota=EstadoCuotaChoices.VENCIDA_2, fecha_venc2__gte=today)
    )


def apply_surcharges(today=None):
    today = today or timezone.localdate()
    configuration = ConfiguracionFinanciera.load()
    previous_states = dict(
        Cuota.objects.filter(movimiento__isnull=False)
        .filter(Q(fecha_venc1__lt=today, recargos_aplicados__lt=2) | stale_state_filter(today))
        .exclude(estado_cuota=EstadoCuotaChoices.PAGA)
        .order_by("pk")
        .values_list("pk", "estado_cuota")
    )
    result = {
        "fecha": today.isoformat(),
        "cuotas_revisadas": len(previous_states),
        "recargos_primer_vencimiento": 0,
        "recargos_segundo_vencimiento": 0,
        "monto_total": Decimal("0.00"),
        "estados_actualizados": 0,
    }
    for cuota_id in previous_states:
        for number, item in apply_cuota_surcharges(cuota_id, today, configuration):
            key = "recargos_primer_vencimiento" if number == 1 else "recargos_segundo_vencimiento"
            result[key] += 1
            result["monto_total"] += item.monto
    current_states = Cuota.objects.filter(pk__in=previous_states).values_list("pk", "estado_cuota")
    result["estados_actualizados"] = sum(1 for pk, state in current_states if previous_states[pk] != state)
    return result


def benefit_amount(mode, value, base):
    if mode == ModalidadMontoChoices.PORCENTAJE:
        return (base * value / Decimal("100")).quantize(Decimal("0.01"))
    return value


@transaction.atomic
def assign_benefit(cuota_id, kind, mode, value, start_date, reason, end_date=None, user=None):
    cuota = lock_cuota(cuota_id)
    items = list(cuota.items.all())
    base = discount_base(items)
    if mode == ModalidadMontoChoices.MONTO_FIJO and value > base:
        raise BeneficioInvalidoError("El monto fijo no puede superar el valor de la cuota.")

    paid = cuota.estado_cuota == EstadoCuotaChoices.PAGA
    remaining = discountable_pending(cuota, items, pending_amounts([cuota])[cuota.pk])
    amount = min(benefit_amount(mode, value, base), base)

    if kind == BENEFIT_DISCOUNT:
        if paid:
            raise CuotaConPagosError("La cuota está paga y no puede recibir un descuento.")
        if amount > remaining:
            raise BeneficioInvalidoError("El descuento supera el saldo pendiente de la cuota, sin contar recargos.")
        item = ItemCuota.objects.create(
            cuota=cuota,
            concepto=ConceptoItemChoices.DESCUENTO_UNICO,
            es_descuento=True,
            fecha_aplicacion=start_date,
            monto=amount,
            motivo=benefit_reason(reason),
        )
        sync_cuota_charge(cuota)
        return None, item

    scholarship = Beca.objects.create(
        socio_id=cuota.movimiento.cuenta_corriente.socio_id,
        monto=value if mode == ModalidadMontoChoices.MONTO_FIJO else None,
        porcentaje=value if mode == ModalidadMontoChoices.PORCENTAJE else None,
        fecha_aplicacion=start_date,
        fecha_fin=end_date,
        motivo=reason,
        usuario=user,
    )
    item = None
    # A scholarship larger than what is left to pay only covers the remaining amount
    scholarship_amount = min(scholarship.discount_for(base), remaining)
    if not paid and scholarship.covers_period(cuota_period_start(cuota)) and scholarship_amount > 0:
        item = ItemCuota.objects.create(
            cuota=cuota,
            concepto=ConceptoItemChoices.BECA,
            es_descuento=True,
            fecha_aplicacion=start_date,
            monto=scholarship_amount,
            motivo=benefit_reason(reason),
        )
        sync_cuota_charge(cuota)
    return scholarship, item
