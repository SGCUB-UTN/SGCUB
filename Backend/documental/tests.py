import io
import shutil
import tempfile
import zipfile

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from padron.models import Persona

from .models import Documento, EstadoDocumento, TipoDocumento


class TipoDocumentoTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=get_user_model().objects.create_user(username="administrativo"))
        self.persona = Persona.objects.create(nombre="Ana", apellido="Paz", dni="70000001")

    def crear(self, **datos):
        return self.client.post(reverse("tipo_documento_list"), {"nombre": "Ficha médica", **datos}, format="json")

    def subir(self, tipo, **datos):
        return self.client.post(
            reverse("documento_list_create"),
            {"persona": self.persona.pk, "tipo_documento": tipo.pk, **datos},
            format="json",
        )

    def test_los_tipos_iniciales_conservan_los_perfiles_a_los_que_aplicaban(self):
        cv = TipoDocumento.objects.get(nombre="CV")
        dni = TipoDocumento.objects.get(nombre="DNI")
        apto = TipoDocumento.objects.get(nombre="Apto Físico")

        self.assertEqual((cv.aplica_jugador, cv.aplica_docente), (False, True))
        self.assertEqual((dni.aplica_jugador, dni.aplica_docente), (True, True))
        self.assertEqual((apto.aplica_jugador, apto.aplica_docente), (True, False))

    def test_alta_y_edicion(self):
        response = self.crear(requiere_vencimiento=True, vigencia_meses=12, aplica_docente=False)
        self.assertEqual(response.status_code, 201, response.data)

        url = reverse("tipo_documento_detail", args=[response.data["id_tipo_documento"]])
        response = self.client.patch(url, {"nombre": "Ficha médica anual", "obligatorio": True}, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        tipo = TipoDocumento.objects.get(nombre="Ficha médica anual")
        self.assertTrue(tipo.obligatorio)
        self.assertEqual(tipo.vigencia_meses, 12)

    def test_validaciones(self):
        casos = [
            ({"nombre": "dni"}, "nombre"),
            ({"aplica_jugador": False, "aplica_socio": False, "aplica_docente": False}, "perfiles"),
            ({"vigencia_meses": 0}, "vigencia_meses"),
        ]
        for datos, campo in casos:
            with self.subTest(datos=datos):
                response = self.crear(**datos)
                self.assertEqual(response.status_code, 400)
                self.assertIn(campo, response.data)

    def test_no_elimina_un_tipo_con_documentos(self):
        tipo = TipoDocumento.objects.get(nombre="DNI")
        self.subir(tipo)

        response = self.client.delete(reverse("tipo_documento_detail", args=[tipo.pk]))

        self.assertEqual(response.status_code, 400)
        self.assertTrue(TipoDocumento.objects.filter(pk=tipo.pk).exists())

    def test_elimina_un_tipo_sin_documentos(self):
        tipo_id = self.crear().data["id_tipo_documento"]

        response = self.client.delete(reverse("tipo_documento_detail", args=[tipo_id]))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(TipoDocumento.objects.filter(pk=tipo_id).exists())

    def test_un_tipo_deshabilitado_no_admite_documentos_nuevos(self):
        tipo = TipoDocumento.objects.get(nombre="DNI")
        tipo.activo = False
        tipo.save()

        response = self.subir(tipo)

        self.assertEqual(response.status_code, 400)
        self.assertIn("tipo_documento", response.data)
        self.assertNotIn(tipo.pk, [item["id_tipo_documento"] for item in self.client.get(
            reverse("tipo_documento_list"), {"activos": "true"}).data])

    def test_exige_vencimiento_si_el_tipo_lo_requiere(self):
        tipo = TipoDocumento.objects.create(nombre="Seguro", requiere_vencimiento=True)

        sin_vencimiento = self.subir(tipo)
        con_vencimiento = self.subir(tipo, fecha_vencimiento="2030-01-01T00:00:00")

        self.assertEqual(sin_vencimiento.status_code, 400)
        self.assertIn("fecha_vencimiento", sin_vencimiento.data)
        self.assertEqual(con_vencimiento.status_code, 201, con_vencimiento.data)
        self.assertEqual(Documento.objects.filter(tipo_documento=tipo).count(), 1)


class DescargaZipTests(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media_root, ignore_errors=True)
        settings_override = override_settings(MEDIA_ROOT=self.media_root)
        settings_override.enable()
        self.addCleanup(settings_override.disable)
        self.client.force_authenticate(user=get_user_model().objects.create_user(username="administrativo"))
        self.persona = Persona.objects.create(nombre="Ana", apellido="Paz", dni="70000002")
        self.estado = EstadoDocumento.objects.first() or EstadoDocumento.objects.create(nombre="Vigente")
        dni = TipoDocumento.objects.get(nombre="DNI")
        apto = TipoDocumento.objects.get(nombre="Apto Físico")
        self.dni_anterior = self.documento(dni, "dni-2025.pdf")
        self.dni_actual = self.documento(dni, "dni-2026.pdf")
        self.apto = self.documento(apto, "apto.pdf")

    def documento(self, tipo, nombre_archivo):
        documento = Documento(tipo_documento=tipo, estado_documento=self.estado, persona=self.persona, nombre=nombre_archivo)
        documento.archivoUrl.save(nombre_archivo, ContentFile(b"%PDF-1.4"), save=True)
        return documento

    def descargar(self, **params):
        return self.client.get(reverse("download_zip", args=[self.persona.pk]), params)

    def archivos(self, response):
        with zipfile.ZipFile(io.BytesIO(response.content)) as archivo:
            return len(archivo.namelist())

    def test_sin_alcance_descarga_todos_los_documentos(self):
        response = self.descargar()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.archivos(response), 3)

    def test_vigentes_descarga_la_ultima_version_de_cada_tipo(self):
        response = self.descargar(alcance="vigentes")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.archivos(response), 2)
        self.assertIn("_vigentes.zip", response["Content-Disposition"])

    def test_historial_descarga_solo_las_versiones_anteriores(self):
        response = self.descargar(alcance="historial")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.archivos(response), 1)

    def test_historial_vacio_responde_404(self):
        self.dni_anterior.delete()

        self.assertEqual(self.descargar(alcance="historial").status_code, 404)

    def test_rechaza_un_alcance_desconocido(self):
        self.assertEqual(self.descargar(alcance="otros").status_code, 400)
