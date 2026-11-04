from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from comunicaciones.models import (
    CanalNotificacion,
    EnvioNotificacion,
    EstadoNotificacion,
    Notificacion,
    OrigenNotificacion,
)
from comunicaciones.services import crear_y_despachar_notificacion
from documental.models import Documento, EstadoDocumento, TipoDocumento
from finanzas.generators import PERIOD_FORMAT
from finanzas.models import EjecucionTareaCuota, EstadoCuotaChoices, OrigenEjecucionChoices, TipoTareaCuotaChoices
from finanzas.period_summary import cuota_situation
from finanzas.tasks import period_due_dates
from finanzas.tests import account_for, crear_cuota_con_cargo, crear_socio
from padron.models import (
    ActualizacionCategoriasEjecucion,
    Categoria,
    Docente,
    Jugador,
    Persona,
    RecategorizacionEjecucion,
    Socio,
    get_anio_actual,
)


class ResumenInicioTestCase(APITestCase):
    def setUp(self):
        self.client.force_authenticate(get_user_model().objects.create_user(username="administrativo"))
        self.period = timezone.localdate().strftime(PERIOD_FORMAT)

    def summary(self):
        response = self.client.get(reverse("inicio-resumen"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data


class ResumenInicioAccesoTests(APITestCase):
    def test_requiere_usuario_autenticado(self):
        response = self.client.get(reverse("inicio-resumen"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ResumenInicioPadronTests(ResumenInicioTestCase):
    def test_cuenta_socios_jugadores_y_bajas_parciales_activos(self):
        crear_socio("72000001")
        crear_socio("72000002")
        crear_socio("72000003", con_jugador=True)
        crear_socio("72000004", con_jugador=True, jugador_inactivo=True)
        crear_socio("72000005", socio_inactivo=True)

        self.assertEqual(self.summary()["members"], {"socios": 2, "jugadores": 1, "baja_parcial": 1})


class SituacionCuotasTests(ResumenInicioTestCase):
    PERIOD = "2026-09"

    def setUp(self):
        super().setUp()
        self.due = period_due_dates(self.PERIOD)

    def cuota(self, dni, recargos=0, paga=False, periodo=PERIOD):
        estado = EstadoCuotaChoices.PAGA if paga else EstadoCuotaChoices.EN_FECHA
        cuota = crear_cuota_con_cargo(account_for(crear_socio(dni)), periodo, "1000", estado=estado)
        cuota.recargos_aplicados = recargos
        cuota.save(update_fields=["recargos_aplicados"])
        return cuota

    def create_cuotas(self):
        self.cuota("72000011", paga=True)
        self.cuota("72000012", paga=True)
        self.cuota("72000013", paga=True, recargos=1)
        self.cuota("72000014", paga=True, recargos=2)
        self.cuota("72000015")
        self.cuota("72000016", recargos=2)
        self.cuota("72000017", periodo="2000-01")

    def situation(self, today):
        result = cuota_situation(self.PERIOD, today=today)
        return {key: result[key] for key in (
            "due_dates_passed", "generated", "paid_on_time", "paid_first_surcharge", "paid_second_surcharge", "unpaid",
        )}

    def test_antes_del_primer_vencimiento_todas_las_pagas_son_en_primera_instancia(self):
        self.create_cuotas()

        self.assertEqual(self.situation(self.due[1]), {
            "due_dates_passed": 0, "generated": 6, "paid_on_time": 4,
            "paid_first_surcharge": 0, "paid_second_surcharge": 0, "unpaid": 2,
        })

    def test_entre_vencimientos_separa_las_pagas_con_primer_recargo(self):
        self.create_cuotas()

        self.assertEqual(self.situation(self.due[1] + timedelta(days=1)), {
            "due_dates_passed": 1, "generated": 6, "paid_on_time": 2,
            "paid_first_surcharge": 2, "paid_second_surcharge": 0, "unpaid": 2,
        })

    def test_despues_del_segundo_vencimiento_separa_las_pagas_con_cada_recargo(self):
        self.create_cuotas()

        self.assertEqual(self.situation(self.due[2] + timedelta(days=1)), {
            "due_dates_passed": 2, "generated": 6, "paid_on_time": 2,
            "paid_first_surcharge": 1, "paid_second_surcharge": 1, "unpaid": 2,
        })

    def test_informa_las_fechas_de_vencimiento_del_periodo(self):
        result = cuota_situation(self.PERIOD, today=self.due[1])

        self.assertEqual((result["first_due"], result["second_due"]), (self.due[1], self.due[2]))
        self.assertEqual(result["generated"], 0)

    def test_el_panel_muestra_la_situacion_del_mes_actual(self):
        self.cuota("72000021", paga=True, periodo=self.period)
        self.cuota("72000022", periodo=self.period)

        cuotas = self.summary()["cuotas"]

        self.assertEqual(cuotas["period"], self.period)
        self.assertEqual(cuotas["generated"], 2)
        self.assertEqual(cuotas["unpaid"], 1)


class ResumenInicioAlertasTests(ResumenInicioTestCase):
    def alerts(self):
        return self.summary()["alerts"]

    def test_indica_si_las_categorias_se_actualizaron_en_el_anio(self):
        self.assertFalse(self.alerts()["categories_updated"])

        ActualizacionCategoriasEjecucion.objects.create(ejecutado_por="Admin")

        self.assertTrue(self.alerts()["categories_updated"])

    def test_recategorizacion_fallida_o_de_otro_anio_no_cuenta_como_ejecutada(self):
        Estado = RecategorizacionEjecucion.EstadoChoices
        RecategorizacionEjecucion.objects.create(anio=get_anio_actual() - 1, ejecutado_por="Admin", estado=Estado.FINALIZADA)
        RecategorizacionEjecucion.objects.create(ejecutado_por="Admin", estado=Estado.FALLIDA)

        self.assertEqual(self.alerts()["recategorization"], {"executed": False, "status": None})

        RecategorizacionEjecucion.objects.create(ejecutado_por="Admin", estado=Estado.REVISION_PENDIENTE)

        self.assertEqual(
            self.alerts()["recategorization"],
            {"executed": True, "status": Estado.REVISION_PENDIENTE},
        )

    def test_informa_la_ultima_generacion_automatica_de_cuotas(self):
        self.assertIsNone(self.alerts()["last_generation"])
        now = timezone.now()
        EjecucionTareaCuota.objects.create(
            tipo=TipoTareaCuotaChoices.GENERACION, periodo="2026-09", fecha_inicio=now - timedelta(days=30),
        )
        EjecucionTareaCuota.objects.create(
            tipo=TipoTareaCuotaChoices.GENERACION, periodo="2026-10", fecha_inicio=now - timedelta(days=2),
            exitosa=False, resumen="Faltan cuotas",
        )
        EjecucionTareaCuota.objects.create(
            tipo=TipoTareaCuotaChoices.GENERACION, periodo="2026-10", fecha_inicio=now - timedelta(days=1),
            origen=OrigenEjecucionChoices.MANUAL,
        )
        EjecucionTareaCuota.objects.create(tipo=TipoTareaCuotaChoices.RECARGO_1, periodo="2026-10", fecha_inicio=now)

        generation = self.alerts()["last_generation"]

        self.assertEqual(generation["period"], "2026-10")
        self.assertFalse(generation["successful"])
        self.assertEqual(generation["summary"], "Faltan cuotas")

    def failed_mail(self, origen, days_ago=0, canal=CanalNotificacion.MAIL):
        notificacion = Notificacion.objects.create(titulo="Aviso", contenido="Texto", origen=origen)
        envio = EnvioNotificacion.objects.create(
            socio=crear_socio(f"7300{EnvioNotificacion.objects.count():04d}"),
            notificacion=notificacion,
            canal=canal,
            estado=EstadoNotificacion.FALLIDA,
        )
        EnvioNotificacion.objects.filter(pk=envio.pk).update(fecha_envio=timezone.now() - timedelta(days=days_ago))
        return envio

    def test_cuenta_solo_fallos_recientes_de_mails_automaticos(self):
        self.failed_mail(OrigenNotificacion.AUTOMATICA)
        self.failed_mail(OrigenNotificacion.AUTOMATICA, days_ago=3)
        self.failed_mail(OrigenNotificacion.AUTOMATICA, days_ago=10)
        self.failed_mail(OrigenNotificacion.MANUAL)
        self.failed_mail(OrigenNotificacion.AUTOMATICA, canal=CanalNotificacion.WHATSAPP)

        failures = self.alerts()["mail_failures"]

        self.assertEqual(failures["days"], 7)
        self.assertEqual(failures["count"], 2)
        self.assertIsNotNone(failures["last_failure_at"])

    def test_sin_fallos_de_mail_devuelve_cero(self):
        self.assertEqual(self.alerts()["mail_failures"], {"days": 7, "count": 0, "last_failure_at": None})

    def test_backup_figura_sin_configurar(self):
        self.assertEqual(self.alerts()["backup"], {"configured": False})


class OrigenNotificacionTests(APITestCase):
    def test_las_notificaciones_del_sistema_se_marcan_como_automaticas(self):
        socio = crear_socio("72000031")

        notificacion = crear_y_despachar_notificacion(titulo="Aviso", asunto="Aviso", contenido="Texto", socios=[socio])

        self.assertEqual(notificacion.origen, OrigenNotificacion.AUTOMATICA)

    def test_las_notificaciones_redactadas_en_comunicaciones_son_manuales(self):
        self.client.force_authenticate(get_user_model().objects.create_user(username="administrativo"))

        response = self.client.post(
            reverse("notificacion-list-create"),
            {"titulo": "Comunicado", "contenido": "Texto", "envios": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Notificacion.objects.get(pk=response.data["id"]).origen, OrigenNotificacion.MANUAL)


class ResumenInicioDocumentacionTests(ResumenInicioTestCase):
    def setUp(self):
        super().setUp()
        TipoDocumento.objects.update(obligatorio=False)
        self.apto = TipoDocumento.objects.create(nombre="Apto test", obligatorio=True, aplica_docente=False)
        self.seguro = TipoDocumento.objects.create(nombre="Seguro test", obligatorio=True)
        self.vigente = EstadoDocumento.objects.get(nombre="Vigente")
        self.categoria = Categoria.objects.create(nombre="Sub 12")

    def jugador(self, dni):
        persona = Persona.objects.create(nombre="Jugador", apellido=dni, dni=dni)
        Jugador.objects.create(socio=Socio.objects.create(persona=persona), categoria=self.categoria)
        return persona

    def docente(self, dni):
        persona = Persona.objects.create(nombre="Docente", apellido=dni, dni=dni)
        Docente.objects.create(persona=persona)
        return persona

    def documento(self, persona, tipo, dias):
        vencimiento = timezone.make_aware(datetime.combine(timezone.localdate() + timedelta(days=dias), time(12)))
        Documento.objects.create(
            persona=persona, tipo_documento=tipo, estado_documento=self.vigente, fecha_vencimiento=vencimiento,
        )

    def test_resume_perfiles_al_dia_y_estado_de_los_documentos(self):
        al_dia = self.jugador("72000041")
        self.documento(al_dia, self.apto, 200)
        self.documento(al_dia, self.seguro, 5)
        con_vencido = self.jugador("72000042")
        self.documento(con_vencido, self.apto, -3)
        self.documento(con_vencido, self.seguro, 200)
        docente_al_dia = self.docente("72000043")
        self.documento(docente_al_dia, self.seguro, 200)
        self.docente("72000044")

        documentation = self.summary()["documentation"]

        self.assertEqual(documentation["players"], {"total": 2, "up_to_date": 1})
        self.assertEqual(documentation["teachers"], {"total": 2, "up_to_date": 1})
        self.assertEqual(documentation["documents"], {"valid": 4, "missing": 1, "expired": 1})
