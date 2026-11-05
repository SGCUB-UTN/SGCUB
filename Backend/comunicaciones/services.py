import logging
from email.mime.image import MIMEImage
from email.utils import formataddr
from pathlib import Path
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template import Context, Template
from django.utils.html import strip_tags

from configuracion.models import ConfiguracionGeneral

from .models import CanalNotificacion, EnvioNotificacion, EstadoNotificacion, Notificacion, OrigenNotificacion

logger = logging.getLogger(__name__)

ESCUDO_DEFAULT_PATH = Path(__file__).resolve().parent / "escudo.png"

HTML_EMAIL_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      margin: 0;
      padding: 28px 16px;
      color: #1e293b;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      overflow: hidden;
    }
    .header {
      background-color: #0f172a;
      padding: 20px 28px;
      color: #f8fafc;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
    }
    .header-logo-cell {
      width: 52px;
      vertical-align: middle;
      padding-right: 14px;
    }
    .header-logo {
      width: 44px;
      height: 44px;
      object-fit: contain;
      display: block;
    }
    .header-text-cell {
      vertical-align: middle;
    }
    .header h1 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.01em;
    }
    .header p {
      margin: 2px 0 0;
      font-size: 12px;
      color: #94a3b8;
    }
    .content {
      padding: 28px;
      font-size: 14px;
      line-height: 1.65;
      color: #334155;
    }
    .subject-title {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 16px 0;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .message-body {
      white-space: pre-wrap;
      font-size: 14px;
      line-height: 1.7;
      color: #1e293b;
    }
    .signature {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      color: #475569;
    }
    .signature strong {
      display: block;
      color: #0f172a;
      font-size: 13px;
      margin-top: 2px;
    }
    .footer {
      background: #f8fafc;
      padding: 14px 28px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 2px 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table class="header-table" role="presentation">
        <tr>
          {% if tiene_escudo %}
          <td class="header-logo-cell">
            <img src="cid:escudo_club" alt="Escudo" class="header-logo" />
          </td>
          {% endif %}
          <td class="header-text-cell">
            <h1>{{ club }}</h1>
            <p>Comunicado institucional</p>
          </td>
        </tr>
      </table>
    </div>
    <div class="content">
      <h2 class="subject-title">{{ asunto }}</h2>
      <div class="message-body">{{ contenido }}</div>
      <div class="signature">
        <span>Atentamente,</span>
        <strong>{{ firma_linea }}</strong>
      </div>
    </div>
    <div class="footer">
      {% if contacto_club %}<p>{{ contacto_club }}</p>{% endif %}
      <p>Por consultas, comuníquese con secretaría.</p>
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


def _read_escudo_bytes(configuracion) -> bytes | None:
    try:
        if configuracion.club_logo and configuracion.club_logo.name:
            with configuracion.club_logo.open("rb") as f:
                return f.read()
    except Exception:
        pass
    try:
        if ESCUDO_DEFAULT_PATH.is_file():
            return ESCUDO_DEFAULT_PATH.read_bytes()
    except Exception:
        pass
    return None


def enviar_email_individual(
    destinatario: str,
    asunto: str,
    contenido: str,
    envio_id: int = None,
    adjuntos: list = None,
) -> bool:
    """
    Envía un correo electrónico institucional a través del servicio SMTP configurado.
    Actualiza el estado y detalle_fallo del EnvioNotificacion si se proporciona su ID.
    `adjuntos` puede ser una lista de tuplas (filename, content_bytes, mimetype) o (filename, content_bytes).
    """
    configuracion = ConfiguracionGeneral.load()
    club_nombre = configuracion.club_nombre or "Club Universitario de Berisso"
    asunto_completo = f"[C.U.B.] {asunto}" if asunto else "[C.U.B.] Comunicado institucional"
    remitente = getattr(settings, "DEFAULT_FROM_EMAIL", "sgcub.notificaciones@gmail.com")
    if configuracion.email_nombre_remitente:
        remitente = formataddr((configuracion.email_nombre_remitente, remitente))

    firma_raw = (configuracion.email_firma or "").strip()
    firma_linea = (
        firma_raw
        if firma_raw and firma_raw.lower() not in (club_nombre.lower(), "club social y deportivo - sgcub")
        else "Secretaría y Comisión Directiva"
    )

    datos_contacto = [
        f"Tel. {configuracion.club_telefono}" if configuracion.club_telefono else "",
        configuracion.club_email or "",
    ]
    contacto_club = " · ".join([d for d in datos_contacto if d])
    escudo_bytes = _read_escudo_bytes(configuracion)

    try:
        template = Template(HTML_EMAIL_TEMPLATE)
        context = Context({
            "asunto": asunto,
            "club": club_nombre,
            "contenido": contenido,
            "firma_linea": firma_linea,
            "contacto_club": contacto_club,
            "tiene_escudo": bool(escudo_bytes),
        })
        html_content = template.render(context)
        text_content = (
            f"{asunto}\n\n"
            f"{contenido}\n\n"
            f"--\n"
            f"Atentamente,\n"
            f"{firma_linea}"
        )

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

        if escudo_bytes:
            try:
                img = MIMEImage(escudo_bytes)
                img.add_header("Content-ID", "<escudo_club>")
                img.add_header("Content-Disposition", "inline", filename="escudo.png")
                msg.attach(img)
            except Exception:
                pass
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
        origen=OrigenNotificacion.AUTOMATICA,
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


def despachar_envios_email_notificacion(notificacion_id: int, copia_secretaria: bool = False):
    """
    Busca todos los envíos de canal MAIL para una notificación y los despacha mediante SMTP.
    Valida envíos por WhatsApp y actualiza el estado final de la notificación según los resultados.
    """
    try:
        notificacion = Notificacion.objects.get(id=notificacion_id)
    except Notificacion.DoesNotExist:
        logger.error("Notificación ID %s no encontrada para despachar", notificacion_id)
        return

    envios_whatsapp = notificacion.envios.filter(canal=CanalNotificacion.WHATSAPP)
    for envio_wa in envios_whatsapp:
        telefono = (envio_wa.socio.persona.telefono or "").strip()
        if not telefono:
            envio_wa.estado = EstadoNotificacion.FALLIDA
            envio_wa.detalle_fallo = "El socio no posee número de teléfono registrado"
            envio_wa.save(update_fields=["estado", "detalle_fallo"])

    envios_mail = notificacion.envios.filter(canal=CanalNotificacion.MAIL)
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

    if copia_secretaria:
        configuracion = ConfiguracionGeneral.load()
        correo_secretaria = (
            (configuracion.club_email or "").strip()
            or (getattr(settings, "DEFAULT_FROM_EMAIL", "") or "").strip()
        )
        if "@" in correo_secretaria:
            enviar_email_individual(
                destinatario=correo_secretaria,
                asunto=f"[Copia Secretaría] {notificacion.asunto or notificacion.titulo}",
                contenido=notificacion.contenido,
                envio_id=None,
            )

    todos_los_envios = notificacion.envios.all()
    if todos_los_envios.exists():
        alguno_exitoso = todos_los_envios.filter(estado=EstadoNotificacion.ENVIADA).exists()
        nuevo_estado = EstadoNotificacion.ENVIADA if alguno_exitoso else EstadoNotificacion.FALLIDA
        if notificacion.estado != nuevo_estado:
            notificacion.estado = nuevo_estado
            notificacion.save(update_fields=["estado"])

    if total > 0:
        logger.info(
            "Despacho completado para notificación %s: %d/%d envíos por correo exitosos",
            notificacion_id,
            exitosos,
            total,
        )
