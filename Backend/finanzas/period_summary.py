from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from .generators import PERIOD_FORMAT
from .models import ConceptoItemChoices, ConfiguracionFinanciera, Cuota, EjecucionTareaCuota, TipoTareaCuotaChoices
from .services import due_date, net_amount, parse_period, pending_amounts
from .tasks import SURCHARGE_TASKS, period_due_dates

MEMBER = "Socio"
PLAYER = "Jugador"
PARTIAL_LEAVE = "BajaParcial"
DONE = "done"
PENDING = "pending"
MISSED = "missed"
DUE_PHASE_KEYS = {1: "first_due", 2: "second_due"}
ZERO = Decimal("0.00")


def requested_period(value=None):
    return parse_period(value or timezone.localdate().strftime(PERIOD_FORMAT)).strftime(PERIOD_FORMAT)


def available_periods(today=None):
    today = today or timezone.localdate()
    periods = set(Cuota.objects.values_list("periodo", flat=True).distinct())
    periods.add(today.strftime(PERIOD_FORMAT))
    return sorted(periods, reverse=True)


def period_cuotas(period):
    return list(
        Cuota.objects.filter(periodo=period, movimiento__isnull=False)
        .select_related(
            "movimiento__cuenta_corriente__socio__persona",
            "movimiento__cuenta_corriente__socio__jugador__estado",
        )
        .prefetch_related("items")
        .order_by("pk")
    )


def cuota_socio(cuota):
    return cuota.movimiento.cuenta_corriente.socio


def cuota_type(cuota):
    if any(item.concepto == ConceptoItemChoices.CUOTA_DEPORTIVA for item in cuota.items.all()):
        return PLAYER
    player = getattr(cuota_socio(cuota), "jugador", None)
    if player is None:
        return MEMBER
    return PLAYER if player.is_active else PARTIAL_LEAVE


def cuota_surcharges(items):
    total = ZERO
    for item in items:
        if item.concepto == ConceptoItemChoices.MORA:
            total += item.monto
        elif item.concepto == ConceptoItemChoices.CONDONACION_MORA:
            total -= item.monto
    return total


def empty_group():
    return {"generated": 0, "billed": ZERO, "collected": ZERO, "unpaid": 0, "unpaid_amount": ZERO}


def add_to_group(group, cuota, pending):
    group["generated"] += 1
    group["billed"] += cuota.movimiento.monto
    group["collected"] += max(ZERO, cuota.movimiento.monto - pending)
    if pending > 0:
        group["unpaid"] += 1
        group["unpaid_amount"] += pending


def collection_rate(group):
    if group["billed"] <= 0:
        return None
    return (group["collected"] * 100 / group["billed"]).quantize(Decimal("0.1"))


def successful_runs(period):
    runs = EjecucionTareaCuota.objects.filter(periodo=period, exitosa=True).order_by("fecha_inicio", "pk")
    return {run.tipo: run for run in runs}


def due_of(cuota, number):
    return cuota.fecha_venc1 if number == 1 else cuota.fecha_venc2


def surcharge_status(number, due, cuotas, pending, run, today):
    if run is not None:
        return DONE
    if today <= due:
        return PENDING
    overdue = [cuota for cuota in cuotas if pending[cuota.pk] > 0 and due_of(cuota, number) < today]
    if cuotas and all(cuota.recargos_aplicados >= number for cuota in overdue):
        return DONE
    return MISSED


def billing_phases(period, cuotas, pending, today):
    runs = successful_runs(period)
    generation_run = runs.get(TipoTareaCuotaChoices.GENERACION)
    generation_date = due_date(parse_period(period), ConfiguracionFinanciera.load(period).dia_generacion)
    if generation_run is not None:
        generated_at = generation_run.fecha_inicio
    else:
        generated_at = min((cuota.fecha_creacion for cuota in cuotas), default=None)
    phases = [{
        "key": "generation",
        "date": generation_date,
        "executed_at": generated_at,
        "status": DONE if cuotas else (PENDING if today <= generation_date else MISSED),
    }]
    for number, due in period_due_dates(period).items():
        run = runs.get(SURCHARGE_TASKS[number])
        phases.append({
            "key": DUE_PHASE_KEYS[number],
            "date": due,
            "run_date": due + timedelta(days=1),
            "executed_at": run.fecha_inicio if run else None,
            "status": surcharge_status(number, due, cuotas, pending, run, today),
        })
    return phases


def period_summary(period, today=None):
    today = today or timezone.localdate()
    cuotas = period_cuotas(period)
    pending = pending_amounts(cuotas)
    members, players, total = empty_group(), empty_group(), empty_group()
    partial_leave = {"generated": 0, "unpaid": 0}
    for cuota in cuotas:
        kind = cuota_type(cuota)
        add_to_group(members if kind == MEMBER else players, cuota, pending[cuota.pk])
        add_to_group(total, cuota, pending[cuota.pk])
        if kind == PARTIAL_LEAVE:
            partial_leave["generated"] += 1
            partial_leave["unpaid"] += int(pending[cuota.pk] > 0)
    return {
        "period": period,
        "periods": available_periods(today),
        "today": today,
        "phases": billing_phases(period, cuotas, pending, today),
        "totals": {**total, "collection_rate": collection_rate(total)},
        "members": members,
        "players": {**players, "partial_leave": partial_leave},
    }


def unpaid_cuotas(period):
    cuotas = period_cuotas(period)
    pending = pending_amounts(cuotas)
    rows = []
    for cuota in cuotas:
        if pending[cuota.pk] <= 0:
            continue
        socio = cuota_socio(cuota)
        person = socio.persona
        player = getattr(socio, "jugador", None)
        items = list(cuota.items.all())
        surcharges = cuota_surcharges(items)
        rows.append({
            "cuota_id": cuota.pk,
            "periodo": cuota.periodo,
            "estado_cuota": cuota.estado_cuota,
            "fecha_venc1": cuota.fecha_venc1,
            "fecha_venc2": cuota.fecha_venc2,
            "socio_id": socio.pk,
            "jugador_id": player.pk if player else None,
            "numero_socio": socio.numero_socio,
            "nombre": person.nombre,
            "apellido": person.apellido,
            "dni": person.dni,
            "email": person.email or "",
            "type": cuota_type(cuota),
            "cuota_amount": net_amount(items) - surcharges,
            "surcharges": surcharges,
            "pending": pending[cuota.pk],
        })
    return rows
