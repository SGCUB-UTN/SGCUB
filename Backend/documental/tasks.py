import logging
from django.db.models import OuterRef, Subquery
from django.utils import timezone
from configuracion.models import ConfiguracionGeneral
from comunicaciones.services import crear_y_despachar_notificacion, enviar_email_individual
from .models import Documento, EstadoDocumento

logger = logging.getLogger(__name__)


def refresh_document_states(enviar_alertas=True):
    """
    Tarea programada diaria (HU-16 / #75):
    1. Actualiza el estado documental entre 'Vigente' y 'Vencido' según la fecha actual.
    2. Emite alertas preventivas a los 'dias_alerta_documentos' (por defecto 30 días)
       y al momento del vencimiento, notificando al jugador/socio o docente (o responsable legal si es menor).
    3. Al renovar un documento, la alerta se resuelve automáticamente al pasar a 'Vigente'.
    """
    today = timezone.localdate()
    estados = {estado.nombre: estado for estado in EstadoDocumento.objects.filter(nombre__in=["Vigente", "Vencido"])}
    if len(estados) < 2:
        return {"documentos_actualizados": 0, "alertas_enviadas": 0}

    vencidos_actualizados = (
        Documento.objects.filter(fecha_vencimiento__date__lt=today)
        .exclude(estado_documento=estados["Vencido"])
        .update(estado_documento=estados["Vencido"])
    )
    vigentes_actualizados = (
        Documento.objects.exclude(fecha_vencimiento__date__lt=today)
        .exclude(estado_documento=estados["Vigente"])
        .update(estado_documento=estados["Vigente"])
    )
    total_actualizados = vencidos_actualizados + vigentes_actualizados

    if not enviar_alertas:
        return {
            "documentos_actualizados": total_actualizados,
            "alertas_enviadas": 0,
        }

    # Alertas preventivas
    config = ConfiguracionGeneral.load()
    dias_alerta = config.dias_alerta_documentos or 30
    club = config.club_nombre

    latest_docs = Documento.objects.filter(
        persona=OuterRef("persona"),
        tipo_documento=OuterRef("tipo_documento"),
    ).order_by("-id_documento")

    documentos = (
        Documento.objects.filter(id_documento=Subquery(latest_docs.values("id_documento")[:1]))
        .exclude(fecha_vencimiento__isnull=True)
        .select_related(
            "tipo_documento",
            "persona",
            "persona__socio",
            "persona__socio__jugador__estado",
            "persona__socio__estado_administrativo",
            "persona__docente__estado",
        )
    )

    alertas_enviadas = 0
    for doc in documentos:
        persona = doc.persona
        # Verificar que la persona esté activa
        is_active = False
        socio = getattr(persona, "socio", None)
        if socio:
            jugador = getattr(socio, "jugador", None)
            if jugador and jugador.estado and jugador.estado.nombre == "Activo":
                is_active = True
            elif socio.estado_administrativo and socio.estado_administrativo.nombre == "Activo":
                is_active = True

        docente = getattr(persona, "docente", None)
        if docente and docente.estado and docente.estado.nombre == "Activo":
            is_active = True

        if not is_active:
            continue

        vencimiento = timezone.localtime(doc.fecha_vencimiento).date()
        dias_restantes = (vencimiento - today).days

        # Notificar a los 'dias_alerta' días exactos (ej. 30 días) o el día exacto de vencimiento (0 días)
        if dias_restantes == dias_alerta or dias_restantes == 0:
            if dias_restantes == dias_alerta and doc.alerta_previa_enviada:
                continue
            if dias_restantes == 0 and doc.alerta_vencido_enviada:
                continue

            tipo_nombre = doc.tipo_documento.nombre
            venc_str = vencimiento.strftime("%d/%m/%Y")
            if dias_restantes == 0:
                motivo = "ha vencido en el día de hoy"
            else:
                motivo = f"vencerá en {dias_restantes} días (el {venc_str})"

            titulo = f"Vencimiento de documentación: {tipo_nombre}"
            asunto = f"Aviso de vencimiento: {tipo_nombre} - {club}"

            contenido = (
                f"Estimado/a {persona.nombre},\n\n"
                f"Te informamos que tu documentación '{tipo_nombre}' {motivo}.\n\n"
                f"Por favor acercate a la secretaría del club o gestioná la renovación médica/documental "
                f"correspondiente para mantener tu legajo al día y evitar suspensiones preventivas.\n\n"
                f"¡Muchas gracias!\n"
                f"{club}"
            )

            enviado = False
            if socio:
                crear_y_despachar_notificacion(
                    titulo=titulo,
                    asunto=asunto,
                    contenido=contenido,
                    socios=[socio],
                )
                enviado = True
                alertas_enviadas += 1
            elif persona.email and "@" in persona.email:
                enviar_email_individual(
                    destinatario=persona.email.strip(),
                    asunto=asunto,
                    contenido=contenido,
                )
                enviado = True
                alertas_enviadas += 1

            if enviado:
                if dias_restantes == dias_alerta:
                    doc.alerta_previa_enviada = True
                    doc.save(update_fields=["alerta_previa_enviada"])
                elif dias_restantes == 0:
                    doc.alerta_vencido_enviada = True
                    doc.save(update_fields=["alerta_vencido_enviada"])
    return {
        "documentos_actualizados": total_actualizados,
        "alertas_enviadas": alertas_enviadas,
    }
