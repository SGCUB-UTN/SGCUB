import logging
from django.utils import timezone
from configuracion.models import ConfiguracionGeneral
from comunicaciones.services import crear_y_despachar_notificacion
from .models import ESTADO_ADMINISTRATIVO_ACTIVO, Socio

logger = logging.getLogger(__name__)


def send_scheduled_birthday_greetings(today=None):
    """
    Tarea programada diaria (HU-22 / #78):
    Cruza la fecha actual con las fechas de nacimiento del padrón y despacha
    el mensaje de felicitación por email a los socios activos que cumplen años hoy.
    Registra obligatoriamente el resultado en Notificacion / EnvioNotificacion,
    asentando como fallida a aquellos socios que carezcan de contacto válido.
    """
    today = today or timezone.localdate()
    config = ConfiguracionGeneral.load()
    if not config.notificar_cumpleanos:
        logger.info("Saludos de cumpleaños desactivados en Configuración")
        return {"cumpleanieros": 0, "despachados": 0, "motivo": "notificar_cumpleanos desactivado"}

    club = config.club_nombre

    socios_cumple = list(
        Socio.objects.filter(
            estado_administrativo__nombre__iexact=ESTADO_ADMINISTRATIVO_ACTIVO,
            persona__fecha_nacimiento__month=today.month,
            persona__fecha_nacimiento__day=today.day,
        ).select_related("persona")
    )

    if not socios_cumple:
        logger.info("Saludos de cumpleaños: no hay socios de cumpleaños hoy (%s)", today)
        return {"cumpleanieros": 0, "despachados": 0, "fecha": today.isoformat()}

    plantilla = (config.mensaje_cumpleanos or "").strip()
    if not plantilla:
        plantilla = (
            "¡Hola {nombre}!\n\n"
            "Desde el {club} te enviamos nuestros saludos en este día tan especial. "
            "Esperamos que disfrutes de un muy feliz cumpleaños rodeado de tus seres queridos.\n\n"
            "¡Muchas gracias por ser parte de nuestra familia!\n\n"
            "Comisión Directiva"
        )

    enviados = 0
    for socio in socios_cumple:
        nombre = socio.persona.nombre
        titulo = "¡Feliz Cumpleaños!"
        asunto = f"¡Feliz Cumpleaños te desea {club}!"

        contenido = plantilla.replace("{nombre}", nombre).replace("{club}", club)

        crear_y_despachar_notificacion(
            titulo=titulo,
            asunto=asunto,
            contenido=contenido,
            socios=[socio],
        )
        enviados += 1

    logger.info("Saludos de cumpleaños despachados para %d socios", enviados)
    return {"cumpleanieros": len(socios_cumple), "despachados": enviados, "fecha": today.isoformat()}

