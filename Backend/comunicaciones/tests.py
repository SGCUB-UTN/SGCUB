from unittest.mock import patch

from django.test import TestCase

from padron.models import Persona, Socio

from .models import CanalNotificacion, EnvioNotificacion, EstadoNotificacion, Notificacion
from .serializers import EnvioNotificacionSerializer


class NotificacionEnumTest(TestCase):
    def test_canales_esperados(self):
        self.assertEqual(CanalNotificacion.values, ["WHATSAPP", "MAIL"])

    def test_estados_esperados(self):
        self.assertEqual(
            EstadoNotificacion.values,
            ["ENVIADA", "PROGRAMADA", "FALLIDA"],
        )


class EnvioNotificacionSerializerTest(TestCase):
    def setUp(self):
        self.persona = Persona.objects.create(
            nombre="Ana",
            apellido="Pérez",
            dni="12345678",
            telefono="+5491123456789",
            email="ana@example.com",
        )
        self.socio = Socio.objects.create(persona=self.persona)
        self.notificacion = Notificacion.objects.create(
            titulo="Aviso",
            contenido="Contenido",
        )

    def test_serializa_socio_y_contacto_segun_canal(self):
        envio = EnvioNotificacion.objects.create(
            notificacion=self.notificacion,
            socio=self.socio,
            canal=CanalNotificacion.MAIL,
        )

        data = EnvioNotificacionSerializer(envio).data

        self.assertEqual(data["socio"], self.socio.pk)
        self.assertEqual(data["destinatario_contacto"], self.persona.email)

    def test_valida_socio_en_el_payload(self):
        serializer = EnvioNotificacionSerializer(
            data={
                "notificacion": self.notificacion.pk,
                "socio": self.socio.pk,
                "canal": CanalNotificacion.WHATSAPP,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        envio = serializer.save()
        self.assertEqual(envio.socio, self.socio)


class DespacharEnviosEmailNotificacionTest(TestCase):
    def test_pasa_el_nombre_y_apellido_al_enviar_email(self):
        persona = Persona.objects.create(
            nombre="Ana",
            apellido="Pérez",
            dni="87654321",
            email="ana@example.com",
        )
        socio = Socio.objects.create(persona=persona)
        notificacion = Notificacion.objects.create(
            titulo="Aviso",
            contenido="Contenido",
        )
        envio = EnvioNotificacion.objects.create(
            notificacion=notificacion,
            socio=socio,
            canal=CanalNotificacion.MAIL,
        )

        with patch("comunicaciones.services.enviar_email_individual", return_value=True) as enviar:
            from .services import despachar_envios_email_notificacion

            despachar_envios_email_notificacion(notificacion.pk)

        enviar.assert_called_once_with(
            destinatario="ana@example.com",
            asunto="Aviso",
            contenido="Contenido",
            nombreApellido="Ana Pérez",
            envio_id=envio.pk,
        )
