from rest_framework import serializers

from .models import CanalNotificacion, EnvioNotificacion, Notificacion


class EnvioNotificacionSerializer(serializers.ModelSerializer):
    destinatario_contacto = serializers.SerializerMethodField()
    socio_nombre = serializers.SerializerMethodField()
    socio_dni = serializers.CharField(source="socio.persona.dni", read_only=True)
    socio_numero = serializers.IntegerField(source="socio.numero_socio", read_only=True)
    canal_display = serializers.CharField(source="get_canal_display", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    def get_socio_nombre(self, envio):
        persona = getattr(envio.socio, "persona", None)
        if not persona:
            return f"Socio #{envio.socio_id}"
        return f"{persona.nombre} {persona.apellido}".strip()

    def get_destinatario_contacto(self, envio):
        if envio.canal == CanalNotificacion.MAIL:
            return envio.socio.persona.email or ""
        return envio.socio.persona.telefono

    class Meta:
        model = EnvioNotificacion
        fields = [
            "id",
            "notificacion",
            "socio",
            "socio_nombre",
            "socio_dni",
            "socio_numero",
            "destinatario_contacto",
            "canal",
            "canal_display",
            "estado",
            "estado_display",
            "detalle_fallo",
            "fecha_envio",
        ]
        read_only_fields = [
            "id",
            "socio_nombre",
            "socio_dni",
            "socio_numero",
            "destinatario_contacto",
            "canal_display",
            "estado_display",
            "fecha_envio",
        ]


class NotificacionSerializer(serializers.ModelSerializer):
    envios = EnvioNotificacionSerializer(many=True, read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = Notificacion
        fields = [
            "id",
            "titulo",
            "asunto",
            "contenido",
            "estado",
            "estado_display",
            "fecha_creacion",
            "envios",
        ]
        read_only_fields = ["id", "estado_display", "fecha_creacion", "envios"]
