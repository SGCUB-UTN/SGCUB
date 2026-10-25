from decimal import Decimal

from rest_framework import serializers

from .models import ConfiguracionGeneral, HistorialConfiguracion


class ConfiguracionGeneralSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionGeneral
        exclude = ["configuracion_general_id"]
        extra_kwargs = {
            "monto_inscripcion": {"min_value": Decimal("0.00")},
            "cuotas_vencidas_morosidad": {"min_value": 1, "max_value": 24},
            "dias_alerta_documentos": {"min_value": 1, "max_value": 365},
            "dias_recordatorio_vencimiento": {"min_value": 1, "max_value": 30},
        }

    def validate_club_nombre(self, value):
        if not value.strip():
            raise serializers.ValidationError("Ingresá el nombre del club.")
        return value.strip()

    def validate_club_cuit(self, value):
        digits = "".join(character for character in value if character.isdigit())
        if value and len(digits) != 11:
            raise serializers.ValidationError("El CUIT debe tener 11 dígitos.")
        return f"{digits[:2]}-{digits[2:10]}-{digits[10:]}" if digits else ""


class HistorialConfiguracionSerializer(serializers.ModelSerializer):
    seccion_nombre = serializers.CharField(source="get_seccion_display", read_only=True)
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = HistorialConfiguracion
        fields = [
            "historial_configuracion_id",
            "seccion",
            "seccion_nombre",
            "campo",
            "valor_anterior",
            "valor_nuevo",
            "fecha",
            "usuario_nombre",
        ]

    def get_usuario_nombre(self, obj) -> str | None:
        user = obj.usuario
        return (user.get_full_name().strip() or user.username) if user else None
