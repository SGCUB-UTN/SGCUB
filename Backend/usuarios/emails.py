import logging
from email.utils import formataddr

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from configuracion.models import ConfiguracionGeneral

logger = logging.getLogger(__name__)

RESET_EMAIL_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background: #00A9D8; padding: 24px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700;">{{ club }}</h1>
      <p style="margin: 4px 0 0; font-size: 13px;">Restablecer contraseña</p>
    </div>
    <div style="padding: 32px; font-size: 15px; line-height: 1.6; color: #334155;">
      <h2 style="font-size: 18px; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Hola {{ nombre }},</h2>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en {{ club }}.</p>
      <p>Hacé clic en el botón de abajo para elegir una nueva contraseña:</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="{{ reset_url }}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px;">Restablecer contraseña</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">O copiá y pegá este enlace en tu navegador:</p>
      <p style="font-size: 13px; color: #2563eb; word-break: break-all;">{{ reset_url }}</p>
      <p style="margin-top: 24px; font-size: 13px; color: #64748b;">Este enlace expira en 24 horas. Si no solicitaste el cambio, ignorá este correo: tu contraseña actual sigue vigente.</p>
    </div>
    <div style="background: #f1f5f9; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0;">Correo automático generado por {{ club }}.</p>
    </div>
  </div>
</body>
</html>
"""


def enviar_email_password_reset(user, reset_url):
    """Envía el mail de recuperación de contraseña. Devuelve True si lo despachó."""
    configuracion = ConfiguracionGeneral.load()
    remitente = getattr(settings, "DEFAULT_FROM_EMAIL", "sgcub.notificaciones@gmail.com")
    if configuracion.email_nombre_remitente:
        remitente = formataddr((configuracion.email_nombre_remitente, remitente))

    nombre = user.get_full_name() or user.username
    asunto = f"[{configuracion.club_nombre}] Restablecer contraseña"

    html_body = (
        RESET_EMAIL_TEMPLATE
        .replace("{{ club }}", configuracion.club_nombre)
        .replace("{{ nombre }}", nombre)
        .replace("{{ reset_url }}", reset_url)
    )
    text_body = (
        f"Hola {nombre},\n\n"
        f"Recibimos una solicitud para restablecer tu contraseña en {configuracion.club_nombre}.\n\n"
        f"Abrí este enlace para elegir una nueva: {reset_url}\n\n"
        f"El enlace expira en 24 horas. Si no lo solicitaste, ignorá este correo.\n"
    )

    try:
        msg = EmailMultiAlternatives(
            subject=asunto,
            body=text_body,
            from_email=remitente,
            to=[user.email],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        logger.info("Password reset enviado a user_id=%s (%s)", user.pk, user.email)
        return True
    except Exception as exc:
        logger.error("Error al enviar password reset a user_id=%s: %s", user.pk, exc)
        return False