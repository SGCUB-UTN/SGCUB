import io
import shutil
import tempfile
import zipfile
from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
import pypdfium2 as pdfium
from rest_framework.test import APITestCase

from configuracion.models import HistorialConfiguracion
from padron.models import (
    ESTADO_ADMINISTRATIVO_INACTIVO,
    ESTADO_DEPORTIVO_INACTIVO,
    Categoria,
    Docente,
    DocenteCategoria,
    EstadoAdministrativo,
    EstadoDeportivo,
    Jugador,
    Persona,
    Socio,
    VinculoFamiliar,
)

from .markdown import inline_markdown, parse_markdown
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

    def test_pautas_de_convivencia_tiene_plantilla_y_se_pide_a_jugadores(self):
        tipo = TipoDocumento.objects.get(nombre="Pautas de Convivencia")

        self.assertEqual((tipo.aplica_jugador, tipo.aplica_socio, tipo.aplica_docente), (True, False, False))
        self.assertEqual(tipo.plantilla.titulo, "Pautas de Convivencia")
        self.assertTrue(tipo.plantilla.talon_leyenda)
        self.assertFalse(TipoDocumento.objects.filter(nombre="Pauta de Convivencia").exists())

        response = self.client.get(reverse("tipo_documento_list"))
        flags = {item["nombre"]: item["tiene_plantilla"] for item in response.data}
        self.assertTrue(flags["Pautas de Convivencia"])
        self.assertFalse(flags["DNI"])

    def test_no_elimina_un_tipo_con_plantilla(self):
        tipo = TipoDocumento.objects.get(nombre="Pautas de Convivencia")

        response = self.client.delete(reverse("tipo_documento_detail", args=[tipo.pk]))

        self.assertEqual(response.status_code, 400)
        self.assertTrue(TipoDocumento.objects.filter(pk=tipo.pk).exists())

    def test_un_tipo_con_plantilla_se_puede_pedir_a_docentes(self):
        tipo = TipoDocumento.objects.get(nombre="Pautas de Convivencia")

        response = self.client.patch(reverse("tipo_documento_detail", args=[tipo.pk]), {"aplica_docente": True}, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["aplica_docente"])

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

    def test_incluye_foto_carnet_en_zip_vigentes(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.persona.foto = SimpleUploadedFile("avatar.jpg", b"fake image content", content_type="image/jpeg")
        self.persona.save()

        response = self.descargar(alcance="vigentes")
        self.assertEqual(response.status_code, 200)
        with zipfile.ZipFile(io.BytesIO(response.content)) as archivo:
            nombres = archivo.namelist()
            self.assertIn("Foto_Carnet_Paz_Ana.jpg", nombres)
            self.assertEqual(len(nombres), 3)

    def test_descarga_zip_con_solo_foto_carnet(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        Documento.objects.filter(persona=self.persona).delete()
        self.persona.foto = SimpleUploadedFile("avatar.jpg", b"fake image content", content_type="image/jpeg")
        self.persona.save()

        response = self.descargar(alcance="vigentes")
        self.assertEqual(response.status_code, 200)
        with zipfile.ZipFile(io.BytesIO(response.content)) as archivo:
            self.assertEqual(archivo.namelist(), ["Foto_Carnet_Paz_Ana.jpg"])


class PadronDocumentalTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=get_user_model().objects.create_user(username="administrativo"))
        TipoDocumento.objects.update(obligatorio=False)
        self.apto = TipoDocumento.objects.create(nombre="Apto test", obligatorio=True, aplica_docente=False)
        self.seguro = TipoDocumento.objects.create(nombre="Seguro test", obligatorio=True)
        self.cv = TipoDocumento.objects.create(nombre="CV test", obligatorio=True, aplica_jugador=False)
        self.sub12 = Categoria.objects.create(nombre="Sub 12")
        self.sub14 = Categoria.objects.create(nombre="Sub 14")
        self.vigente = EstadoDocumento.objects.get(nombre="Vigente")

    def jugador(self, dni, activo=True):
        jugador = Jugador.objects.create(
            socio=Socio.objects.create(persona=Persona.objects.create(nombre="Jugador", apellido=dni, dni=dni)),
            categoria=self.sub12,
        )
        if not activo:
            jugador.estado = EstadoDeportivo.objects.get_or_create(nombre=ESTADO_DEPORTIVO_INACTIVO)[0]
            jugador.save()
        return jugador

    def docente(self, dni, categorias=(), activo=True):
        docente = Docente.objects.create(persona=Persona.objects.create(nombre="Docente", apellido=dni, dni=dni))
        for categoria in categorias:
            DocenteCategoria.objects.create(docente=docente, categoria=categoria)
        if not activo:
            docente.estado = EstadoAdministrativo.objects.get_or_create(nombre=ESTADO_ADMINISTRATIVO_INACTIVO)[0]
            docente.save()
        return docente

    def documento(self, persona, tipo, dias=None):
        vencimiento = None
        if dias is not None:
            vencimiento = timezone.make_aware(datetime.combine(timezone.localdate() + timedelta(days=dias), time(12)))
        return Documento.objects.create(
            persona=persona, tipo_documento=tipo, estado_documento=self.vigente, fecha_vencimiento=vencimiento
        )

    def padron(self):
        response = self.client.get(reverse("padron_documental"))
        self.assertEqual(response.status_code, 200)
        return response.data

    def persona(self, data, clave):
        return next(persona for persona in data["personas"] if persona["clave"] == clave)

    def estados(self, persona):
        return {documento["tipo_documento"]: documento["estado"] for documento in persona["documentos"]}

    def test_incluye_solo_jugadores_y_docentes_activos(self):
        jugador = self.jugador("71000001")
        docente = self.docente("71000002")
        self.jugador("71000003", activo=False)
        self.docente("71000004", activo=False)
        Socio.objects.create(persona=Persona.objects.create(nombre="Socio", apellido="Pleno", dni="71000005"))

        claves = [persona["clave"] for persona in self.padron()["personas"]]

        self.assertCountEqual(claves, [f"jugador-{jugador.jugador_id}", f"docente-{docente.docente_id}"])

    def test_exige_solo_los_tipos_obligatorios_y_habilitados_de_cada_perfil(self):
        TipoDocumento.objects.create(nombre="Opcional test", obligatorio=False)
        TipoDocumento.objects.create(nombre="Deshabilitado test", obligatorio=True, activo=False)
        jugador = self.jugador("71000011")
        docente = self.docente("71000012")

        data = self.padron()

        self.assertCountEqual(self.estados(self.persona(data, f"jugador-{jugador.jugador_id}")), [self.apto.pk, self.seguro.pk])
        self.assertCountEqual(self.estados(self.persona(data, f"docente-{docente.docente_id}")), [self.seguro.pk, self.cv.pk])

    def test_incluye_los_documentos_opcionales_cargados_sin_inhabilitar(self):
        opcional = TipoDocumento.objects.create(nombre="Opcional test", obligatorio=False)
        jugador = self.jugador("71000111")
        persona = jugador.socio.persona
        for tipo in (self.apto, self.seguro):
            self.documento(persona, tipo)
        self.documento(persona, opcional, dias=-5)

        data = self.persona(self.padron(), f"jugador-{jugador.jugador_id}")
        documento = next(item for item in data["documentos"] if item["tipo_documento"] == opcional.pk)

        self.assertEqual((documento["estado"], documento["obligatorio"]), ("vencido", False))
        self.assertTrue(data["habilitado"])

    def test_calcula_el_estado_de_cada_documento_requerido(self):
        jugador = self.jugador("71000021")
        docente = self.docente("71000022")
        persona_jugador = jugador.socio.persona
        self.documento(persona_jugador, self.apto, dias=-1)
        self.documento(persona_jugador, self.seguro, dias=5)
        self.documento(docente.persona, self.seguro)

        data = self.padron()

        self.assertEqual(self.estados(self.persona(data, f"jugador-{jugador.jugador_id}")), {
            self.apto.pk: "vencido",
            self.seguro.pk: "por_vencer",
        })
        self.assertEqual(self.estados(self.persona(data, f"docente-{docente.docente_id}")), {
            self.seguro.pk: "vigente",
            self.cv.pk: "faltante",
        })

    def test_usa_el_ultimo_documento_cargado_de_cada_tipo(self):
        jugador = self.jugador("71000031")
        persona = jugador.socio.persona
        self.documento(persona, self.apto, dias=-10)
        ultimo = self.documento(persona, self.apto, dias=200)

        documento = self.persona(self.padron(), f"jugador-{jugador.jugador_id}")["documentos"][0]

        self.assertEqual(documento["id_documento"], ultimo.pk)
        self.assertEqual(documento["estado"], "vigente")
        self.assertEqual(documento["fecha_vencimiento"], timezone.localdate() + timedelta(days=200))

    def test_un_documento_por_vencer_habilita_y_uno_vencido_o_faltante_no(self):
        habilitado = self.jugador("71000041")
        vencido = self.jugador("71000042")
        faltante = self.jugador("71000043")
        for jugador, dias_apto in ((habilitado, 3), (vencido, -3), (faltante, None)):
            persona = jugador.socio.persona
            self.documento(persona, self.seguro)
            if dias_apto is not None:
                self.documento(persona, self.apto, dias=dias_apto)

        data = self.padron()

        self.assertTrue(self.persona(data, f"jugador-{habilitado.jugador_id}")["habilitado"])
        self.assertFalse(self.persona(data, f"jugador-{vencido.jugador_id}")["habilitado"])
        self.assertFalse(self.persona(data, f"jugador-{faltante.jugador_id}")["habilitado"])

    def test_informa_el_archivo_del_documento_si_tiene(self):
        media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media_root, ignore_errors=True)
        jugador = self.jugador("71000091")
        with override_settings(MEDIA_ROOT=media_root):
            con_archivo = self.documento(jugador.socio.persona, self.apto)
            con_archivo.archivoUrl.save("apto.pdf", ContentFile(b"%PDF-1.4"), save=True)
            self.documento(jugador.socio.persona, self.seguro)

            documentos = self.persona(self.padron(), f"jugador-{jugador.jugador_id}")["documentos"]

        archivos = {documento["tipo_documento"]: documento["archivo_url"] for documento in documentos}
        self.assertTrue(archivos[self.apto.pk].endswith(".pdf"))
        self.assertIsNone(archivos[self.seguro.pk])

    def test_el_docente_lista_todas_sus_categorias(self):
        docente = self.docente("71000051", categorias=(self.sub14, self.sub12))

        persona = self.persona(self.padron(), f"docente-{docente.docente_id}")

        self.assertEqual([categoria["nombre"] for categoria in persona["categorias"]], ["Sub 12", "Sub 14"])
        self.assertIsNone(persona["socio_id"])

    def reporte(self, **params):
        return self.client.get(reverse("padron_documental_pdf"), params)

    def test_el_reporte_incluye_resumen_y_documentos_filtrados(self):
        vencido = self.jugador("71000061")
        faltante = self.jugador("71000062")
        self.documento(vencido.socio.persona, self.apto, dias=-2)
        self.documento(faltante.socio.persona, self.apto)

        response = self.reporte(estado="vencido", perfil="jugador", tipo=str(self.apto.pk), q="71000061")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("reporte-documental-vencidos-", response["Content-Disposition"])
        self.assertIn(b"Cumplimiento general", response.content)
        self.assertIn(b"71000061", response.content)
        self.assertNotIn(b"71000062", response.content)

    def test_el_nombre_del_reporte_refleja_el_estado(self):
        self.assertIn("reporte-documental-vencidos-", self.reporte(estado="vencido")["Content-Disposition"])
        self.assertIn("reporte-documental-por-vencer-", self.reporte(estado="por_vencer")["Content-Disposition"])
        self.assertIn("reporte-documental-faltantes-", self.reporte(estado="faltante")["Content-Disposition"])
        self.assertIn("reporte-documental-vigentes-", self.reporte(estado="vigente")["Content-Disposition"])
        self.assertIn("reporte-documental-2", self.reporte()["Content-Disposition"])

    def test_el_reporte_filtra_por_tipo_de_documento(self):
        self.jugador("71000101")

        response = self.reporte(tipo=str(self.apto.pk))

        self.assertIn(b"Apto test", response.content)
        self.assertNotIn(b"Seguro test", response.content)

    def test_el_reporte_filtra_por_categoria_del_docente(self):
        self.docente("71000071", categorias=(self.sub14,))
        self.docente("71000072", categorias=(self.sub12,))

        response = self.reporte(categoria=str(self.sub14.pk))

        self.assertIn(b"71000071", response.content)
        self.assertNotIn(b"71000072", response.content)

    def test_el_reporte_rechaza_filtros_invalidos(self):
        for params in ({"estado": "aprobado"}, {"perfil": "socio"}, {"tipo": "apto"}, {"categoria": "abc"}, {"categoria": "gender:X"}):
            with self.subTest(params=params):
                self.assertEqual(self.reporte(**params).status_code, 400)

    def test_sin_obligatorios_las_categorias_afectadas_cuentan_solo_vencidos(self):
        TipoDocumento.objects.update(obligatorio=False)
        persona = self.jugador("71000121").socio.persona
        self.documento(persona, self.apto, dias=-3)
        self.documento(persona, self.seguro, dias=90)

        afectadas = self.padron()["resumen"]["categorias_afectadas"]

        self.assertEqual(
            [(item["categoria"], item["vencidos"], item["faltantes"], item["total"]) for item in afectadas],
            [("Sub 12", 1, 0, 2)],
        )

    def test_resume_el_cumplimiento_y_las_categorias_afectadas(self):
        habilitado = self.jugador("71000081")
        self.jugador("71000082")
        docente = self.docente("71000083", categorias=(self.sub12, self.sub14))
        for tipo in (self.apto, self.seguro):
            self.documento(habilitado.socio.persona, tipo)
        self.documento(docente.persona, self.seguro, dias=-1)

        resumen = self.padron()["resumen"]

        self.assertEqual((resumen["total"], resumen["habilitados"], resumen["inhabilitados"]), (3, 1, 2))
        self.assertEqual(resumen["inhabilitados_por_perfil"], {"jugador": 1, "docente": 1})
        self.assertEqual(resumen["cumplimiento"], 33.3)
        self.assertEqual(resumen["documentos"], {"vigente": 2, "por_vencer": 0, "vencido": 1, "faltante": 3})
        self.assertEqual(
            [(item["categoria"], item["vencidos"], item["faltantes"], item["total"]) for item in resumen["categorias_afectadas"]],
            [("Sub 12", 1, 3, 6), ("Sub 14", 1, 1, 2)],
        )


class MarkdownTests(SimpleTestCase):
    def test_convierte_negrita_cursiva_y_escapa_html(self):
        self.assertEqual(inline_markdown("**Hola** *mundo* <b>"), "<b>Hola</b> <i>mundo</i> &lt;b&gt;")

    def test_combina_negrita_y_cursiva_sin_cruzar_etiquetas(self):
        self.assertEqual(inline_markdown("***ambas*** y **a *b* c**"), "<b><i>ambas</i></b> y <b>a <i>b</i> c</b>")

    def test_agrupa_parrafos_y_listas(self):
        bloques = parse_markdown("Primera línea\nsegunda\n\n1. Uno\n2. Dos\n- Viñeta\n\nFinal")

        self.assertEqual(bloques, [
            {"type": "paragraph", "text": "Primera línea<br/>segunda"},
            {"type": "ordered", "items": ["Uno", "Dos"], "start": 1},
            {"type": "bullet", "items": ["Viñeta"], "start": 1},
            {"type": "paragraph", "text": "Final"},
        ])


class PlantillaDocumentoTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=get_user_model().objects.create_user(username="administrativo"))
        self.tipo = TipoDocumento.objects.get(nombre="Pautas de Convivencia")
        self.plantilla = self.tipo.plantilla
        self.plantilla.cuerpo = "Texto **del reglamento**\n\n1. Respetar"
        self.plantilla.talon_leyenda = "Recibí y acepto las pautas."
        self.plantilla.save()
        self.categoria = Categoria.objects.create(nombre="Sub 14")

    def jugador(self, dni, edad, telefono="2215550000"):
        nacimiento = timezone.localdate().replace(year=timezone.localdate().year - edad) - timedelta(days=1)
        persona = Persona.objects.create(nombre="Lucas", apellido="Gómez", dni=dni, telefono=telefono, fecha_nacimiento=nacimiento)
        return Jugador.objects.create(socio=Socio.objects.create(persona=persona), categoria=self.categoria)

    def responsable(self, jugador):
        persona = Persona.objects.create(nombre="Marta", apellido="Gómez", dni="20111222", telefono="2214440000")
        return VinculoFamiliar.objects.create(persona=persona, jugador=jugador, responsable_legal=True, relacion="Madre")

    def url(self, nombre, persona):
        return reverse(nombre, args=[self.tipo.pk, persona.pk])

    def texto_pdf(self, persona, **params):
        response = self.client.get(self.url("plantilla_documento_pdf", persona), params)
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        self.assertEqual(response["Content-Type"], "application/pdf")
        return " ".join(page.get_textpage().get_text_range() for page in pdfium.PdfDocument(response.content))

    def test_edita_la_plantilla_y_registra_el_cambio(self):
        url = reverse("plantilla_documento_detail", args=[self.tipo.pk])

        response = self.client.patch(url, {"titulo": "Reglamento interno", "firma_jugador_menor": False}, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.get(url).data["titulo"], "Reglamento interno")
        self.assertTrue(HistorialConfiguracion.objects.filter(campo="Plantilla Pautas de Convivencia · Título").exists())
        self.assertTrue(HistorialConfiguracion.objects.filter(campo="Plantilla Pautas de Convivencia · Firma del jugador menor").exists())

    def test_exige_titulo_y_leyenda(self):
        response = self.client.patch(
            reverse("plantilla_documento_detail", args=[self.tipo.pk]), {"titulo": " ", "talon_leyenda": ""}, format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"titulo", "talon_leyenda"})

    def test_agrega_una_plantilla_a_cualquier_tipo(self):
        tipo = TipoDocumento.objects.get(nombre="Apto Físico")
        url = reverse("plantilla_documento_detail", args=[tipo.pk])

        response = self.client.post(url)

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["titulo"], "Apto Físico")
        self.assertIn("Apto Físico", response.data["talon_leyenda"])
        self.assertEqual(self.client.post(url).status_code, 400)
        self.assertTrue(HistorialConfiguracion.objects.filter(campo="Plantilla Apto Físico", valor_nuevo="Alta").exists())

    def test_quita_la_plantilla_y_el_tipo_vuelve_a_poder_eliminarse(self):
        tipo = TipoDocumento.objects.create(nombre="Autorización de viaje")
        url = reverse("plantilla_documento_detail", args=[tipo.pk])
        self.client.post(url)

        response = self.client.delete(url)

        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertTrue(HistorialConfiguracion.objects.filter(campo="Plantilla Autorización de viaje", valor_nuevo="Eliminada").exists())
        self.assertEqual(self.client.delete(reverse("tipo_documento_detail", args=[tipo.pk])).status_code, 204)

    def test_un_tipo_sin_plantilla_no_tiene_plantilla(self):
        tipo = TipoDocumento.objects.get(nombre="DNI")

        self.assertEqual(self.client.get(reverse("plantilla_documento_detail", args=[tipo.pk])).status_code, 404)

    def test_pdf_completo_de_un_jugador_mayor(self):
        jugador = self.jugador("40111222", edad=20)

        texto = self.texto_pdf(jugador.socio.persona)

        for esperado in ("Pautas de Convivencia", "del reglamento", "Respetar", "Lucas Gómez", "40.111.222", "Sub 14", "Recibí y acepto", "Firma del jugador"):
            self.assertIn(esperado, texto)
        self.assertNotIn("RESPONSABLE LEGAL", texto)

    def test_pdf_de_un_menor_incluye_al_responsable_legal(self):
        jugador = self.jugador("50111222", edad=12)
        self.responsable(jugador)

        texto = self.texto_pdf(jugador.socio.persona)

        for esperado in ("RESPONSABLE LEGAL", "Marta Gómez", "20.111.222", "Madre", "Firma del responsable legal", "Firma del jugador"):
            self.assertIn(esperado, texto)

    def test_el_menor_puede_no_firmar(self):
        self.plantilla.firma_jugador_menor = False
        self.plantilla.save()
        jugador = self.jugador("50111223", edad=12)

        texto = self.texto_pdf(jugador.socio.persona)

        self.assertIn("Firma del responsable legal", texto)
        self.assertNotIn("Firma del jugador", texto)

    def test_la_plantilla_puede_omitir_la_categoria(self):
        self.plantilla.mostrar_categoria = False
        self.plantilla.save()
        jugador = self.jugador("40111227", edad=20)

        texto = self.texto_pdf(jugador.socio.persona)

        self.assertIn("Lucas Gómez", texto)
        self.assertNotIn("Categoría", texto)
        self.assertNotIn("Sub 14", texto)

    def test_el_talon_solo_no_incluye_el_cuerpo(self):
        jugador = self.jugador("40111223", edad=20)

        texto = self.texto_pdf(jugador.socio.persona, alcance="talon")

        self.assertIn("Talón de conformidad", texto)
        self.assertNotIn("Respetar", texto)

    def test_pdf_de_un_docente_no_tiene_categoria(self):
        self.tipo.aplica_docente = True
        self.tipo.save()
        docente = Docente.objects.create(persona=Persona.objects.create(nombre="Ana", apellido="Ruiz", dni="30111222"))

        texto = self.texto_pdf(docente.persona)

        self.assertIn("Firma del docente", texto)
        self.assertNotIn("Categoría", texto)

    def test_rechaza_a_quien_no_se_le_pide_el_documento(self):
        docente = Docente.objects.create(persona=Persona.objects.create(nombre="Ana", apellido="Ruiz", dni="30111223"))

        response = self.client.get(self.url("plantilla_documento_pdf", docente.persona))

        self.assertEqual(response.status_code, 400)

    def test_rechaza_un_alcance_desconocido(self):
        jugador = self.jugador("40111224", edad=20)

        response = self.client.get(self.url("plantilla_documento_pdf", jugador.socio.persona), {"alcance": "otro"})

        self.assertEqual(response.status_code, 400)

    def test_imagen_para_whatsapp(self):
        jugador = self.jugador("40111225", edad=20)

        response = self.client.get(self.url("plantilla_documento_imagen", jugador.socio.persona))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertTrue(response.content.startswith(b"\x89PNG"))

    def test_destinatario_es_el_responsable_legal_si_es_menor(self):
        menor = self.jugador("50111224", edad=12)
        self.responsable(menor)
        mayor = self.jugador("40111226", edad=20, telefono="2213330000")

        menor_data = self.client.get(self.url("plantilla_documento_destinatario", menor.socio.persona)).data
        mayor_data = self.client.get(self.url("plantilla_documento_destinatario", mayor.socio.persona)).data

        self.assertEqual(menor_data, {"nombre": "Marta Gómez", "telefono": "2214440000", "es_responsable_legal": True})
        self.assertEqual(mayor_data, {"nombre": "Lucas Gómez", "telefono": "2213330000", "es_responsable_legal": False})


class AlertasDocumentalesTaskTest(APITestCase):
    def test_refresh_document_states_emite_alertas_preventivas_y_da_de_baja_con_renovacion(self):
        from datetime import timedelta
        from unittest.mock import patch
        from configuracion.models import ConfiguracionGeneral
        from comunicaciones.models import EnvioNotificacion, EstadoNotificacion
        from padron.models import (
            Categoria,
            EstadoAdministrativo,
            EstadoDeportivo,
            Jugador,
            Persona,
            Socio,
        )
        from .models import Documento, EstadoDocumento, TipoDocumento
        from .tasks import refresh_document_states

        EstadoDocumento.objects.get_or_create(nombre="Vigente")
        EstadoDocumento.objects.get_or_create(nombre="Vencido")
        est_adm, _ = EstadoAdministrativo.objects.get_or_create(nombre="Activo")
        est_dep, _ = EstadoDeportivo.objects.get_or_create(nombre="Activo")
        cat = Categoria.objects.create(nombre="Juveniles", anio_vigente=2026, genero="M")

        persona = Persona.objects.create(
            nombre="Marcos",
            apellido="Docu",
            dni="44111222",
            email="marcos@example.com",
        )
        socio = Socio.objects.create(persona=persona, estado_administrativo=est_adm)
        jugador = Jugador.objects.create(socio=socio, categoria=cat)
        jugador.estado = est_dep
        jugador.save()

        tipo = TipoDocumento.objects.create(nombre="Apto Físico", requiere_vencimiento=True)

        config = ConfiguracionGeneral.load()
        config.dias_alerta_documentos = 30
        config.save()

        # Documento que vence exactamente en 30 días
        venc_30 = timezone.now() + timedelta(days=30)
        doc = Documento.objects.create(
            persona=persona,
            tipo_documento=tipo,
            fecha_vencimiento=venc_30,
        )

        with patch("comunicaciones.services.enviar_email_individual", return_value=True) as mock_send:
            res = refresh_document_states()
            self.assertGreaterEqual(res["alertas_enviadas"], 1)

            envios = EnvioNotificacion.objects.filter(socio=socio)
            self.assertTrue(envios.exists())
            self.assertEqual(envios.first().estado, EstadoNotificacion.ENVIADA)

        # Renovación documental: se carga nuevo documento con vencimiento a 180 días
        doc_nuevo = Documento.objects.create(
            persona=persona,
            tipo_documento=tipo,
            fecha_vencimiento=timezone.now() + timedelta(days=180),
        )
        self.assertEqual(doc_nuevo.estado_documento.nombre, "Vigente")

    def test_alertas_no_duplican_y_notifican_docentes_y_socios_simultaneos(self):
        from datetime import timedelta
        from unittest.mock import patch
        from configuracion.models import ConfiguracionGeneral
        from padron.models import Docente, EstadoAdministrativo, Persona, Socio
        from .models import Documento, EstadoDocumento, TipoDocumento
        from .tasks import refresh_document_states

        EstadoDocumento.objects.get_or_create(nombre="Vigente")
        EstadoDocumento.objects.get_or_create(nombre="Vencido")
        est_adm, _ = EstadoAdministrativo.objects.get_or_create(nombre="Activo")
        tipo = TipoDocumento.objects.create(nombre="Certificado Médico", requiere_vencimiento=True)

        config = ConfiguracionGeneral.load()
        config.dias_alerta_documentos = 30
        config.save()

        # Socio y Docente con el MISMO tipo de documento y MISMA fecha de vencimiento
        p_socio = Persona.objects.create(nombre="Socio1", apellido="Test", dni="11111111", email="socio1@example.com")
        socio = Socio.objects.create(persona=p_socio, estado_administrativo=est_adm)

        p_docente = Persona.objects.create(nombre="Docente1", apellido="Test", dni="22222222", email="docente1@example.com")
        docente = Docente.objects.create(persona=p_docente, estado=est_adm)

        venc_30 = timezone.now() + timedelta(days=30)
        doc_socio = Documento.objects.create(persona=p_socio, tipo_documento=tipo, fecha_vencimiento=venc_30)
        doc_docente = Documento.objects.create(persona=p_docente, tipo_documento=tipo, fecha_vencimiento=venc_30)

        with patch("comunicaciones.services.enviar_email_individual", return_value=True) as mock_send:
            res1 = refresh_document_states()
            # Ambos deben recibir su alerta
            self.assertEqual(res1["alertas_enviadas"], 2)

            # Segunda ejecución: no debe duplicar para nadie
            res2 = refresh_document_states()
            self.assertEqual(res2["alertas_enviadas"], 0)
