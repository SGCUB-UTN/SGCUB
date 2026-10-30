from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from configuracion.models import ConfiguracionGeneral
from padron.models import ESTADO_ADMINISTRATIVO_ACTIVO, Categoria, Socio

from .models import OVERDUE_CUOTA_STATES, Cuota, EstadoCuotaChoices
from .services import pending_amounts, unpaid_late_fees

SCOPE_LABELS = {
    "activos": "Todos los socios",
    "categoria": "Categoría",
    "socio": "Socio individual",
}
AFFILIATION_LABELS = {
    "todos": "Socios y jugadores",
    "socios": "Solo socios",
    "jugadores": "Solo jugadores",
}
PERIOD_LABELS = {
    "mensual": "Mensual",
    "trimestral": "Trimestral",
    "anual": "Anual",
}
NO_CATEGORY = "Sin categoría"
PLAYER_TYPE = "Jugador"
SOCIO_TYPE = "Socio"


class ReporteMorosidadInvalidoError(Exception):
    pass


def parse_positive_int(value, message):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ReporteMorosidadInvalidoError(message) from None
    if number <= 0:
        raise ReporteMorosidadInvalidoError(message)
    return number


def parse_period_window(period_type, reference):
    """Returns the first and last cuota period (AAAA-MM) the report covers, and its label."""
    reference = reference.strip().upper()
    try:
        if period_type == "mensual":
            year, month = (int(part) for part in reference.split("-"))
            if not 1 <= month <= 12:
                raise ValueError
            start = end = (year, month)
            label = f"{month:02d}/{year}"
        elif period_type == "trimestral":
            year, quarter = reference.split("-T")
            year, quarter = int(year), int(quarter)
            if not 1 <= quarter <= 4:
                raise ValueError
            start, end = (year, quarter * 3 - 2), (year, quarter * 3)
            label = f"{quarter}° trimestre {year}"
        else:
            year = int(reference)
            start, end = (year, 1), (year, 12)
            label = str(year)
    except ValueError:
        raise ReporteMorosidadInvalidoError("La referencia del período no es válida.") from None
    if not 1900 <= year <= 9999:
        raise ReporteMorosidadInvalidoError("La referencia del período no es válida.")
    return {
        "start": f"{start[0]:04d}-{start[1]:02d}",
        "end": f"{end[0]:04d}-{end[1]:02d}",
        "label": f"{PERIOD_LABELS[period_type]} · {label}",
    }


def parse_delinquency_params(query_params):
    scope = query_params.get("alcance", "activos").strip().lower()
    if scope not in SCOPE_LABELS:
        raise ReporteMorosidadInvalidoError("El alcance debe ser activos, categoria o socio.")
    affiliation = query_params.get("tipo", "todos").strip().lower()
    if affiliation not in AFFILIATION_LABELS:
        raise ReporteMorosidadInvalidoError("El tipo debe ser todos, socios o jugadores.")

    params = {"scope": scope, "affiliation": affiliation}
    if scope == "socio":
        params["socio_id"] = parse_positive_int(query_params.get("socio_id"), "Debe indicar un socio válido.")
    elif scope == "categoria":
        params["category_id"] = parse_positive_int(query_params.get("categoria_id"), "Debe indicar una categoría válida.")

    period_type = query_params.get("periodo", "").strip().lower()
    if period_type:
        if period_type not in PERIOD_LABELS:
            raise ReporteMorosidadInvalidoError("El período debe ser mensual, trimestral o anual.")
        params["period"] = parse_period_window(period_type, query_params.get("referencia", ""))
    return params


def filter_socios(scope, socio_id=None, category_id=None, affiliation="todos"):
    socios = Socio.objects.select_related(
        "persona",
        "estado_administrativo",
        "jugador__categoria",
        "cuenta_corriente",
    )
    if scope == "socio":
        socios = socios.filter(socio_id=socio_id)
    else:
        socios = socios.filter(estado_administrativo__nombre__iexact=ESTADO_ADMINISTRATIVO_ACTIVO)
    if scope == "categoria":
        socios = socios.filter(jugador__categoria_id=category_id)

    if affiliation == "socios":
        socios = socios.filter(jugador__isnull=True)
    elif affiliation == "jugadores":
        socios = socios.filter(jugador__isnull=False)
    return socios


def overdue_cuotas_by_account(socios, period=None):
    overdue = Cuota.objects.filter(
        movimiento__cuenta_corriente__socio__in=[socio.pk for socio in socios],
        estado_cuota__in=OVERDUE_CUOTA_STATES,
    )
    if period:
        overdue = overdue.filter(periodo__gte=period["start"], periodo__lte=period["end"])
    overdue = list(overdue.select_related("movimiento").prefetch_related("items"))
    pending = pending_amounts(overdue)
    by_account = {}
    for cuota in overdue:
        if pending[cuota.pk] > 0:
            by_account.setdefault(cuota.movimiento.cuenta_corriente_id, []).append(cuota)
    return by_account, pending


def count_by_state(cuotas, state):
    return sum(1 for cuota in cuotas if cuota.estado_cuota == state)


def report_row(socio, cuotas, pending, today):
    player = getattr(socio, "jugador", None)
    debt = sum((pending[cuota.pk] for cuota in cuotas), Decimal("0.00"))
    late_fees = sum(
        (min(unpaid_late_fees(cuota, list(cuota.items.all()), pending[cuota.pk]), pending[cuota.pk]) for cuota in cuotas),
        Decimal("0.00"),
    )
    return {
        "socio_id": socio.socio_id,
        "jugador_id": player.jugador_id if player else None,
        "numero_socio": socio.numero_socio,
        "nombre": socio.persona.nombre,
        "apellido": socio.persona.apellido,
        "dni": socio.persona.dni,
        "tipo": PLAYER_TYPE if player else SOCIO_TYPE,
        "categoria_deportiva": player.categoria.nombre if player and player.categoria else NO_CATEGORY,
        "monto_adeudado": debt,
        "capital": debt - late_fees,
        "recargos": late_fees,
        "cuotas_vencidas": len(cuotas),
        "cuotas_vencidas_1": count_by_state(cuotas, EstadoCuotaChoices.VENCIDA_1),
        "cuotas_vencidas_2": count_by_state(cuotas, EstadoCuotaChoices.VENCIDA_2),
        "dias_mora": max((today - cuota.fecha_venc1).days for cuota in cuotas),
    }


def affected_categories(rows):
    by_category = {}
    for row in rows:
        if row["tipo"] == PLAYER_TYPE and row["categoria_deportiva"] != NO_CATEGORY:
            name = row["categoria_deportiva"]
            category = by_category.setdefault(name, {"nombre": name, "morosos": 0, "monto": Decimal("0.00")})
            category["morosos"] += 1
            category["monto"] += row["monto_adeudado"]
    return sorted(by_category.values(), key=lambda category: (-category["monto"], category["nombre"]))


def delinquency_percentage(delinquent, roster):
    if not roster:
        return Decimal("0.0")
    return (Decimal(delinquent * 100) / Decimal(roster)).quantize(Decimal("0.1"))


def scope_label(scope, category_id=None, **_):
    if scope == "categoria":
        category = Categoria.objects.filter(pk=category_id).first()
        if category:
            return f"Categoría {category.nombre}"
    return SCOPE_LABELS[scope]


def delinquency_report(scope, period=None, **filters):
    today = timezone.localdate()
    socios = list(filter_socios(scope, **filters).order_by("persona__apellido", "persona__nombre"))
    cuotas_by_account, pending = overdue_cuotas_by_account(socios, period)
    # Overdue cuotas a socio needs to count as delinquent
    threshold = ConfiguracionGeneral.load().cuotas_vencidas_morosidad

    rows = []
    without_account = 0
    for socio in socios:
        account = getattr(socio, "cuenta_corriente", None)
        if account is None:
            without_account += 1
            continue
        cuotas = cuotas_by_account.get(account.pk)
        if cuotas and len(cuotas) >= threshold:
            rows.append(report_row(socio, cuotas, pending, today))

    return {
        "filas": rows,
        "fecha": timezone.localtime(),
        "alcance": scope_label(scope, **filters),
        "tipo": AFFILIATION_LABELS[filters.get("affiliation", "todos")],
        "periodo": period["label"] if period else "Todos los períodos",
        "sin_cuenta": without_account,
        "cuotas_vencidas_minimas": threshold,
        "padron": len(socios),
        "monto_total": sum((row["monto_adeudado"] for row in rows), Decimal("0.00")),
        "porcentaje_morosidad": delinquency_percentage(len(rows), len(socios)),
        "categorias_afectadas": affected_categories(rows),
    }
