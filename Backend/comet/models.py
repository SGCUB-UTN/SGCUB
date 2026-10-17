from django.conf import settings
from django.db import models


class CometOperationChoices(models.TextChoices):
    EXPORTAR_JUGADOR = "exportar_jugador", "Exportar jugador"
    INSCRIBIR_JUGADOR = "inscribir_jugador", "Inscribir jugador"
    ACTUALIZAR_INSCRIPCION = "actualizar_inscripcion", "Actualizar inscripción"
    FINALIZAR_INSCRIPCION = "finalizar_inscripcion", "Finalizar inscripción"
    GESTIONAR_ROSTER = "gestionar_roster", "Gestionar roster"
    SOLICITAR_PARTICIPACION = "solicitar_participacion", "Solicitar participación"
    CARGAR_ALINEACION = "cargar_alineacion", "Cargar alineación"


class CometOperationLog(models.Model):
    log_id = models.AutoField(primary_key=True)
    operacion = models.CharField(
        max_length=40,
        choices=CometOperationChoices.choices,
    )
    jugador = models.ForeignKey(
        "padron.Jugador",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="comet_operations",
    )
    referencia_externa = models.CharField(
        max_length=80,
        blank=True,
        help_text="ID del recurso en COMET (competición, equipo, partido, etc.).",
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="comet_operations",
    )
    fecha = models.DateTimeField(auto_now_add=True)
    exitoso = models.BooleanField(default=False)
    mensaje = models.TextField(blank=True)
    payload_enviado = models.JSONField(null=True, blank=True)
    respuesta = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "comet_operation_log"
        ordering = ["-fecha"]
        verbose_name = "Operación COMET"
        verbose_name_plural = "Operaciones COMET"

    def __str__(self):
        estado = "OK" if self.exitoso else "ERROR"
        return f"[{estado}] {self.get_operacion_display()} - {self.fecha:%Y-%m-%d %H:%M}"