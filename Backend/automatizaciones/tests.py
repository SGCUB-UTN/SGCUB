from datetime import date, timedelta
from unittest.mock import Mock, patch

from django.contrib.admin.sites import site
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import RequestFactory, TestCase
from django.urls import reverse
from django.utils import timezone
from django_q.conf import Conf
from django_q.models import Schedule, Task
from django_q.scheduler import scheduler
from rest_framework import status
from rest_framework.test import APITestCase

from padron.models import (
    ActualizacionCategoriasEjecucion, Categoria, Genero, Jugador, Persona, RecategorizacionEjecucion, Socio,
    get_anio_actual,
)
from padron.services import run_recategorization


class AutomatizacionesAdminTests(TestCase):
    def test_admin_de_schedules_no_permite_alta_baja_ni_edicion(self):
        schedule_admin = site._registry[Schedule]
        request = RequestFactory().get("/admin/django_q/schedule/")

        self.assertFalse(schedule_admin.has_add_permission(request))
        self.assertFalse(schedule_admin.has_delete_permission(request))
        self.assertEqual(
            set(schedule_admin.get_readonly_fields(request)),
            {field.name for field in Schedule._meta.fields},
        )


class AutomatizacionesApiTests(APITestCase):
    def setUp(self):
        self.administrador = get_user_model().objects.create_user(username="administrador")
        self.administrador.groups.add(Group.objects.get(name="Administrador"))
        self.schedule = Schedule.objects.create(
            name="Automatización de prueba",
            func="finanzas.services.apply_surcharges",
            schedule_type=Schedule.DAILY,
            repeats=-1,
            next_run=timezone.now(),
            cluster=Conf.CLUSTER_NAME,
        )

    def test_lista_schedules_y_estado_actual(self):
        self.client.force_authenticate(self.administrador)

        response = self.client.get(reverse("automatizacion-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schedule = next(item for item in response.data if item["id"] == self.schedule.pk)
        self.assertTrue(schedule["is_active"])
        self.assertEqual(schedule["name"], self.schedule.name)

    def test_lista_ejecuciones_reales_y_pagina_de_cinco_registros(self):
        self.client.force_authenticate(self.administrador)
        now = timezone.now()
        for index in range(6):
            Task.objects.create(
                id=f"{index:032x}",
                name=f"Ejecución {index}",
                func=self.schedule.func,
                started=now,
                stopped=now + timedelta(seconds=index),
                success=index % 2 == 0,
            )

        primera_pagina = self.client.get(reverse("automatizacion-ejecuciones"), {"page": 1})
        segunda_pagina = self.client.get(reverse("automatizacion-ejecuciones"), {"page": 2})

        self.assertEqual(primera_pagina.status_code, status.HTTP_200_OK)
        self.assertEqual(primera_pagina.data["count"], 6)
        self.assertEqual(len(primera_pagina.data["results"]), 5)
        self.assertEqual(primera_pagina.data["results"][0]["automation"], self.schedule.name)
        self.assertFalse(primera_pagina.data["results"][0]["success"])
        self.assertEqual(len(segunda_pagina.data["results"]), 1)
        self.assertEqual(segunda_pagina.data["page"], 2)

    def test_ejecuciones_rechaza_un_numero_de_pagina_invalido(self):
        self.client.force_authenticate(self.administrador)

        response = self.client.get(reverse("automatizacion-ejecuciones"), {"page": "0"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_desactivar_y_activar_persiste_el_estado_en_django_q(self):
        self.client.force_authenticate(self.administrador)
        url = reverse("automatizacion-detail", args=[self.schedule.pk])

        desactivar = self.client.patch(url, {"is_active": False}, format="json")

        self.assertEqual(desactivar.status_code, status.HTTP_200_OK)
        self.schedule.refresh_from_db()
        self.assertEqual(self.schedule.repeats, 0)
        self.assertFalse(desactivar.data["is_active"])

        activar = self.client.patch(url, {"is_active": True}, format="json")

        self.assertEqual(activar.status_code, status.HTTP_200_OK)
        self.schedule.refresh_from_db()
        self.assertEqual(self.schedule.repeats, -1)
        self.assertTrue(activar.data["is_active"])

    def test_django_q_no_encola_un_schedule_desactivado(self):
        self.schedule.repeats = 0
        self.schedule.next_run = timezone.now() - timedelta(minutes=1)
        self.schedule.save(update_fields=["repeats", "next_run"])

        with (
            patch("django_q.scheduler.async_task") as enqueue_task,
            patch("django_q.scheduler.close_old_django_connections"),
        ):
            scheduler(broker=Mock())

        enqueue_task.assert_not_called()

    def test_solo_se_puede_modificar_el_estado(self):
        self.client.force_authenticate(self.administrador)

        response = self.client.patch(
            reverse("automatizacion-detail", args=[self.schedule.pk]),
            {"is_active": False, "name": "Nombre alterado"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.schedule.refresh_from_db()
        self.assertEqual(self.schedule.name, "Automatización de prueba")
        self.assertEqual(self.schedule.repeats, -1)

    def test_no_se_pueden_crear_ni_eliminar_schedules(self):
        self.client.force_authenticate(self.administrador)

        crear = self.client.post(reverse("automatizacion-list"), {}, format="json")
        eliminar = self.client.delete(reverse("automatizacion-detail", args=[self.schedule.pk]))

        self.assertEqual(crear.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(eliminar.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Schedule.objects.filter(pk=self.schedule.pk).exists())

    def test_sin_permiso_de_admin_no_se_puede_modificar(self):
        usuario = get_user_model().objects.create_user(username="lector")
        self.client.force_authenticate(usuario)

        listado = self.client.get(reverse("automatizacion-list"))
        cambio = self.client.patch(
            reverse("automatizacion-detail", args=[self.schedule.pk]),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(listado.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(cambio.status_code, status.HTTP_403_FORBIDDEN)


class RecategorizationApiTests(APITestCase):
    def setUp(self):
        self.administrador = get_user_model().objects.create_user(
            username="administrador", first_name="Ana", last_name="Admin"
        )
        self.administrador.groups.add(Group.objects.get(name="Administrador"))
        self.client.force_authenticate(self.administrador)
        self.male, _ = Genero.objects.get_or_create(nombre="Masculino")
        Categoria.objects.all().delete()
        self.categories = {
            name: Categoria.objects.create(nombre=name, edad_maxima=max_age, genero="M", anio_vigente=2026)
            for name, max_age in [("2016", 10), ("2015", 11), ("PRE 9NA", 12), ("9NA", 13), ("4TA", 19)]
        }
        self.dni_counter = 40000000

    def create_player(self, birth_year, category, secondary=None):
        self.dni_counter += 1
        person = Persona.objects.create(
            nombre="Jugador",
            apellido=str(self.dni_counter),
            dni=str(self.dni_counter),
            fecha_nacimiento=date(birth_year, 6, 1),
            genero=self.male,
        )
        return Jugador.objects.create(
            socio=Socio.objects.create(persona=person), categoria=category, categoria_secundaria=secondary
        )

    def run_execution(self):
        RecategorizacionEjecucion.objects.create(
            anio=2025, ejecutado_por="Admin", estado=RecategorizacionEjecucion.EstadoChoices.FINALIZADA,
            fecha_inicio=timezone.now() - timedelta(days=365),
        )
        self.promoted = self.create_player(2015, self.categories["2016"])
        self.unchanged = self.create_player(2016, self.categories["2016"])
        self.secondary_matches = self.create_player(
            2015, self.categories["9NA"], secondary=self.categories["2015"]
        )
        self.playing_up = self.create_player(2014, self.categories["9NA"])
        execution = RecategorizacionEjecucion.objects.create(anio=2026, ejecutado_por="Administrador")
        run_recategorization(execution.pk)
        return execution

    def result_for(self, execution, player):
        return execution.resultados.get(jugador=player)

    def decide(self, result, **data):
        return self.client.post(reverse("recategorizacion-decision", args=[result.pk]), data, format="json")

    def test_status_without_runs_is_empty(self):
        response = self.client.get(reverse("recategorizacion-estado"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["ultima_ejecucion"])

    def test_status_returns_latest_run_summary(self):
        execution = self.run_execution()

        response = self.client.get(reverse("recategorizacion-estado"))

        summary = response.data["ultima_ejecucion"]
        self.assertEqual(summary["id"], execution.pk)
        self.assertEqual(summary["ejecutado_por"], "Administrador")
        self.assertEqual(summary["estado"], "revision_pendiente")
        self.assertEqual((summary["exitosos"], summary["pendientes"], summary["errores"]), (2, 2, 0))
        self.assertEqual(summary["pendientes_sin_revisar"], 2)

    def test_run_requires_who_executes_it(self):
        response = self.client.post(reverse("recategorizacion-ejecutar"), {"ejecutado_por": "  "}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ejecutado_por", response.data)

    def test_run_is_enqueued_and_blocked_while_another_is_active(self):
        with patch("django_q.tasks.async_task") as enqueue, self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("recategorizacion-ejecutar"), {"ejecutado_por": "Ana Admin"}, format="json"
            )
        repeated = self.client.post(reverse("recategorizacion-ejecutar"), {"ejecutado_por": "Ana Admin"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["ultima_ejecucion"]["estado"], "en_curso")
        enqueue.assert_called_once_with("padron.services.run_recategorization", response.data["ultima_ejecucion"]["id"])
        execution = RecategorizacionEjecucion.objects.get(pk=response.data["ultima_ejecucion"]["id"])
        self.assertEqual(execution.usuario, self.administrador)
        self.assertEqual(repeated.status_code, status.HTTP_409_CONFLICT)

    def test_run_is_rejected_while_categories_are_outdated(self):
        Categoria.objects.filter(pk=self.categories["4TA"].pk).update(anio_vigente=get_anio_actual() - 1)

        status_response = self.client.get(reverse("recategorizacion-estado"))
        with patch("django_q.tasks.async_task") as enqueue:
            response = self.client.post(
                reverse("recategorizacion-ejecutar"), {"ejecutado_por": "Ana Admin"}, format="json"
            )

        self.assertFalse(status_response.data["categorias"]["actualizadas"])
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("Primero actualizá las categorías", response.data["detail"])
        enqueue.assert_not_called()

    def test_results_are_filtered_by_type_and_sorted_by_birth_year(self):
        execution = self.run_execution()
        url = reverse("recategorizacion-resultados", args=[execution.pk])

        successes = self.client.get(url, {"tipo": "exito"})
        successes_desc = self.client.get(url, {"tipo": "exito", "orden": "desc"})
        pending = self.client.get(url, {"tipo": "pendiente"})
        invalid = self.client.get(url, {"tipo": "otro"})
        invalid_order = self.client.get(url, {"tipo": "exito", "orden": "x"})

        self.assertEqual([row["anio_nacimiento"] for row in successes.data["results"]], [2015, 2016])
        self.assertEqual([row["anio_nacimiento"] for row in successes_desc.data["results"]], [2016, 2015])
        self.assertEqual(invalid_order.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(successes.data["results"][0]["categoria_anterior"]["nombre"], "2016")
        self.assertEqual(successes.data["results"][0]["categoria_nueva"]["nombre"], "2015")
        self.assertEqual([row["anio_nacimiento"] for row in pending.data["results"]], [2014, 2015])
        self.assertEqual(pending.data["results"][1]["motivo"], "secundaria_corresponde")
        self.assertEqual(pending.data["results"][1]["categoria_sugerida"]["nombre"], "2015")
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accepting_suggestion_applies_it_and_logs_the_decision(self):
        execution = self.run_execution()
        result = self.result_for(execution, self.secondary_matches)

        response = self.decide(result, decision="aceptada")
        repeated = self.decide(result, decision="aceptada")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.secondary_matches.refresh_from_db()
        self.assertEqual(self.secondary_matches.categoria, self.categories["2015"])
        self.assertIsNone(self.secondary_matches.categoria_secundaria)
        self.assertEqual(response.data["resultado"]["decision"], "aceptada")
        self.assertEqual(response.data["ultima_ejecucion"]["pendientes_sin_revisar"], 1)
        execution.refresh_from_db()
        self.assertIn("Revisiones manuales:", execution.registro)
        self.assertIn("[SUGERENCIA ACEPTADA]", execution.registro)
        self.assertIn("por Ana Admin", execution.registro)
        self.assertEqual(repeated.status_code, status.HTTP_400_BAD_REQUEST)

    def test_keeping_current_category_leaves_player_untouched(self):
        execution = self.run_execution()

        response = self.decide(self.result_for(execution, self.playing_up), decision="mantenida")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.playing_up.refresh_from_db()
        self.assertEqual(self.playing_up.categoria, self.categories["9NA"])
        self.assertEqual(response.data["resultado"]["categoria_nueva"]["nombre"], "9NA")

    def test_editing_validates_categories_like_the_player_form(self):
        execution = self.run_execution()
        result = self.result_for(execution, self.promoted)

        too_young = self.decide(result, decision="editada", categoria=self.categories["2016"].pk)
        same_as_main = self.decide(
            result,
            decision="editada",
            categoria=self.categories["PRE 9NA"].pk,
            categoria_secundaria=self.categories["PRE 9NA"].pk,
        )
        edited = self.decide(
            result,
            decision="editada",
            categoria=self.categories["PRE 9NA"].pk,
            categoria_secundaria=self.categories["9NA"].pk,
        )

        self.assertEqual(too_young.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("categoria", too_young.data)
        self.assertEqual(same_as_main.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(edited.status_code, status.HTTP_200_OK)
        self.promoted.refresh_from_db()
        self.assertEqual(self.promoted.categoria, self.categories["PRE 9NA"])
        self.assertEqual(self.promoted.categoria_secundaria, self.categories["9NA"])
        self.assertEqual(edited.data["resultado"]["tipo"], "exito")
        self.assertEqual(edited.data["resultado"]["decision"], "editada")

    def test_accept_all_resolves_every_pending_result_and_finishes_the_run(self):
        execution = self.run_execution()

        response = self.client.post(reverse("recategorizacion-aceptar-sugeridos", args=[execution.pk]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["aceptados"], 2)
        self.assertEqual(response.data["ultima_ejecucion"]["estado"], "finalizada")
        self.assertEqual(response.data["ultima_ejecucion"]["pendientes_sin_revisar"], 0)
        self.playing_up.refresh_from_db()
        self.assertEqual(self.playing_up.categoria, self.categories["PRE 9NA"])
        log = self.client.get(reverse("recategorizacion-registro", args=[execution.pk])).data["registro"]
        self.assertEqual(log.count("[SUGERENCIA ACEPTADA]"), 2)
        self.assertIn("Revisión manual completada", log)

    def test_manual_recategorization_runs_appear_in_the_execution_history(self):
        execution = self.run_execution()
        now = timezone.now()
        Task.objects.create(
            id="f" * 32,
            name="Recategorización manual",
            func="padron.services.run_recategorization",
            args=(execution.pk,),
            started=now,
            stopped=now,
            success=True,
        )

        response = self.client.get(reverse("automatizacion-ejecuciones"))

        entry = response.data["results"][0]
        self.assertEqual(entry["automation"], "Recategorización de jugadores")
        self.assertTrue(entry["is_manual"])
        self.assertEqual(entry["executed_by"], "Administrador")
        self.assertEqual(entry["recategorization_id"], execution.pk)

    def test_users_without_permissions_cannot_use_recategorization(self):
        execution = self.run_execution()
        self.client.force_authenticate(get_user_model().objects.create_user(username="lector"))

        status_response = self.client.get(reverse("recategorizacion-estado"))
        run_response = self.client.post(reverse("recategorizacion-ejecutar"), {"ejecutado_por": "X"}, format="json")
        accept_response = self.client.post(reverse("recategorizacion-aceptar-sugeridos", args=[execution.pk]))

        self.assertEqual(status_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(run_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(accept_response.status_code, status.HTTP_403_FORBIDDEN)


class CategoryUpdateApiTests(APITestCase):
    def setUp(self):
        self.administrador = get_user_model().objects.create_user(username="administrador")
        self.administrador.groups.add(Group.objects.get(name="Administrador"))
        self.client.force_authenticate(self.administrador)
        self.current_year = get_anio_actual()
        Categoria.objects.all().delete()
        self.youth = Categoria.objects.create(
            nombre=str(self.current_year - 1 - 11), edad_maxima=11, genero="M", anio_vigente=self.current_year - 1,
        )
        self.adults = Categoria.objects.create(
            nombre="1RA DIVISION", edad_maxima=99, genero="M", anio_vigente=self.current_year - 1,
        )

    def run_update(self, executed_by="Ana Admin"):
        return self.client.post(reverse("categorias-ejecutar"), {"ejecutado_por": executed_by}, format="json")

    def test_status_reports_outdated_categories(self):
        response = self.client.get(reverse("categorias-estado"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["actualizadas"])
        self.assertEqual(response.data["anio_actual"], self.current_year)
        self.assertEqual(response.data["anio_categorias"], self.current_year - 1)
        self.assertIsNone(response.data["ultima_actualizacion"])
        self.assertFalse(response.data["bloqueada_por_recategorizacion"])

    def test_update_requires_who_executes_it(self):
        response = self.run_update("  ")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ejecutado_por", response.data)

    def test_update_moves_categories_to_current_year_and_is_logged(self):
        response = self.run_update()
        repeated = self.run_update()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["actualizadas"])
        self.assertEqual(response.data["ultima_actualizacion"]["ejecutado_por"], "Ana Admin")
        self.assertEqual(response.data["ultima_actualizacion"]["categorias_actualizadas"], 2)
        self.youth.refresh_from_db()
        self.assertEqual(self.youth.anio_vigente, self.current_year)
        self.assertEqual(self.youth.nombre, str(self.current_year - 11))
        update = ActualizacionCategoriasEjecucion.objects.get()
        self.assertEqual(update.usuario, self.administrador)
        self.assertEqual(repeated.status_code, status.HTTP_409_CONFLICT)

    def test_update_appears_in_the_execution_history(self):
        self.run_update()

        entry = self.client.get(reverse("automatizacion-ejecuciones")).data["results"][0]

        self.assertEqual(entry["automation"], "Actualizar las categorías al nuevo año")
        self.assertTrue(entry["success"])
        self.assertTrue(entry["is_manual"])
        self.assertEqual(entry["executed_by"], "Ana Admin")
        self.assertIsNone(entry["recategorization_id"])

    def test_failed_update_is_rolled_back_and_logged_as_failed(self):
        with patch("padron.services.ActualizacionCategoriasEjecucion.objects.create", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                self.run_update()

        self.youth.refresh_from_db()
        self.assertEqual(self.youth.anio_vigente, self.current_year - 1)
        task = Task.objects.get(func="padron.services.pasr_de_anio_vigente_a_categoria")
        self.assertFalse(task.success)
        self.assertEqual(task.result, "boom")

    def test_update_is_blocked_while_a_recategorization_is_active(self):
        RecategorizacionEjecucion.objects.create(
            ejecutado_por="Admin", estado=RecategorizacionEjecucion.EstadoChoices.REVISION_PENDIENTE,
        )

        status_response = self.client.get(reverse("categorias-estado"))
        response = self.run_update()

        self.assertTrue(status_response.data["bloqueada_por_recategorizacion"])
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.youth.refresh_from_db()
        self.assertEqual(self.youth.anio_vigente, self.current_year - 1)

    def test_users_without_permissions_cannot_update_categories(self):
        self.client.force_authenticate(get_user_model().objects.create_user(username="lector"))

        self.assertEqual(self.client.get(reverse("categorias-estado")).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.run_update().status_code, status.HTTP_403_FORBIDDEN)
