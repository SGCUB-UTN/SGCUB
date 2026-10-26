import json
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from comunicaciones.services import enviar_email_individual
from documental.models import TipoDocumento
from finanzas.delinquency import delinquency_report
from finanzas.delinquency_pdf import render_delinquency_pdf
from finanzas.models import ConfiguracionFinanciera, CuentaCorriente, Cuota, EstadoCuotaChoices, ItemCuota, MedioPago, MovimientoCuenta
from padron.models import Localidad, Persona, Socio

from .models import ConfiguracionGeneral, HistorialConfiguracion


class ConfiguracionGeneralTests(APITestCase):
    def setUp(self):
        self.usuario = get_user_model().objects.create_user(username="admin", first_name="Laura", last_name="Gómez")
        self.client.force_authenticate(user=self.usuario)
        self.localidad = Localidad.objects.create(nombre="Berisso Test")

    def guardar(self, responsable="Marta Ruiz", **datos):
        return self.client.post(reverse("configuracion-guardar"), {"responsable": responsable, **datos}, format="json")

    def actualizar(self, **datos):
        return self.guardar(general=datos)

    def subir(self, archivo):
        return self.client.post(
            reverse("configuracion-guardar"),
            {"datos": json.dumps({"responsable": "Marta Ruiz"}), "club_logo": archivo},
            format="multipart",
        )

    def test_valores_iniciales(self):
        response = self.client.get(reverse("configuracion-general"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["club_nombre"], "Club Universitario de Berisso")
        self.assertEqual(response.data["cuotas_vencidas_morosidad"], 1)
        self.assertEqual(response.data["dias_alerta_documentos"], 30)
        self.assertFalse(response.data["notificar_generacion_cuota"])

    def test_la_configuracion_general_es_de_solo_lectura(self):
        response = self.client.patch(reverse("configuracion-general"), {"club_nombre": "Otro"}, format="json")

        self.assertEqual(response.status_code, 405)

    def test_registra_cada_cambio_en_el_historial_con_el_responsable(self):
        response = self.actualizar(cuotas_vencidas_morosidad=3, notificar_comprobante_pago=True, club_nombre="Club Universitario de Berisso")

        self.assertEqual(response.status_code, 200, response.data)
        cambios = {cambio.campo: cambio for cambio in HistorialConfiguracion.objects.all()}
        self.assertEqual(set(cambios), {"Cuotas vencidas para considerar moroso", "Enviar comprobantes de pago"})
        morosidad = cambios["Cuotas vencidas para considerar moroso"]
        self.assertEqual((morosidad.seccion, morosidad.valor_anterior, morosidad.valor_nuevo), ("Finanzas", "1", "3"))
        self.assertEqual((morosidad.usuario, morosidad.responsable), (self.usuario, "Marta Ruiz"))
        self.assertEqual(cambios["Enviar comprobantes de pago"].valor_nuevo, "Sí")

    def test_exige_responsable_y_algun_cambio(self):
        sin_responsable = self.guardar(responsable=" ", general={"cuotas_vencidas_morosidad": 3})
        sin_cambios = self.guardar()

        self.assertEqual(sin_responsable.status_code, 400)
        self.assertIn("responsable", sin_responsable.data)
        self.assertEqual(ConfiguracionGeneral.load().cuotas_vencidas_morosidad, 1)
        self.assertEqual(sin_cambios.status_code, 400)
        self.assertIn("detail", sin_cambios.data)

    def test_historial_filtrado_por_seccion(self):
        self.actualizar(dias_alerta_documentos=15, email_firma="Comisión Directiva")

        response = self.client.get(reverse("historial-configuracion"), {"seccion": "Documentacion"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual([cambio["campo"] for cambio in response.data], ["Días de aviso antes del vencimiento"])
        self.assertEqual(response.data[0]["usuario_nombre"], "Laura Gómez")
        self.assertEqual(response.data[0]["responsable"], "Marta Ruiz")

    def test_validaciones(self):
        casos = [
            ({"club_nombre": "  "}, "club_nombre"),
            ({"club_cuit": "30-123"}, "club_cuit"),
            ({"club_email": "no-es-email"}, "club_email"),
            ({"cuotas_vencidas_morosidad": 0}, "cuotas_vencidas_morosidad"),
            ({"dias_alerta_documentos": 0}, "dias_alerta_documentos"),
            ({"dias_recordatorio_vencimiento": 31}, "dias_recordatorio_vencimiento"),
            ({"domicilio_calle": "Calle 1"}, "domicilio_numero"),
        ]
        for datos, campo in casos:
            with self.subTest(datos=datos):
                response = self.actualizar(**datos)
                self.assertEqual(response.status_code, 400)
                self.assertIn(campo, response.data["general"])

    def test_normaliza_el_cuit(self):
        response = self.actualizar(club_cuit="30123456789")

        self.assertEqual(response.data["general"]["club_cuit"], "30-12345678-9")

    def test_guarda_el_domicilio_del_club(self):
        response = self.actualizar(domicilio_calle="Calle 8", domicilio_numero="4100", domicilio_localidad=self.localidad.pk)
        self.assertEqual(response.status_code, 200, response.data)
        self.actualizar(domicilio_piso="2")

        configuracion = ConfiguracionGeneral.load()
        self.assertEqual((configuracion.club_domicilio.calle, configuracion.club_domicilio.piso), ("Calle 8", "2"))
        self.assertEqual(
            list(HistorialConfiguracion.objects.filter(campo="Domicilio").order_by("pk").values_list("valor_anterior", "valor_nuevo")),
            [("", "Calle 8 4100, Berisso Test"), ("Calle 8 4100, Berisso Test", "Calle 8 4100, Piso 2, Berisso Test")],
        )

    def test_sube_y_quita_el_logo(self):
        response = self.subir(SimpleUploadedFile("logo.png", b"PNG", content_type="image/png"))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("configuracion/logo/logo", response.data["general"]["club_logo"])

        self.guardar(quitar_logo=True)

        self.assertFalse(ConfiguracionGeneral.load().club_logo)
        self.assertEqual(
            list(HistorialConfiguracion.objects.filter(campo="Logo").order_by("pk").values_list("valor_nuevo", flat=True)),
            ["Cargado", "Quitado"],
        )

    def test_rechaza_logos_que_no_son_imagenes(self):
        response = self.subir(SimpleUploadedFile("logo.pdf", b"%PDF", content_type="application/pdf"))

        self.assertEqual(response.status_code, 400)
        self.assertIn("club_logo", response.data["general"])

    def test_guarda_general_y_nueva_version_en_una_sola_operacion(self):
        periodo = (timezone.localdate().replace(day=1) + timedelta(days=32)).strftime("%Y-%m")

        response = self.guardar(
            general={"dias_alerta_documentos": 20},
            financiera={"periodo_vigencia": periodo, "monto_inscripcion": "5000.00"},
        )

        self.assertEqual(response.status_code, 200, response.data)
        version = ConfiguracionFinanciera.load(periodo)
        self.assertEqual((version.monto_inscripcion, version.responsable), (Decimal("5000.00"), "Marta Ruiz"))
        self.assertEqual(ConfiguracionFinanciera.load().monto_inscripcion, Decimal("0.00"))
        self.assertEqual(ConfiguracionGeneral.load().dias_alerta_documentos, 20)

    def test_si_una_parte_es_invalida_no_guarda_nada(self):
        response = self.guardar(
            general={"dias_alerta_documentos": 20},
            financiera={"periodo_vigencia": timezone.localdate().strftime("%Y-%m"), "monto_cuota_social": "1200.00"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("periodo_vigencia", response.data["financiera"])
        self.assertEqual(ConfiguracionGeneral.load().dias_alerta_documentos, 30)
        self.assertEqual(ConfiguracionFinanciera.objects.count(), 1)

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
