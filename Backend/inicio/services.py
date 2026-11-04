from collections import Counter
from datetime import timedelta

from django.db.models import Count, Max
from django.utils import timezone

from comunicaciones.models import CanalNotificacion, EnvioNotificacion, EstadoNotificacion, OrigenNotificacion
from documental.services import (
    FALTANTE,
    PERFIL_DOCENTE,
    PERFIL_JUGADOR,
    POR_VENCER,
    PROFILES,
    VENCIDO,
    VIGENTE,
    build_padron_documental,
)
from finanzas.generators import PERIOD_FORMAT
from finanzas.models import EjecucionTareaCuota, OrigenEjecucionChoices, TipoTareaCuotaChoices
from finanzas.period_summary import cuota_situation
from finanzas.tasks import MEMBER_GROUPS, active_socios, member_group
from padron.models import RecategorizacionEjecucion, get_anio_actual
from padron.services import categories_status, mark_stale_runs_as_failed

MAIL_FAILURE_DAYS = 7


def member_counts():
    counts = dict.fromkeys(MEMBER_GROUPS, 0)
    for socio in active_socios():
        counts[member_group(socio)] += 1
    return counts


def recategorization_status(year):
    mark_stale_runs_as_failed()
    latest = (
        RecategorizacionEjecucion.objects.filter(anio=year)
        .exclude(estado=RecategorizacionEjecucion.EstadoChoices.FALLIDA)
        .order_by("-fecha_inicio", "-pk")
        .first()
    )
    return {"executed": latest is not None, "status": latest.estado if latest else None}


def last_generation():
    run = EjecucionTareaCuota.objects.filter(
        tipo=TipoTareaCuotaChoices.GENERACION,
        origen=OrigenEjecucionChoices.AUTOMATICA,
    ).first()
    if run is None:
        return None
    return {
        "period": run.periodo,
        "executed_at": run.fecha_inicio,
        "successful": run.exitosa,
        "summary": run.resumen,
    }


def mail_failures(now):
    failures = EnvioNotificacion.objects.filter(
        canal=CanalNotificacion.MAIL,
        estado=EstadoNotificacion.FALLIDA,
        notificacion__origen=OrigenNotificacion.AUTOMATICA,
        fecha_envio__gte=now - timedelta(days=MAIL_FAILURE_DAYS),
    ).aggregate(count=Count("pk"), last_failure_at=Max("fecha_envio"))
    return {"days": MAIL_FAILURE_DAYS, **failures}


def documentation_status():
    personas = build_padron_documental()["personas"]
    profiles = {perfil: {"total": 0, "up_to_date": 0} for perfil in PROFILES}
    documents = Counter()
    for persona in personas:
        profiles[persona["perfil"]]["total"] += 1
        profiles[persona["perfil"]]["up_to_date"] += int(persona["habilitado"])
        documents.update(documento["estado"] for documento in persona["documentos"])
    return {
        "players": profiles[PERFIL_JUGADOR],
        "teachers": profiles[PERFIL_DOCENTE],
        "documents": {
            "valid": documents[VIGENTE] + documents[POR_VENCER],
            "missing": documents[FALTANTE],
            "expired": documents[VENCIDO],
        },
    }


def home_summary():
    now = timezone.now()
    year = get_anio_actual()
    return {
        "members": member_counts(),
        "cuotas": cuota_situation(timezone.localdate().strftime(PERIOD_FORMAT)),
        "alerts": {
            "categories_updated": categories_status()["actualizadas"],
            "recategorization": recategorization_status(year),
            "last_generation": last_generation(),
            "mail_failures": mail_failures(now),
            "backup": {"configured": False},
        },
        "documentation": documentation_status(),
    }
