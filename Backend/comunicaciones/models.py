from django.db import models


class CanalNotificacion(models.TextChoices):
    WHATSAPP = "WHATSAPP", "WhatsApp"
    MAIL = "MAIL", "mail"


class EstadoNotificacion(models.TextChoices):
    ENVIADA = "ENVIADA", "Enviada"
    PROGRAMADA = "PROGRAMADA", "Programada"
    FALLIDA = "FALLIDA", "Fallida"
    #RECIBIDO = "RECIBIDO", "Recibido"
    #LEIDO = "LEIDO", "Leido"


class Notificacion(models.Model):
    titulo = models.CharField(max_length=150)
    asunto = models.CharField(max_length=150, blank=True, null=True)
    contenido = models.TextField()
    estado = models.CharField(
        max_length=20,
        choices=EstadoNotificacion.choices,
        default=EstadoNotificacion.ENVIADA,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)


class EnvioNotificacion(models.Model):
    socio = models.ForeignKey(
        "padron.Socio",
        related_name="envios_notificacion",
        on_delete=models.CASCADE,
        
    )
    notificacion = models.ForeignKey(Notificacion, related_name='envios', on_delete=models.CASCADE)
    canal = models.CharField(
        max_length=20,
        choices=CanalNotificacion.choices,
        default=CanalNotificacion.WHATSAPP,
    )
    estado = models.CharField(
        max_length=20,
        choices=EstadoNotificacion.choices,
        default=EstadoNotificacion.ENVIADA,
    )
    detalle_fallo = models.TextField(blank=True, null=True)
    fecha_envio = models.DateTimeField(auto_now=True)
    #fecha_lectura = models.DateTimeField(blank=True, null=True) NO SE SABE SI SE USARA
    #fecha_recibido = models.DateTimeField(blank=True, null=True)