from django.contrib import admin

from .models import CometOperationLog


@admin.register(CometOperationLog)
class CometOperationLogAdmin(admin.ModelAdmin):
    list_display = (
        "log_id", "operacion", "jugador", "usuario",
        "fecha", "exitoso", "referencia_externa",
    )
    list_filter = ("exitoso", "operacion", "fecha")
    search_fields = (
        "jugador__socio__persona__dni",
        "jugador__socio__persona__apellido",
        "referencia_externa",
    )
    readonly_fields = ("fecha", "payload_enviado", "respuesta")
    date_hierarchy = "fecha"