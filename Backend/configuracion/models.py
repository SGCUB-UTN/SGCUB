from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class SeccionConfiguracionChoices(models.TextChoices):
    CLUB = "Club", "Datos del club"
    FINANZAS = "Finanzas", "Finanzas y facturación"
    DOCUMENTACION = "Documentacion", "Documentación"
    COMUNICACIONES = "Comunicaciones", "Comunicaciones"


class ConfiguracionGeneral(models.Model):
    """Settings that apply as soon as they are saved. Cuota parameters live in finanzas.ConfiguracionFinanciera,
    which is versioned by period."""

    configuracion_general_id = models.AutoField(primary_key=True)

    club_nombre = models.CharField(max_length=120, default="Club Universitario de Berisso")
    club_cuit = models.CharField(max_length=13, blank=True)
    club_direccion = models.CharField(max_length=200, blank=True)
    club_telefono = models.CharField(max_length=30, blank=True)
    club_email = models.EmailField(blank=True)

    # Not charged yet: the registration fee will be developed later
    monto_inscripcion = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    cuotas_vencidas_morosidad = models.PositiveSmallIntegerField(default=1)

    dias_alerta_documentos = models.PositiveSmallIntegerField(default=30)

    notificar_generacion_cuota = models.BooleanField(default=False)
    notificar_recordatorio_vencimiento = models.BooleanField(default=False)
    notificar_cuota_vencida = models.BooleanField(default=False)
    notificar_modificacion_cuota = models.BooleanField(default=False)
    notificar_comprobante_pago = models.BooleanField(default=False)
    dias_recordatorio_vencimiento = models.PositiveSmallIntegerField(default=3)
    email_nombre_remitente = models.CharField(max_length=80, default="Club Universitario de Berisso")
    email_firma = models.TextField(max_length=500, default="Club Social y Deportivo - SGCUB")

    class Meta:
        db_table = "configuracion_general"

    def __str__(self):
        return "Configuración general"

    @classmethod
    def load(cls):
        configuration = cls.objects.order_by("pk").first()
        return configuration or cls.objects.create()


class HistorialConfiguracion(models.Model):
    """One change made from the configuration screen: who, when, which setting and its values."""

    historial_configuracion_id = models.AutoField(primary_key=True)
    seccion = models.CharField(max_length=20, choices=SeccionConfiguracionChoices.choices)
    campo = models.CharField(max_length=120)
    valor_anterior = models.TextField(blank=True)
    valor_nuevo = models.TextField(blank=True)
    fecha = models.DateTimeField(default=timezone.now)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="cambios_configuracion",
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "historial_configuracion"
        ordering = ["-fecha", "-pk"]

    def __str__(self):
        return f"{self.get_seccion_display()} - {self.campo}"
