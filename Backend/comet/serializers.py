from rest_framework import serializers

from .models import CometOperationLog


class CometOperationLogSerializer(serializers.ModelSerializer):
    jugador_nombre = serializers.SerializerMethodField()
    exportado_por = serializers.CharField(
        source="usuario.get_username",
        read_only=True,
        default=None,
    )
    operacion_nombre = serializers.CharField(
        source="get_operacion_display",
        read_only=True,
    )

    class Meta:
        model = CometOperationLog
        fields = [
            "log_id",
            "operacion",
            "operacion_nombre",
            "jugador",
            "jugador_nombre",
            "referencia_externa",
            "usuario",
            "exportado_por",
            "fecha",
            "exitoso",
            "mensaje",
            "payload_enviado",
            "respuesta",
        ]
        read_only_fields = fields

    def get_jugador_nombre(self, obj):
        if obj.jugador is None:
            return None
        persona = obj.jugador.socio.persona
        return f"{persona.apellido}, {persona.nombre}"