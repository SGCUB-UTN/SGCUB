from rest_framework import serializers

from padron.models import Barrio, Localidad
from padron.serializers import validate_barrio_localidad

from .models import ConfiguracionGeneral, HistorialConfiguracion
from .services import merged_address

MAX_LOGO_SIZE = 2 * 1024 * 1024
REQUIRED_ADDRESS_FIELDS = {"calle": "domicilio_calle", "numero": "domicilio_numero", "localidad": "domicilio_localidad"}


class ConfiguracionGeneralSerializer(serializers.ModelSerializer):
    # Same field names as the person forms, so the address section can be reused
    domicilio_calle = serializers.CharField(source="club_domicilio.calle", max_length=100, required=False, allow_blank=True)
    domicilio_numero = serializers.CharField(source="club_domicilio.numero", max_length=20, required=False, allow_blank=True)
    domicilio_piso = serializers.CharField(source="club_domicilio.piso", max_length=20, required=False, allow_blank=True, allow_null=True)
    domicilio_departamento = serializers.CharField(source="club_domicilio.departamento", max_length=20, required=False, allow_blank=True, allow_null=True)
    domicilio_entre_calle_1 = serializers.CharField(source="club_domicilio.entre_calle_1", max_length=100, required=False, allow_blank=True, allow_null=True)
    domicilio_entre_calle_2 = serializers.CharField(source="club_domicilio.entre_calle_2", max_length=100, required=False, allow_blank=True, allow_null=True)
    domicilio_localidad = serializers.PrimaryKeyRelatedField(source="club_domicilio.localidad", queryset=Localidad.objects.all(), required=False, allow_null=True)
    domicilio_localidad_nombre = serializers.CharField(source="club_domicilio.localidad.nombre", read_only=True)
    domicilio_barrio = serializers.PrimaryKeyRelatedField(source="club_domicilio.barrio", queryset=Barrio.objects.all(), required=False, allow_null=True)
    domicilio_barrio_nombre = serializers.CharField(source="club_domicilio.barrio.nombre", read_only=True)

    class Meta:
        model = ConfiguracionGeneral
        exclude = ["configuracion_general_id", "club_domicilio"]
        extra_kwargs = {
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

    def validate_club_logo(self, value):
        if value and value.size > MAX_LOGO_SIZE:
            raise serializers.ValidationError("El logo no puede pesar más de 2 MB.")
        return value

    def validate(self, attrs):
        address = attrs.get("club_domicilio")
        if address:
            current = getattr(self.instance, "club_domicilio", None)
            merged = merged_address(current, address)
            missing = {field: ["Este campo es obligatorio."] for key, field in REQUIRED_ADDRESS_FIELDS.items() if not merged[key]}
            if missing:
                raise serializers.ValidationError(missing)
            validate_barrio_localidad({"barrio": merged["barrio"], "localidad": merged["localidad"]}, current)
        return attrs


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
            "responsable",
            "usuario_nombre",
        ]

    def get_usuario_nombre(self, obj) -> str | None:
        user = obj.usuario
        return (user.get_full_name().strip() or user.username) if user else None
