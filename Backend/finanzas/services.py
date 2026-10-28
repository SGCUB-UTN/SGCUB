from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Prefetch, Q, Sum
from django.utils import timezone

from padron.models import ESTADO_ADMINISTRATIVO_ACTIVO, Socio

from .allocation import allocate_payment, charge_order, concept_totals
from .generators import PERIOD_FORMAT, GeneradorItemsCuota, benefit_reason, scholarships_for_period
from .models import (
    Beca,
    Comprobante,
    ConceptoItemChoices,
    ConfiguracionFinanciera,
    CuentaCorriente,
    Cuota,
    DetalleImputacion,
    EstadoBecaChoices,
    EstadoComprobanteChoices,
    EstadoCuotaChoices,
    EstadoItemCuotaChoices,
    EstadoPagoChoices,
    ExclusionBeca,
    Imputacion,
    ItemCuota,
    ItemPago,
    ModalidadMontoChoices,
    MovimientoCuenta,
    Pago,
    SecuenciaComprobante,
    TipoMovimientoChoices,
    TipoMovimientoOrigenChoices,
)

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


def reversed_amount_for(movement):
    if movement is None:
        return Decimal("0.00")
    prefetched = getattr(movement, "_prefetched_objects_cache", {})
    if "reversiones" in prefetched:
        return sum((rev.monto for rev in movement.reversiones.all()), Decimal("0.00"))
    return movement.reversiones.aggregate(total=Sum("monto"))["total"] or Decimal("0.00")


def remaining_reversible_amount(movement):
    if movement is None:
        return Decimal("0.00")
    return max(Decimal("0.00"), movement.monto - reversed_amount_for(movement))


@transaction.atomic
def create_manual_movement(
    socio_id,
    movement_type,
    origin,
    concept,
    amount,
    payment_method=None,
    reversed_movement_id=None,
    user=None,
):
    account = CuentaCorriente.objects.select_for_update().get(socio_id=socio_id)
    reversed_movement = None
    if reversed_movement_id:
        reversed_movement = MovimientoCuenta.objects.select_for_update().filter(
            pk=reversed_movement_id,
            cuenta_corriente=account,
        ).first()
        if reversed_movement is None:
            raise PagoInvalidoError("El movimiento a revertir no pertenece al socio indicado.")

        available_to_reverse = remaining_reversible_amount(reversed_movement)
        if available_to_reverse <= Decimal("0.00"):
            raise PagoInvalidoError("El movimiento indicado ya fue revertido en su totalidad.")

        if amount > available_to_reverse:
            raise PagoInvalidoError(
                f"El monto no puede superar el saldo disponible del movimiento original ({available_to_reverse})."
            )

        if payment_method is None:
            payment_method = reversed_movement.medio_de_pago

    movement = MovimientoCuenta.objects.create(
        cuenta_corriente=account,
        movimiento_revertido=reversed_movement,
        tipo_movimiento=movement_type,
        fecha=timezone.now(),
        monto=amount,
        concepto=concept,
        medio_de_pago=payment_method,
        origen_manual=origin,
        numero_comprobante=next_receipt_number(),
        usuario=user,
    )
    account.saldo += amount if movement_type == TipoMovimientoChoices.ABONO else -amount
    account.save(update_fields=["saldo"])
    return movement


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


CUOTA_WINDOW_MONTHS = 3


def generation_periods(base_date=None, months=CUOTA_WINDOW_MONTHS):
    first_day = (base_date or timezone.localdate()).replace(day=1)
    periods = []
    for _ in range(months):
        periods.append(first_day.strftime(PERIOD_FORMAT))
        first_day = (first_day + timedelta(days=32)).replace(day=1)
    return periods


def lock_account(socio):
    account, _ = CuentaCorriente.objects.get_or_create(socio=socio)
    return CuentaCorriente.objects.select_for_update().get(pk=account.pk)


def lock_cuota_charge(cuota):
    account_id = MovimientoCuenta.objects.values_list("cuenta_corriente_id", flat=True).get(cuota=cuota)
    account = CuentaCorriente.objects.select_for_update().get(pk=account_id)
    movement = MovimientoCuenta.objects.select_for_update().get(cuota=cuota)
    return account, movement


def has_registration_fee(socio_id):
    return ItemCuota.all_objects.filter(
        cuota__movimiento__cuenta_corriente__socio_id=socio_id,
        concepto=ConceptoItemChoices.INSCRIPCION,
    ).exists()


@transaction.atomic
def create_cuota(socio, period, first_due_date=None, second_due_date=None, configuration=None, today=None):
    today = today or timezone.localdate()
    first_day = parse_period(period)
    period = first_day.strftime(PERIOD_FORMAT)
    configuration = configuration or ConfiguracionFinanciera.load(period)
    account = lock_account(socio)
    if account.cuotas.filter(periodo=period).exists():
        raise CuotaDuplicadaError(f"El socio ya tiene una cuota para el período {period}.")

    items = GeneradorItemsCuota(socio, first_day, configuration).build_items(
        include_registration=not has_registration_fee(socio.pk),
    )
    if not items:
        raise SocioInactivoError("El socio no está activo; no corresponde generar cuota.")

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


def create_first_cuota(socio, today=None):
    today = today or timezone.localdate()
    created = []
    for period in generation_periods(today):
        try:
            created.append(create_cuota(socio, period, today=today))
        except CuotaDuplicadaError:
            continue
        except SocioInactivoError:
            return None
    return created[0] if created else None


def _ensure_player_cuota_for_period(socio, period, today):
    cuota = Cuota.objects.filter(
        movimiento__cuenta_corriente__socio_id=socio.pk,
        periodo=period,
    ).first()
    if cuota is None:
        try:
            return create_cuota(socio, period, today=today)
        except SocioInactivoError:
            return None

    cuota = lock_cuota(cuota.pk)
    if is_locked(cuota):
        return cuota

    generated_items = GeneradorItemsCuota(socio, parse_period(period)).build_items(
        include_registration=not has_registration_fee(socio.pk),
    )
    sports_item = next(
        (item for item in generated_items if item.concepto == ConceptoItemChoices.CUOTA_DEPORTIVA),
        None,
    )
    registration_item = next(
        (item for item in generated_items if item.concepto == ConceptoItemChoices.INSCRIPCION),
        None,
    )
    items_to_add = []
    if sports_item is not None and not cuota.items.filter(concepto=ConceptoItemChoices.CUOTA_DEPORTIVA).exists():
        items_to_add.append(sports_item)
    if registration_item is not None and not cuota.items.filter(concepto=ConceptoItemChoices.INSCRIPCION).exists():
        items_to_add.append(registration_item)
    if not items_to_add:
        return cuota

    for item in items_to_add:
        item.cuota = cuota
        item.save()
    sync_cuota_charge(cuota)
    refresh_cuota_scholarships(cuota, socio.pk, "Beca recalculada por actualización de conceptos de cuota")
    return cuota


@transaction.atomic
def create_or_update_player_current_cuota(socio_id):
    today = timezone.localdate()
    socio = Socio.objects.select_related("estado_administrativo", "jugador__estado").get(pk=socio_id)
    results = [_ensure_player_cuota_for_period(socio, period, today) for period in generation_periods(today)]
    return results[0] if results else None


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


def user_name(user):
    if user is None:
        return "Sistema"
    return (user.get_full_name().strip() or user.username)[:120]


def affected_cuotas(period):
    """Cuotas a version from `period` applies to: up to the next scheduled version and not fully paid."""
    cuotas = (
        Cuota.objects.filter(movimiento__isnull=False, periodo__gte=period)
        .exclude(estado_cuota=EstadoCuotaChoices.PAGA)
        .order_by("periodo", "pk")
    )
    next_period = (
        ConfiguracionFinanciera.objects.filter(periodo_vigencia__gt=period)
        .order_by("periodo_vigencia")
        .values_list("periodo_vigencia", flat=True)
        .first()
    )
    return cuotas.filter(periodo__lt=next_period) if next_period else cuotas


CONFIGURATION_AMOUNTS = (
    (ConceptoItemChoices.CUOTA_SOCIAL, "monto_cuota_social"),
    (ConceptoItemChoices.CUOTA_DEPORTIVA, "monto_cuota_deportiva"),
    (ConceptoItemChoices.INSCRIPCION, "monto_inscripcion"),
)


def update_cuota_amounts(cuota, configuration, reason, authorized_by, user):
    changed = False
    for concept, field in CONFIGURATION_AMOUNTS:
        amount = getattr(configuration, field)
        for item in cuota.items.filter(concepto=concept).exclude(monto=amount):
            annul_item(item, reason, authorized_by, user)
            ItemCuota.objects.create(
                cuota=cuota,
                concepto=concept,
                fecha_aplicacion=item.fecha_aplicacion,
                monto=amount,
                motivo=benefit_reason(reason),
                autorizado_por=authorized_by,
            )
            changed = True
    return changed


def update_cuota_due_dates(cuota, configuration, reason, authorized_by, user):
    first_day = cuota_period_start(cuota)
    dates = (
        due_date(first_day, configuration.dia_vencimiento_1),
        due_date(first_day, configuration.dia_vencimiento_2),
    )
    if (cuota.fecha_venc1, cuota.fecha_venc2) == dates:
        return False
    cuota.fecha_venc1, cuota.fecha_venc2 = dates
    update_fields = ["fecha_venc1", "fecha_venc2"]
    # Surcharges of the old dates no longer apply, unless a payment already covered them
    if not has_active_payments(cuota):
        for item in cuota.items.filter(concepto=ConceptoItemChoices.MORA):
            annul_item(item, reason, authorized_by, user)
        cuota.recargos_aplicados = 0
        update_fields.append("recargos_aplicados")
    cuota.save(update_fields=update_fields)
    return True


def apply_configuration_to_cuota(cuota_id, configuration, user=None):
    cuota = lock_cuota(cuota_id)
    reason = f"Actualización de la configuración vigente desde {configuration.periodo_vigencia}"
    authorized_by = user_name(user)
    amounts_changed = update_cuota_amounts(cuota, configuration, reason, authorized_by, user)
    dates_changed = update_cuota_due_dates(cuota, configuration, reason, authorized_by, user)
    if not (amounts_changed or dates_changed):
        return False
    # Percentage scholarships depend on the amounts: they are recalculated even with partial payments
    socio_id = cuota.movimiento.cuenta_corriente.socio_id
    scholarships = list(scholarships_for_period(cuota_period_start(cuota)).filter(socio_id=socio_id))
    rebuild_cuota_scholarships(cuota, scholarships, reason, authorized_by, user)
    sync_cuota_charge(cuota)
    apply_cuota_surcharges(cuota.pk, configuration=configuration)
    return True


@transaction.atomic
def create_configuration_version(parameters, user=None, responsable=""):
    """Creates the version and updates every unpaid cuota (partially paid included) it applies to."""
    configuration = ConfiguracionFinanciera.objects.create(**parameters, usuario_creacion=user, responsable=responsable[:120])
    configuration.cuotas_actualizadas = sum(
        apply_configuration_to_cuota(cuota_id, configuration, user)
        for cuota_id in affected_cuotas(configuration.periodo_vigencia).values_list("pk", flat=True)
    )
    configuration.save(update_fields=["cuotas_actualizadas"])
    return configuration


@transaction.atomic
def revert_configuration_version(version, user=None, responsable=""):
    """Reverts a scheduled future version back to the parameters of the previous version."""
    previous = version.previous_version()
    if previous is None:
        raise ValueError("No hay una versión anterior a la cual revertir.")
    parameters = {**previous.parameters(), "periodo_vigencia": version.periodo_vigencia}
    return create_configuration_version(
        parameters,
        user=user,
        responsable=(responsable or version.responsable or user_name(user))[:120],
    )


def generar_cuotas_mensuales(fecha=None, today=None, meses=CUOTA_WINDOW_MONTHS, created=None):
    today = today or timezone.localdate()
    fecha = fecha or today
    if not isinstance(fecha, date):
        raise TypeError("La fecha de generación debe ser una fecha.")

    periods = generation_periods(fecha, months=meses)
    first_start = parse_period(periods[0])
    _, last_end = (
        parse_period(periods[-1]),
        parse_period(periods[-1]).replace(day=monthrange(parse_period(periods[-1]).year, parse_period(periods[-1]).month)[1]),
    )
    active_scholarships = (
        Beca.objects.exclude(estado=EstadoBecaChoices.CANCELADA)
        .filter(fecha_aplicacion__lte=last_end)
        .filter(Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=first_start))
        .prefetch_related("exclusiones")
        .order_by("fecha_aplicacion", "pk")
    )
    socios = list(
        Socio.objects.filter(estado_administrativo__nombre__iexact=ESTADO_ADMINISTRATIVO_ACTIVO)
        .select_related("estado_administrativo", "jugador__estado")
        .prefetch_related(Prefetch(
            "becas",
            queryset=active_scholarships,
            to_attr="becas_activas",
        ))
        .order_by("pk")
    )
    result = {
        "periodo": periods[0],
        "periodos": periods,
        "cuotas_creadas": 0,
        "cuotas_existentes": 0,
        "items_sociales": 0,
        "items_deportivos": 0,
    }

    for period in periods:
        configuration = ConfiguracionFinanciera.load(period)
        period_start = parse_period(period)
        for socio in socios:
            socio.becas_del_periodo = [
                scholarship
                for scholarship in getattr(socio, "becas_activas", ())
                if scholarship.covers_period(period_start)
                and not any(exc.periodo == period for exc in scholarship.exclusiones.all())
            ]
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
            if created is not None:
                created.append((period, socio, cuota))

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
            pending[cuota.pk] = max(Decimal("0.00"), cuota.movimiento.monto - applied.get(cuota.pk, Decimal("0.00")))
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
DISCOUNT_CONCEPTS = (ConceptoItemChoices.CONDONACION_MORA, ConceptoItemChoices.BECA, ConceptoItemChoices.DESCUENTO_UNICO)


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


def by_period(cuotas):
    return sorted(cuotas, key=lambda cuota: (cuota.periodo, cuota.pk))


def validate_payment_order(account, cuotas):
    account_cuotas = Cuota.objects.filter(movimiento__cuenta_corriente=account).select_related("movimiento")
    pending = pending_amounts(account_cuotas)
    open_ids = [cuota.pk for cuota in by_period(account_cuotas) if pending[cuota.pk] > 0]
    selected_ids = {cuota.pk for cuota in cuotas}
    if not selected_ids <= set(open_ids):
        raise PagoInvalidoError("No se pueden pagar cuotas ya saldadas.")
    if selected_ids != set(open_ids[:len(selected_ids)]):
        raise PagoInvalidoError("Las cuotas deben pagarse en orden, empezando por la más antigua.")


def validate_every_cuota_receives_payment(cuotas, total):
    pending = pending_amounts(cuotas)
    previous = sum((pending[cuota.pk] for cuota in by_period(cuotas)[:-1]), Decimal("0.00"))
    if total <= previous:
        raise PagoInvalidoError("El monto no alcanza para cubrir todas las cuotas seleccionadas.")


def waive_late_fees(cuotas, reason, authorized_by):
    pending = pending_amounts(cuotas)
    for cuota in by_period(cuotas):
        amount = unpaid_late_fees(cuota, list(cuota.items.all()), pending[cuota.pk])
        if amount <= 0:
            raise PagoInvalidoError(f"La cuota {cuota.periodo} no tiene recargos por mora pendientes.")
        ItemCuota.objects.create(
            cuota=cuota,
            concepto=ConceptoItemChoices.CONDONACION_MORA,
            es_descuento=True,
            fecha_aplicacion=timezone.localdate(),
            monto=amount,
            motivo=benefit_reason(reason),
            autorizado_por=authorized_by,
        )
        sync_cuota_charge(cuota)


@transaction.atomic
def register_payment(socio_id, cuota_ids, payment_methods, total, note="", user=None, late_fee_waiver=None):
    account = CuentaCorriente.objects.select_for_update().get(socio_id=socio_id)
    cuotas = lock_account_cuotas(account, cuota_ids)
    validate_payment_order(account, cuotas)
    if late_fee_waiver:
        waived = [cuota for cuota in cuotas if cuota.pk in set(late_fee_waiver["cuota_ids"])]
        waive_late_fees(waived, late_fee_waiver["motivo"], late_fee_waiver["autorizado_por"])
        account.refresh_from_db(fields=["saldo"])
        cuotas = lock_account_cuotas(account, cuota_ids)
    validate_payment_amount(pending_amounts(cuotas), total, "No se pueden pagar cuotas ya saldadas.")
    validate_every_cuota_receives_payment(cuotas, total)

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
    ) - sum(
        (item.monto for item in items if item.concepto == ConceptoItemChoices.CONDONACION_MORA),
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


def surcharge_reason(number):
    return f"Recargo por {number}° vencimiento"


def apply_cuota_surcharges(cuota_id, today=None, configuration=None):
    today = today or timezone.localdate()
    with transaction.atomic():
        cuota = lock_cuota(cuota_id)
        configuration = configuration or ConfiguracionFinanciera.load(cuota.periodo)
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
                    motivo=f"{surcharge_reason(number)} ({due:%d/%m/%Y})",
                    vencimiento=number,
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


def apply_surcharges(today=None, applied=None):
    today = today or timezone.localdate()
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
        for number, item in apply_cuota_surcharges(cuota_id, today):
            key = "recargos_primer_vencimiento" if number == 1 else "recargos_segundo_vencimiento"
            result[key] += 1
            result["monto_total"] += item.monto
            if applied is not None:
                applied.append((number, item))
    current_states = Cuota.objects.filter(pk__in=previous_states).values_list("pk", "estado_cuota")
    result["estados_actualizados"] = sum(1 for pk, state in current_states if previous_states[pk] != state)
    return result


def benefit_amount(mode, value, base):
    if mode == ModalidadMontoChoices.PORCENTAJE:
        return (base * value / Decimal("100")).quantize(Decimal("0.01"))
    return value


def has_active_payments(cuota):
    return applied_amount(cuota) > 0


def ensure_cuota_not_paid(cuota):
    if cuota.estado_cuota == EstadoCuotaChoices.PAGA:
        raise CuotaConPagosError("La cuota está paga: no se le pueden agregar ni quitar conceptos.")


def annul_item(item, reason, authorized_by="", user=None):
    item.estado = EstadoItemCuotaChoices.ANULADO
    item.fecha_anulacion = timezone.now()
    item.motivo_anulacion = benefit_reason(reason)
    item.anulado_por = authorized_by
    item.usuario_anulacion = user
    item.save(update_fields=["estado", "fecha_anulacion", "motivo_anulacion", "anulado_por", "usuario_anulacion"])


@transaction.atomic
def assign_benefit(cuota_id, kind, mode, value, start_date, reason, end_date=None, user=None, authorized_by=""):
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
            autorizado_por=authorized_by,
        )
        sync_cuota_charge(cuota)
        return None, item

    account = cuota.movimiento.cuenta_corriente
    scholarship = create_scholarship(account.socio_id, mode, value, start_date, end_date, reason, authorized_by, user)
    items = refresh_scholarship_items(account, SCHOLARSHIP_GRANTED_REASON, authorized_by, user)
    return scholarship, next((item for item in items if item.cuota_id == cuota.pk), None)


def scholarship_state(end_date, today=None):
    if end_date and end_date < (today or timezone.localdate()):
        return EstadoBecaChoices.FINALIZADA
    return EstadoBecaChoices.APLICADA


def create_scholarship(socio_id, mode, value, start_date, end_date, reason, authorized_by, user):
    return Beca.objects.create(
        socio_id=socio_id,
        monto=value if mode == ModalidadMontoChoices.MONTO_FIJO else None,
        porcentaje=value if mode == ModalidadMontoChoices.PORCENTAJE else None,
        fecha_aplicacion=start_date,
        fecha_fin=end_date,
        motivo=reason,
        autorizado_por=authorized_by,
        usuario=user,
        estado=scholarship_state(end_date),
    )


def scholarship_item(scholarship, cuota, amount):
    return ItemCuota.objects.create(
        cuota=cuota,
        concepto=ConceptoItemChoices.BECA,
        es_descuento=True,
        fecha_aplicacion=scholarship.fecha_aplicacion,
        monto=amount,
        motivo=benefit_reason(scholarship.motivo),
        autorizado_por=scholarship.autorizado_por,
        beca=scholarship,
    )


def apply_scholarship(scholarship, cuota):
    items = list(cuota.items.all())
    pending = pending_amounts([cuota])[cuota.pk]
    if pending <= 0 or not scholarship.covers_period(cuota_period_start(cuota)):
        return None
    # A scholarship larger than what is left to pay only covers the remaining amount
    amount = min(scholarship.discount_for(discount_base(items)), discountable_pending(cuota, items, pending))
    if amount <= 0:
        return None
    item = scholarship_item(scholarship, cuota, amount)
    sync_cuota_charge(cuota)
    return item


SCHOLARSHIP_GRANTED_REASON = "Beca recalculada por el alta de otra beca"
SCHOLARSHIP_UPDATED_REASON = "Beca modificada"


def is_linked_scholarship(item):
    return item.concepto == ConceptoItemChoices.BECA and item.beca_id is not None


def scholarship_amounts(items, scholarships):
    base = discount_base(items)
    available = base - sum(
        (item.monto for item in items if item.es_descuento and item.concepto != ConceptoItemChoices.CONDONACION_MORA),
        Decimal("0.00"),
    )
    amounts = {}
    for scholarship in scholarships:
        amount = min(scholarship.discount_for(base), max(available, Decimal("0.00")))
        if amount > 0:
            amounts[scholarship.pk] = amount
            available -= amount
    return amounts


def item_matches(item, scholarship, amount):
    return (
        item.monto == amount
        and item.motivo == benefit_reason(scholarship.motivo)
        and item.autorizado_por == scholarship.autorizado_por
    )


def rebuild_cuota_scholarships(cuota, scholarships, reason, authorized_by, user):
    items = list(cuota.items.all())
    current = {item.beca_id: item for item in items if is_linked_scholarship(item)}
    desired = scholarship_amounts([item for item in items if not is_linked_scholarship(item)], scholarships)
    by_id = {scholarship.pk: scholarship for scholarship in scholarships}

    outdated = [
        item for scholarship_id, item in current.items()
        if scholarship_id not in desired or not item_matches(item, by_id[scholarship_id], desired[scholarship_id])
    ]
    for item in outdated:
        annul_item(item, reason, authorized_by, user)
    kept = set(current) - {item.beca_id for item in outdated}
    created = [
        scholarship_item(by_id[scholarship_id], cuota, amount)
        for scholarship_id, amount in desired.items()
        if scholarship_id not in kept
    ]
    if outdated or created:
        sync_cuota_charge(cuota)
    return created


def add_missing_scholarships(cuota, scholarships):
    present = {item.beca_id for item in cuota.items.all() if is_linked_scholarship(item)}
    applied = [apply_scholarship(scholarship, cuota) for scholarship in scholarships if scholarship.pk not in present]
    return [item for item in applied if item]


def is_paid_with_money(cuota):
    return cuota.estado_cuota == EstadoCuotaChoices.PAGA and cuota.movimiento.monto > 0


def refresh_cuota_scholarships(cuota, socio_id, reason, authorized_by="", user=None):
    if has_active_payments(cuota):
        return add_missing_scholarships(cuota, list(scholarships_for_period(cuota_period_start(cuota)).filter(socio_id=socio_id)))
    if is_paid_with_money(cuota):
        return []
    scholarships = list(scholarships_for_period(cuota_period_start(cuota)).filter(socio_id=socio_id))
    return rebuild_cuota_scholarships(cuota, scholarships, reason, authorized_by, user)


def refresh_scholarship_items(account, reason, authorized_by="", user=None):
    cuotas = (
        Cuota.objects.select_for_update(of=("self",))
        .filter(movimiento__cuenta_corriente=account)
        .select_related("movimiento")
    )
    created = []
    for cuota in by_period(cuotas):
        created.extend(refresh_cuota_scholarships(cuota, account.socio_id, reason, authorized_by, user))
    return created


@transaction.atomic
def grant_scholarship(socio_id, mode, value, start_date, reason, authorized_by, end_date=None, user=None):
    account = CuentaCorriente.objects.select_for_update().select_related("socio__estado_administrativo").get(socio_id=socio_id)
    if account.socio.is_inactive:
        raise BeneficioInvalidoError("El socio está dado de baja: no corresponde otorgarle una beca.")
    scholarship = create_scholarship(socio_id, mode, value, start_date, end_date, reason, authorized_by, user)
    return scholarship, refresh_scholarship_items(account, SCHOLARSHIP_GRANTED_REASON, authorized_by, user)


def lock_scholarship(scholarship_id):
    socio_id = Beca.objects.values_list("socio_id", flat=True).get(pk=scholarship_id)
    account = CuentaCorriente.objects.select_for_update().get(socio_id=socio_id)
    scholarship = Beca.objects.select_for_update().get(pk=scholarship_id)
    if scholarship.estado != EstadoBecaChoices.APLICADA:
        raise BeneficioInvalidoError("Solo se pueden modificar o cancelar becas en estado Aplicada.")
    return account, scholarship


@transaction.atomic
def cancel_scholarship(scholarship_id, reason, authorized_by, user=None):
    account, scholarship = lock_scholarship(scholarship_id)
    scholarship.estado = EstadoBecaChoices.CANCELADA
    scholarship.fecha_cancelacion = timezone.now()
    scholarship.motivo_cancelacion = benefit_reason(reason)
    scholarship.cancelado_por = authorized_by
    scholarship.usuario_cancelacion = user
    scholarship.save(update_fields=[
        "estado", "fecha_cancelacion", "motivo_cancelacion", "cancelado_por", "usuario_cancelacion",
    ])
    refresh_scholarship_items(account, f"Beca cancelada: {reason}", authorized_by, user)
    return scholarship


@transaction.atomic
def update_scholarship(scholarship_id, mode, value, start_date, end_date, reason, authorized_by, user=None):
    account, scholarship = lock_scholarship(scholarship_id)
    scholarship.monto = value if mode == ModalidadMontoChoices.MONTO_FIJO else None
    scholarship.porcentaje = value if mode == ModalidadMontoChoices.PORCENTAJE else None
    scholarship.fecha_aplicacion = start_date
    scholarship.fecha_fin = end_date
    scholarship.motivo = reason
    scholarship.autorizado_por = authorized_by
    scholarship.estado = scholarship_state(end_date)
    scholarship.save(update_fields=[
        "monto", "porcentaje", "fecha_aplicacion", "fecha_fin", "motivo", "autorizado_por", "estado",
    ])
    refresh_scholarship_items(account, SCHOLARSHIP_UPDATED_REASON, authorized_by, user)
    return scholarship


def finish_expired_scholarships(today=None):
    today = today or timezone.localdate()
    finished = Beca.objects.filter(estado=EstadoBecaChoices.APLICADA, fecha_fin__lt=today).update(
        estado=EstadoBecaChoices.FINALIZADA,
    )
    return {"fecha": today.isoformat(), "becas_finalizadas": finished}


REMOVABLE_BENEFITS = (ConceptoItemChoices.BECA, ConceptoItemChoices.DESCUENTO_UNICO)


def remove_late_fee(cuota, item, reason, authorized_by, user):
    if not has_active_payments(cuota):
        annul_item(item, reason, authorized_by, user)
        return
    unpaid = unpaid_late_fees(cuota, list(cuota.items.all()), pending_amounts([cuota])[cuota.pk])
    amount = min(item.monto, unpaid)
    if amount <= 0:
        raise BeneficioInvalidoError("El recargo ya fue pagado y no puede quitarse.")
    ItemCuota.objects.create(
        cuota=cuota,
        concepto=ConceptoItemChoices.CONDONACION_MORA,
        es_descuento=True,
        fecha_aplicacion=timezone.localdate(),
        monto=amount,
        motivo=benefit_reason(reason),
        autorizado_por=authorized_by,
        vencimiento=item.vencimiento,
    )


def remove_benefit(cuota, item, reason, authorized_by, user):
    if has_active_payments(cuota):
        raise CuotaConPagosError("La cuota tiene pagos aplicados: no se le pueden quitar becas ni descuentos.")
    if item.beca_id:
        ExclusionBeca.objects.get_or_create(
            beca_id=item.beca_id,
            periodo=cuota.periodo,
            defaults={"motivo": benefit_reason(reason), "autorizado_por": authorized_by, "usuario": user},
        )
    annul_item(item, reason, authorized_by, user)


@transaction.atomic
def remove_cuota_item(item_id, reason, authorized_by, user=None):
    cuota = lock_cuota(ItemCuota.objects.values_list("cuota_id", flat=True).get(pk=item_id))
    item = ItemCuota.objects.select_for_update().get(pk=item_id)
    ensure_cuota_not_paid(cuota)
    if item.concepto == ConceptoItemChoices.MORA:
        remove_late_fee(cuota, item, reason, authorized_by, user)
    elif item.concepto in REMOVABLE_BENEFITS:
        remove_benefit(cuota, item, reason, authorized_by, user)
    else:
        raise BeneficioInvalidoError("Solo se pueden quitar recargos, becas y descuentos de la cuota.")
    sync_cuota_charge(cuota)
    return item


@transaction.atomic
def update_discount(item_id, mode, value, reason, authorized_by, user=None):
    cuota_id = ItemCuota.objects.values_list("cuota_id", flat=True).get(pk=item_id, concepto=ConceptoItemChoices.DESCUENTO_UNICO)
    cuota = lock_cuota(cuota_id)
    item = ItemCuota.objects.select_for_update().get(pk=item_id)
    ensure_cuota_not_paid(cuota)
    if has_active_payments(cuota):
        raise CuotaConPagosError("La cuota tiene pagos aplicados: no se puede modificar el descuento.")
    annul_item(item, "Descuento modificado", authorized_by, user)
    sync_cuota_charge(cuota)
    _, replacement = assign_benefit(
        cuota.pk, BENEFIT_DISCOUNT, mode, value, item.fecha_aplicacion, reason, user=user, authorized_by=authorized_by,
    )
    return replacement
