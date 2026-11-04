import logging
from email.utils import formataddr
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template import Context, Template
from django.utils.html import strip_tags

from configuracion.models import ConfiguracionGeneral

from .models import CanalNotificacion, EnvioNotificacion, EstadoNotificacion, Notificacion

logger = logging.getLogger(__name__)

HTML_EMAIL_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 24px;
      color: #1e293b;
    }
    .card {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: #00A9D8;
      padding: 24px 32px;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .header p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #ffffff;
    }    
    .content {
      padding: 32px;
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
    }
    .content h2 {
      font-size: 18px;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .message-body {
      background: #f8fafc;
      border-left: 4px solid #2563eb;
      padding: 16px;
      border-radius: 4px;
      white-space: pre-wrap;
      font-size: 14px;
      line-height: 1.6;
    }
    .footer {
      background: #f1f5f9;
      padding: 20px 32px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .footer img {
      display: block;
      margin: 0 auto 12px;
      width: 110px;
      height: auto;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>{{ club }}</h1>
      <p>Canal Oficial de Comunicaciones Institucionales</p>
    </div>
    <div class="content">
      <h2>{{ asunto }}</h2>
      <div class="message-body">{{ contenido }}</div>
    </div>
    <div class="footer">
      <p>Este es un comunicado institucional automático generado por el Sistema de Gestion Club Universitario Beriso.</p>
      <p>Por favor, no responda directamente a este correo.</p>
    </div>
  </div>
</body>
</html>
"""


def obtener_contacto_socio(socio):
    """
    Retorna una tupla: (email, nombre_destinatario, detalle_error)
    Si el socio es menor de 18 años, prioriza el contacto del responsable legal
    registrado en sus vínculos familiares.
    """
    persona = getattr(socio, "persona", None)
    if not persona:
        return None, "", "El socio no posee persona asociada"

    nombre_socio = f"{persona.nombre} {persona.apellido}".strip()
    edad = persona.edad

    # Si es menor de 18 años
    if edad is not None and edad < 18:
        jugador = getattr(socio, "jugador", None)
        if jugador:
            # Buscar responsable legal con email válido
            tutor = (
                jugador.vinculos_familiares.filter(
                    responsable_legal=True,
                    persona__email__isnull=False,
                )
                .exclude(persona__email="")
                .select_related("persona")
                .first()
            )
            if tutor and tutor.persona.email and "@" in tutor.persona.email:
                nombre_tutor = f"{tutor.persona.nombre} {tutor.persona.apellido}".strip()
                return tutor.persona.email.strip(), f"{nombre_tutor} (Responsable de {nombre_socio})", None

            # Si no hay responsable legal con email, buscar cualquier vínculo familiar con email
            otro_familiar = (
                jugador.vinculos_familiares.filter(
                    persona__email__isnull=False,
                )
                .exclude(persona__email="")
                .select_related("persona")
                .first()
            )
            if otro_familiar and otro_familiar.persona.email and "@" in otro_familiar.persona.email:
                nombre_fam = f"{otro_familiar.persona.nombre} {otro_familiar.persona.apellido}".strip()
                return otro_familiar.persona.email.strip(), f"{nombre_fam} (Contacto de {nombre_socio})", None

        # Si el menor tiene email propio registrado
        if persona.email and "@" in persona.email:
            return persona.email.strip(), nombre_socio, None

        return None, nombre_socio, "Socio menor de edad sin correo de contacto responsable registrado"

    # Mayor de edad (o sin fecha de nacimiento informada)
    if persona.email and "@" in persona.email:
        return persona.email.strip(), nombre_socio, None

    return None, nombre_socio, "El socio no tiene una dirección de correo electrónico válida"


def enviar_email_individual(
    destinatario: str,
    asunto: str,
    contenido: str,
    envio_id: int = None,
    adjuntos: list = None,
) -> bool:
    """
    Envía un correo electrónico institucional a través del servicio Brevo SMTP.
    Actualiza el estado y detalle_fallo del EnvioNotificacion si se proporciona su ID.
    `adjuntos` puede ser una lista de tuplas (filename, content_bytes, mimetype) o (filename, content_bytes).
    """
    asunto_completo = f"[SGCUB] {asunto}" if asunto else "[SGCUB] Comunicado Institucional"
    configuracion = ConfiguracionGeneral.load()
    remitente = getattr(settings, "DEFAULT_FROM_EMAIL", "sgcub.notificaciones@gmail.com")
    if configuracion.email_nombre_remitente:
        remitente = formataddr((configuracion.email_nombre_remitente, remitente))
    firma = configuracion.email_firma

    try:
        # Renderizar plantilla HTML
        template = Template(HTML_EMAIL_TEMPLATE)
        context = Context({
            "asunto": asunto,
            "club": configuracion.club_nombre,
            "contenido": f"{contenido}\n{firma}" if firma else contenido,
        })
        html_content = template.render(context)
        text_content = f"{asunto}\n\n{contenido}\n\n---\n{firma}"

        msg = EmailMultiAlternatives(
            subject=asunto_completo,
            body=text_content,
            from_email=remitente,
            to=[destinatario],
        )
        msg.attach_alternative(html_content, "text/html")

        if adjuntos:
            for item in adjuntos:
                if len(item) == 3:
                    nombre_archivo, contenido_bytes, mimetype = item
                    msg.attach(nombre_archivo, contenido_bytes, mimetype)
                elif len(item) == 2:
                    nombre_archivo, contenido_bytes = item
                    msg.attach(nombre_archivo, contenido_bytes)

        msg.send(fail_silently=False)

        if envio_id:
            EnvioNotificacion.objects.filter(id=envio_id).update(
                estado=EstadoNotificacion.ENVIADA,
                detalle_fallo="",
            )

        logger.info("Correo enviado exitosamente a %s via Brevo SMTP", destinatario)
        return True

    except Exception as exc:
        detalle = str(exc)
        logger.error("Fallo al enviar correo a %s via Brevo SMTP: %s", destinatario, detalle)

        if envio_id:
            EnvioNotificacion.objects.filter(id=envio_id).update(
                estado=EstadoNotificacion.FALLIDA,
                detalle_fallo=detalle[:500],
            )

        return False


def crear_y_despachar_notificacion(
    titulo: str,
    asunto: str,
    contenido: str,
    socios: list,
    adjuntos: list = None,
    canal: str = CanalNotificacion.MAIL,
) -> Notificacion:
    """
    Crea un registro de Notificación con sus EnvioNotificacion y despacha los correos.
    Actualiza el estado de la notificación según los envíos resultantes.
    """
    notificacion = Notificacion.objects.create(
        titulo=titulo,
        asunto=asunto,
        contenido=contenido,
        estado=EstadoNotificacion.PROGRAMADA,
    )

    exitosos = 0
    total = len(socios)

    for socio in socios:
        envio = EnvioNotificacion.objects.create(
            socio=socio,
            notificacion=notificacion,
            canal=canal,
            estado=EstadoNotificacion.PROGRAMADA,
        )

        email, _, error = obtener_contacto_socio(socio)
        if email and "@" in email:
            ok = enviar_email_individual(
                destinatario=email,
                asunto=asunto or titulo,
                contenido=contenido,
                envio_id=envio.pk,
                adjuntos=adjuntos,
            )
            if ok:
                envio.estado = EstadoNotificacion.ENVIADA
                envio.save(update_fields=["estado"])
                exitosos += 1
        else:
            envio.estado = EstadoNotificacion.FALLIDA
            envio.detalle_fallo = error or "Formato de dirección de correo electrónico inválido"
            envio.save(update_fields=["estado", "detalle_fallo"])

    if total == 0 or exitosos > 0:
        notificacion.estado = EstadoNotificacion.ENVIADA
    else:
        notificacion.estado = EstadoNotificacion.FALLIDA
    notificacion.save(update_fields=["estado"])

    return notificacion


def despachar_notificacion_asincrona(
    titulo: str,
    asunto: str,
    contenido: str,
    socio_ids: list,
    adjuntos: list = None,
    canal: str = CanalNotificacion.MAIL,
):
    from padron.models import Socio

    socios = list(Socio.objects.filter(pk__in=socio_ids).select_related("persona"))
    return crear_y_despachar_notificacion(
        titulo=titulo,
        asunto=asunto,
        contenido=contenido,
        socios=socios,
        adjuntos=adjuntos,
        canal=canal,
    )


def despachar_envios_email_notificacion(notificacion_id: int):
    """
    Busca todos los envíos de canal MAIL para una notificación y los despacha mediante Brevo.
    Actualiza el estado final de la notificación según los resultados.
    """
    try:
        notificacion = Notificacion.objects.get(id=notificacion_id)
    except Notificacion.DoesNotExist:
        logger.error("Notificación ID %s no encontrada para despachar", notificacion_id)
        return

    envios_mail = notificacion.envios.filter(canal=CanalNotificacion.MAIL)
    if not envios_mail.exists():
        return

    total = envios_mail.count()
    exitosos = 0

    for envio in envios_mail:
        email, _, detalle_error = obtener_contacto_socio(envio.socio)
        contacto = (email or "").strip()
        if "@" in contacto:
            resultado = enviar_email_individual(
                destinatario=contacto,
                asunto=notificacion.asunto or notificacion.titulo,
                contenido=notificacion.contenido,
                envio_id=envio.id,
            )
            if resultado:
                exitosos += 1
        else:
            envio.estado = EstadoNotificacion.FALLIDA
            envio.detalle_fallo = detalle_error or "Formato de dirección de correo electrónico inválido"
            envio.save(update_fields=["estado", "detalle_fallo"])

    logger.info(
        "Despacho completado para notificación %s: %d/%d envíos exitosos",
        notificacion_id,
        exitosos,
        total,
    )
