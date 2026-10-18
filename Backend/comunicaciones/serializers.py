from rest_framework import serializers

from .models import CanalNotificacion, EnvioNotificacion, Notificacion


class EnvioNotificacionSerializer(serializers.ModelSerializer):
    destinatario_contacto = serializers.SerializerMethodField()

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
            "destinatario_contacto",
            "canal",
            "estado",
            "detalle_fallo",
            "fecha_envio",
        ]
        read_only_fields = ["id", "destinatario_contacto", "fecha_envio"]


class NotificacionSerializer(serializers.ModelSerializer):
    envios = EnvioNotificacionSerializer(many=True, read_only=True)

    class Meta:
        model = Notificacion
        fields = ["id", "titulo", "asunto", "contenido", "estado", "fecha_creacion", "envios"]
        read_only_fields = ["id", "fecha_creacion", "envios"]
