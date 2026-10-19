from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from padron.models import ESTADO_ADMINISTRATIVO_ACTIVO, Socio

from .models import OVERDUE_CUOTA_STATES, Cuota, EstadoCuotaChoices
from .services import pending_amounts

SCOPE_LABELS = {
    "activos": "Socios activos",
    "filtrados": "Filtros aplicados",
    "manual": "Selección manual",
    "socio": "Socio individual",
}
NO_CATEGORY = "Sin categoría"


class ReporteMorosidadInvalidoError(Exception):
    pass


def parse_delinquency_params(query_params):
    scope = query_params.get("alcance", "activos").strip().lower()
    if scope not in SCOPE_LABELS:
        raise ReporteMorosidadInvalidoError("El alcance debe ser activos, filtrados, manual o socio.")

    params = {"scope": scope}
    if scope == "manual":
        try:
            socio_ids = [int(value) for value in query_params.get("socio_ids", "").split(",") if value]
        except ValueError:
            raise ReporteMorosidadInvalidoError("La selección de socios no es válida.") from None
        if not socio_ids:
            raise ReporteMorosidadInvalidoError("Debe seleccionar al menos un socio.")
        params["socio_ids"] = socio_ids
    elif scope == "socio":
        try:
            params["socio_id"] = int(query_params.get("socio_id", ""))
        except ValueError:
            raise ReporteMorosidadInvalidoError("Debe indicar un socio válido.") from None
    elif scope == "filtrados":
        params["query"] = query_params.get("q", "").strip()
        params["category"] = query_params.get("categoria", "").strip()
    return params


def filter_socios(scope, socio_ids=None, socio_id=None, query="", category=""):
    socios = Socio.objects.select_related(
        "persona",
        "estado_administrativo",
        "jugador__categoria",
        "cuenta_corriente",
    )
    if scope == "activos":
        return socios.filter(estado_administrativo__nombre__iexact=ESTADO_ADMINISTRATIVO_ACTIVO)
    if scope == "manual":
        return socios.filter(socio_id__in=socio_ids)
    if scope == "socio":
        return socios.filter(socio_id=socio_id)

    for word in query.split():
        condition = (
            Q(persona__nombre__icontains=word)
            | Q(persona__apellido__icontains=word)
            | Q(persona__dni__icontains=word)
        )
        if word.isdigit():
            condition |= Q(numero_socio=int(word))
        socios = socios.filter(condition)

    if category.lower() == NO_CATEGORY.lower():
        socios = socios.filter(jugador__isnull=True)
    elif category:
        socios = socios.filter(jugador__categoria__nombre__iexact=category)
    return socios


def overdue_cuotas_by_account(socios):
    overdue = list(
        Cuota.objects.filter(
            movimiento__cuenta_corriente__socio__in=[socio.pk for socio in socios],
            estado_cuota__in=OVERDUE_CUOTA_STATES,
        )
        .select_related("movimiento")
    )
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
    return {
        "socio_id": socio.socio_id,
        "numero_socio": socio.numero_socio,
        "nombre": socio.persona.nombre,
        "apellido": socio.persona.apellido,
        "dni": socio.persona.dni,
        "categoria_deportiva": player.categoria.nombre if player else NO_CATEGORY,
        "monto_adeudado": sum((pending[cuota.pk] for cuota in cuotas), Decimal("0.00")),
        "cuotas_vencidas": len(cuotas),
        "cuotas_vencidas_1": count_by_state(cuotas, EstadoCuotaChoices.VENCIDA_1),
        "cuotas_vencidas_2": count_by_state(cuotas, EstadoCuotaChoices.VENCIDA_2),
        "dias_mora": max((today - cuota.fecha_venc1).days for cuota in cuotas),
    }


def delinquency_report(scope, **filters):
    today = timezone.localdate()
    socios = list(filter_socios(scope, **filters).order_by("persona__apellido", "persona__nombre"))
    cuotas_by_account, pending = overdue_cuotas_by_account(socios)

    rows = []
    without_account = 0
    for socio in socios:
        account = getattr(socio, "cuenta_corriente", None)
        if account is None:
            without_account += 1
            continue
        cuotas = cuotas_by_account.get(account.pk)
        if cuotas:
            rows.append(report_row(socio, cuotas, pending, today))

    return {
        "filas": rows,
        "fecha": timezone.localtime(),
        "alcance": SCOPE_LABELS[scope],
        "sin_cuenta": without_account,
    }
