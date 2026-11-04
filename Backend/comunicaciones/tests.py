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
            envio_id=envio.pk,
        )


class ObtenerContactoYDespachoNotificacionTest(TestCase):
    def test_socio_menor_prioriza_contacto_responsable(self):
        from datetime import date
        from padron.models import Categoria, Jugador, VinculoFamiliar
        from .services import crear_y_despachar_notificacion, obtener_contacto_socio

        # Menor de 10 años
        menor = Persona.objects.create(
            nombre="Lucas",
            apellido="Gómez",
            dni="50123456",
            fecha_nacimiento=date(2016, 5, 10),
            email="lucas_menor@example.com",
        )
        socio_menor = Socio.objects.create(persona=menor)
        cat = Categoria.objects.create(nombre="Infantiles", anio_vigente=2026, genero="M")
        jugador = Jugador.objects.create(socio=socio_menor, categoria=cat)

        madre = Persona.objects.create(
            nombre="Laura",
            apellido="Gómez",
            dni="28123456",
            email="laura_tutor@example.com",
        )
        VinculoFamiliar.objects.create(
            jugador=jugador,
            persona=madre,
            relacion="Madre",
            responsable_legal=True,
        )

        email, destinatario, error = obtener_contacto_socio(socio_menor)
        self.assertEqual(email, "laura_tutor@example.com")
        self.assertIn("Laura Gómez", destinatario)
        self.assertIsNone(error)

        with patch("comunicaciones.services.enviar_email_individual", return_value=True) as mock_send:
            notif = crear_y_despachar_notificacion(
                titulo="Aviso Cuota",
                asunto="Aviso Cuota",
                contenido="Contenido aviso",
                socios=[socio_menor],
            )
            self.assertEqual(notif.estado, EstadoNotificacion.ENVIADA)
            mock_send.assert_called_once()
            self.assertEqual(mock_send.call_args[1]["destinatario"], "laura_tutor@example.com")


    def test_actualiza_estado_notificacion_a_fallida_si_todos_los_envios_fallan(self):
        persona = Persona.objects.create(
            nombre="Juan",
            apellido="Gómez",
            dni="11223344",
            email="",
            telefono="",
        )
        socio = Socio.objects.create(persona=persona)
        notificacion = Notificacion.objects.create(
            titulo="Aviso",
            contenido="Contenido",
            estado=EstadoNotificacion.ENVIADA,
        )
        EnvioNotificacion.objects.create(
            notificacion=notificacion,
            socio=socio,
            canal=CanalNotificacion.MAIL,
        )

        from .services import despachar_envios_email_notificacion

        despachar_envios_email_notificacion(notificacion.pk)
        notificacion.refresh_from_db()
        self.assertEqual(notificacion.estado, EstadoNotificacion.FALLIDA)

