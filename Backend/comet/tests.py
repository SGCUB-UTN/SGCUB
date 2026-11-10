import io
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from documental.models import Documento, EstadoDocumento, TipoDocumento
from padron.models import (
    Categoria,
    EstadoAdministrativo,
    EstadoDeportivo,
    Genero,
    Jugador,
    Persona,
    Socio,
    VinculoFamiliar,
)


class CometExportacionPlanillaTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="admin_comet")
        self.client.force_authenticate(user=self.user)

        self.genero_m = Genero.objects.first() or Genero.objects.create(nombre="Masculino")
        self.estado_adm = EstadoAdministrativo.objects.first() or EstadoAdministrativo.objects.create(nombre="Activo")
        self.estado_dep = EstadoDeportivo.objects.first() or EstadoDeportivo.objects.create(nombre="Activo")

        self.categoria = Categoria.objects.create(
            nombre="Primera Division",
            anio_vigente=date.today().year,
            genero="M",
        )

        # Crear jugador sin apto
        self.persona1 = Persona.objects.create(
            nombre="Lionel",
            apellido="Messi",
            dni="10101010",
            fecha_nacimiento=date(1987, 6, 24),
            telefono="2214445566",
            email="leo@example.com",
            genero=self.genero_m,
        )
        self.socio1 = Socio.objects.create(
            persona=self.persona1,
            estado_administrativo=self.estado_adm,
            numero_socio=1001,
        )
        self.jugador1 = Jugador.objects.create(
            socio=self.socio1,
            categoria=self.categoria,
            estado=self.estado_dep,
            obra_social="OSDE",
        )

        self.persona_padre = Persona.objects.create(
            nombre="Jorge",
            apellido="Messi",
            dni="10101011",
            telefono="2219998877",
        )
        VinculoFamiliar.objects.create(
            jugador=self.jugador1,
            persona=self.persona_padre,
            relacion="Padre",
            responsable_legal=True,
        )

        # Tipos y estados de documentos
        self.tipo_apto = TipoDocumento.objects.filter(nombre="Apto Físico").first()
        if not self.tipo_apto:
            self.tipo_apto = TipoDocumento.objects.create(nombre="Apto Físico", requiere_vencimiento=True)

        self.estado_vigente = EstadoDocumento.objects.filter(nombre="Vigente").first()
        if not self.estado_vigente:
            self.estado_vigente = EstadoDocumento.objects.create(nombre="Vigente")

    def test_estado_jugador_sin_apto(self):
        url = reverse("comet-estado-jugador", args=[self.jugador1.pk])
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["apto_fisico_vigente"])
        self.assertIsNotNone(res.data["motivo"])

    def test_bloqueo_estricto_exportacion_sin_apto_hu23(self):
        """Regla estricta HU-23: Si no posee apto físico vigente, bloquea la exportación con 400."""
        url = reverse("comet-planilla-jugador", args=[self.jugador1.pk])
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("apto físico", res.data["detail"].lower())

    def test_exportacion_exitosa_con_apto_vigente_retorna_pdf(self):
        # Asignar apto físico vigente
        doc = Documento(
            persona=self.persona1,
            tipo_documento=self.tipo_apto,
            estado_documento=self.estado_vigente,
            nombre="apto_2026.pdf",
            fecha_vencimiento=timezone.now() + timedelta(days=180),
        )
        doc.archivoUrl.save("apto_2026.pdf", ContentFile(b"%PDF-1.4 mock content"), save=True)

        # Consultar estado
        url_estado = reverse("comet-estado-jugador", args=[self.jugador1.pk])
        res_estado = self.client.get(url_estado)
        self.assertEqual(res_estado.status_code, status.HTTP_200_OK)
        self.assertTrue(res_estado.data["apto_fisico_vigente"])
        self.assertIsNotNone(res_estado.data["vencimiento"])

        # Descargar planilla PDF
        url_planilla = reverse("comet-planilla-jugador", args=[self.jugador1.pk])
        res_pdf = self.client.get(url_planilla)
        self.assertEqual(res_pdf.status_code, status.HTTP_200_OK)
        self.assertEqual(res_pdf["Content-Type"], "application/pdf")
        self.assertIn("attachment; filename=", res_pdf["Content-Disposition"])
        self.assertIn("planilla_comet_10101010_Messi.pdf", res_pdf["Content-Disposition"])
        self.assertTrue(res_pdf.content.startswith(b"%PDF"))

    def test_exportacion_categoria_sin_aptos_falla(self):
        url = reverse("comet-planillas-categoria", args=[self.categoria.pk])
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No hay jugadores", res.data["detail"])

    def test_exportacion_categoria_con_aptos_retorna_pdf_consolidado(self):
        # Asignar apto al jugador1
        doc = Documento(
            persona=self.persona1,
            tipo_documento=self.tipo_apto,
            estado_documento=self.estado_vigente,
            nombre="apto_2026.pdf",
            fecha_vencimiento=timezone.now() + timedelta(days=90),
        )
        doc.archivoUrl.save("apto_2026.pdf", ContentFile(b"%PDF-1.4 mock content"), save=True)

        url = reverse("comet-planillas-categoria", args=[self.categoria.pk])
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertIn("planillas_comet_", res["Content-Disposition"])
        self.assertEqual(res["X-Total-Aptos"], "1")
        self.assertEqual(res["X-Total-Excluidos"], "0")
        self.assertTrue(res.content.startswith(b"%PDF"))
