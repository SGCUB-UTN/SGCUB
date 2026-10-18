import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template import Context, Template
from django.utils.html import strip_tags

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
      <h1>Club Social y Deportivo - SGCUB</h1>
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


def enviar_email_individual(destinatario: str, asunto: str, contenido: str, envio_id: int = None  ) -> bool:
    """
    Envía un correo electrónico institucional a través del servicio Brevo SMTP.
    Actualiza el estado y detalle_fallo del EnvioNotificacion si se proporciona su ID.
    """
    asunto_completo = f"[SGCUB] {asunto}" if asunto else "[SGCUB] Comunicado Institucional"
    remitente = getattr(settings, "DEFAULT_FROM_EMAIL", "sgcub.notificaciones@gmail.com")

    try:
        # Renderizar plantilla HTML
        template = Template(HTML_EMAIL_TEMPLATE)
        context = Context({
            "asunto": asunto,
            "contenido":contenido + "\nClub Social y Deportivo - SGCUB"
        })
        html_content = template.render(context)
        text_content = f"{asunto}\n\n{contenido}\n\n---\nClub Social y Deportivo - SGCUB"

        msg = EmailMultiAlternatives(
            subject=asunto_completo,
            body=text_content,
            from_email=remitente,
            to=[destinatario],
        )
        msg.attach_alternative(html_content, "text/html")
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
        contacto = (envio.socio.persona.email or "").strip()
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
            envio.detalle_fallo = "Formato de dirección de correo electrónico inválido"
            envio.save(update_fields=["estado", "detalle_fallo"])

    logger.info(
        "Despacho completado para notificación %s: %d/%d envíos exitosos",
        notificacion_id,
        exitosos,
        total,
    )
