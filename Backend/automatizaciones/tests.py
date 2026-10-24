from datetime import timedelta
from unittest.mock import Mock, patch

from django.contrib.admin.sites import site
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import RequestFactory, TestCase
from django.urls import reverse
from django.utils import timezone
from django_q.conf import Conf
from django_q.models import Schedule
from django_q.scheduler import scheduler
from rest_framework import status
from rest_framework.test import APITestCase


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

        with patch("django_q.scheduler.async_task") as enqueue_task:
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
