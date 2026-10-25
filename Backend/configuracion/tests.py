from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from comunicaciones.services import enviar_email_individual
from documental.models import TipoDocumento
from finanzas.delinquency import delinquency_report
from finanzas.delinquency_pdf import render_delinquency_pdf
from finanzas.models import CuentaCorriente, Cuota, EstadoCuotaChoices, ItemCuota, MedioPago, MovimientoCuenta
from padron.models import Persona, Socio

from .models import ConfiguracionGeneral, HistorialConfiguracion


class ConfiguracionGeneralTests(APITestCase):
    def setUp(self):
        self.usuario = get_user_model().objects.create_user(username="admin", first_name="Laura", last_name="Gómez")
        self.client.force_authenticate(user=self.usuario)

    def actualizar(self, **datos):
        return self.client.patch(reverse("configuracion-general"), datos, format="json")

    def test_valores_iniciales(self):
        response = self.client.get(reverse("configuracion-general"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["club_nombre"], "Club Universitario de Berisso")
        self.assertEqual(response.data["cuotas_vencidas_morosidad"], 1)
        self.assertEqual(response.data["dias_alerta_documentos"], 30)
        self.assertFalse(response.data["notificar_generacion_cuota"])

    def test_registra_cada_cambio_en_el_historial(self):
        response = self.actualizar(monto_inscripcion="5000.00", notificar_comprobante_pago=True, club_nombre="Club Universitario de Berisso")

        self.assertEqual(response.status_code, 200, response.data)
        cambios = {cambio.campo: cambio for cambio in HistorialConfiguracion.objects.all()}
        self.assertEqual(set(cambios), {"Monto de inscripción", "Enviar comprobantes de pago"})
        inscripcion = cambios["Monto de inscripción"]
        self.assertEqual((inscripcion.seccion, inscripcion.valor_anterior, inscripcion.valor_nuevo), ("Finanzas", "0.00", "5000.00"))
        self.assertEqual(inscripcion.usuario, self.usuario)
        self.assertEqual(cambios["Enviar comprobantes de pago"].valor_nuevo, "Sí")

    def test_historial_filtrado_por_seccion(self):
        self.actualizar(dias_alerta_documentos=15, email_firma="Comisión Directiva")

        response = self.client.get(reverse("historial-configuracion"), {"seccion": "Documentacion"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual([cambio["campo"] for cambio in response.data], ["Días de aviso antes del vencimiento"])
        self.assertEqual(response.data[0]["usuario_nombre"], "Laura Gómez")

    def test_validaciones(self):
        casos = [
            ({"club_nombre": "  "}, "club_nombre"),
            ({"club_cuit": "30-123"}, "club_cuit"),
            ({"club_email": "no-es-email"}, "club_email"),
            ({"monto_inscripcion": "-1.00"}, "monto_inscripcion"),
            ({"cuotas_vencidas_morosidad": 0}, "cuotas_vencidas_morosidad"),
            ({"dias_alerta_documentos": 0}, "dias_alerta_documentos"),
            ({"dias_recordatorio_vencimiento": 31}, "dias_recordatorio_vencimiento"),
        ]
        for datos, campo in casos:
            with self.subTest(datos=datos):
                response = self.actualizar(**datos)
                self.assertEqual(response.status_code, 400)
                self.assertIn(campo, response.data)

    def test_normaliza_el_cuit(self):
        response = self.actualizar(club_cuit="30123456789")

        self.assertEqual(response.data["club_cuit"], "30-12345678-9")

    def test_registra_cambios_de_medios_de_pago_y_tipos_de_documento(self):
        medio = MedioPago.objects.get(codigo="Transferencia")
        tipo = TipoDocumento.objects.get(nombre="DNI")

        self.client.patch(reverse("medio-pago-detail", args=[medio.pk]), {"activo": False}, format="json")
        self.client.patch(reverse("tipo_documento_detail", args=[tipo.pk]), {"vigencia_meses": 60}, format="json")

        cambios = {(cambio.seccion, cambio.campo, cambio.valor_anterior, cambio.valor_nuevo) for cambio in HistorialConfiguracion.objects.all()}
        self.assertEqual(cambios, {
            ("Finanzas", "Medio de pago Transferencia · Habilitado", "Sí", "No"),
            ("Documentacion", "Tipo de documento DNI · Vigencia (meses)", "", "60"),
        })


class AplicacionDeLaConfiguracionTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=get_user_model().objects.create_user(username="admin"))
        self.configuracion = ConfiguracionGeneral.load()

    def socio_con_cuotas_vencidas(self, dni, cantidad):
        socio = Socio.objects.create(persona=Persona.objects.create(nombre="Socio", apellido=dni, dni=dni))
        cuenta = CuentaCorriente.objects.get(socio=socio)
        vencida = timezone.localdate() - timedelta(days=40)
        for numero in range(cantidad):
            cuota = Cuota.objects.create(
                estado_cuota=EstadoCuotaChoices.VENCIDA_2,
                fecha_venc1=vencida,
                fecha_venc2=vencida,
                periodo=f"2025-{numero + 1:02d}",
            )
            ItemCuota.objects.create(cuota=cuota, concepto="CuotaSocial", fecha_aplicacion=vencida, monto=Decimal("1000.00"))
            MovimientoCuenta.objects.create(
                cuenta_corriente=cuenta, cuota=cuota, tipo_movimiento="Cargo", fecha=timezone.now(), monto=Decimal("1000.00"),
            )
        return socio

    def test_el_reporte_de_morosidad_respeta_el_minimo_de_cuotas_vencidas(self):
        self.socio_con_cuotas_vencidas("71000001", 1)
        self.socio_con_cuotas_vencidas("71000002", 2)
        self.configuracion.cuotas_vencidas_morosidad = 2
        self.configuracion.save()

        reporte = delinquency_report("activos")

        self.assertEqual([fila["dni"] for fila in reporte["filas"]], ["71000002"])
        self.assertEqual(reporte["cuotas_vencidas_minimas"], 2)

    def test_los_pdf_usan_el_nombre_del_club(self):
        self.configuracion.club_nombre = "Club Atlético & Social"
        self.configuracion.save()

        pdf = render_delinquency_pdf({"filas": [], "fecha": timezone.localtime(), "alcance": "Socios activos", "sin_cuenta": 0})

        self.assertIn(b"Club Atl", pdf)

    def test_las_alertas_de_documentos_usan_los_dias_configurados(self):
        from documental.models import Documento
        from padron.models import EstadoAdministrativo

        socio = Socio.objects.create(persona=Persona.objects.create(nombre="Ana", apellido="Paz", dni="72000001"))
        socio.estado_administrativo = EstadoAdministrativo.objects.get_or_create(nombre="Activo")[0]
        socio.save()
        vence = timezone.now() + timedelta(days=20)
        Documento.objects.create(persona=socio.persona, tipo_documento=TipoDocumento.objects.get(nombre="DNI"), fecha_vencimiento=vence)

        con_30_dias = self.client.get(reverse("alertas_count")).data["proximos"]
        self.configuracion.dias_alerta_documentos = 10
        self.configuracion.save()
        con_10_dias = self.client.get(reverse("alertas_count")).data["proximos"]

        self.assertEqual((con_30_dias, con_10_dias), (1, 0))

    def test_los_emails_usan_remitente_y_firma_configurados(self):
        self.configuracion.email_nombre_remitente = "Tesoreria CUB"
        self.configuracion.email_firma = "Comisión Directiva"
        self.configuracion.save()

        enviar_email_individual("socio@example.com", "Aviso", "Hola")

        mensaje = mail.outbox[0]
        self.assertTrue(mensaje.from_email.startswith("Tesorería CUB <") or "Tesorer" in mensaje.from_email)
        self.assertIn("Comisión Directiva", mensaje.body)
        self.assertNotIn("SGCUB\n", mensaje.body[-10:])
