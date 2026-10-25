from django.contrib.auth import get_user_model
from django.db.models import ProtectedError
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from padron.serializers import SocioSerializer

from datetime import date, timedelta
from unittest.mock import patch

from .models import ActualizacionCategoriasEjecucion, CargoDocente, Categoria, VinculoFamiliar, Docente, DocenteCategoria, EstadoDeportivo, EstadoAdministrativo, Genero, Jugador, Localidad, Barrio, Persona, RecategorizacionEjecucion, RecategorizacionResultado, Socio, get_anio_actual
from .services import (
    CategoriesOutdated,
    RecategorizationInProgress,
    build_category_ladders,
    classify_player,
    pasr_de_anio_vigente_a_categoria,
    run_recategorization,
    start_recategorization,
)


class PadronViewTests(APITestCase):
    def setUp(self):
        # Toda la API requiere un usuario autenticado
        self.user = get_user_model().objects.create_user(username="30123456", password="Clave-segura-123")
        self.client.force_authenticate(self.user)
        self.persona_data = {
            "nombre": "Juan",
            "apellido": "Perez",
            "dni": "12345678",
            "telefono": "123456789",
        }
        self.persona_counter = 1
        self.genero = Genero.objects.create(nombre="Masculino")
        self.localidad = Localidad.objects.create(nombre="La Plata")
        self.socio_data = {}
        self.categoria_data = {
            "nombre": "Inferior",
            "anio_vigente": 2026,
            "edad_maxima": 12,
            "genero": "M",
        }

    # ------------------------------------------------------------------
    # Helpers para crear vía API (usados en los tests que prueban POST)
    # ------------------------------------------------------------------
    def datos_alta_persona(self, **kwargs):
        """Payload de alta con todos los campos obligatorios de una persona."""
        return {
            **self.persona_data,
            "email": "juan.perez@example.com",
            "fecha_nacimiento": "1990-05-10",
            "genero": self.genero.pk,
            "domicilio_calle": "Calle 7",
            "domicilio_numero": "1234",
            "domicilio_localidad": self.localidad.pk,
            **kwargs,
        }

    def create_persona(self, data=None):
        return self.client.post(
            "/api/padron/persona/", data if data is not None else self.datos_alta_persona(), format="json"
        )

    def create_socio(self, data=None):
        payload = data if data is not None else {**self.datos_alta_persona(), **self.socio_data}
        return self.client.post("/api/padron/socio/", payload, format="json")

    def create_categoria(self, data=None):
        return self.client.post(
            "/api/padron/categoria/", data if data is not None else self.categoria_data, format="json"
        )

    def contacto_payload(self, dni="20111222", responsable_legal=True):
        return {
            "persona": {"dni": dni, "nombre": "Ana", "apellido": "Perez", "telefono": "221555"},
            "relacion": "Madre",
            "responsable_legal": responsable_legal,
        }

    def datos_jugador(self, categoria_id, **kwargs):
        """Payload deportivo con los campos obligatorios (sin el socio)."""
        return {
            "categoria": categoria_id,
            "obra_social": "OSDE",
            "tallaIndumentaria": "M",
            "vinculos_familiares": [self.contacto_payload()],
            **kwargs,
        }

    def create_jugador(self, socio_id, categoria_id, **kwargs):
        return self.client.post(
            "/api/padron/jugador/",
            {"socio": socio_id, **self.datos_jugador(categoria_id, **kwargs)},
            format="json",
        )

    def cargo(self, nombre="Director técnico o formador"):
        return CargoDocente.objects.get(nombre=nombre)

    def create_docente(self, persona_id, asignaciones=None, **kwargs):
        if asignaciones is None:
            asignaciones = [{"cargo": self.cargo().pk, "categorias": [self.crear_categoria_orm().pk]}]
        return self.client.post(
            "/api/padron/docente/",
            {"persona": persona_id, "asignaciones": asignaciones, **kwargs},
            format="json",
        )

    # ------------------------------------------------------------------
    # Helpers para crear directo vía ORM (usados para armar el estado
    # previo en tests de GET/PUT/PATCH/DELETE, sin depender del POST)
    # ------------------------------------------------------------------
    def crear_persona_orm(self, **kwargs):
        data = {**self.persona_data, **kwargs}
        if "dni" not in kwargs:
            if Persona.objects.filter(dni=data["dni"]).exists():
                while Persona.objects.filter(dni=data["dni"]).exists():
                    data["dni"] = f"1234567{self.persona_counter}"
                    self.persona_counter += 1
        return Persona.objects.create(**data)

    def crear_socio_orm(self, persona=None, **kwargs):
        persona = persona or self.crear_persona_orm()
        data = {"persona": persona, **self.socio_data, **kwargs}
        return Socio.objects.create(**data)

    def crear_categoria_orm(self, **kwargs):
        data = {**self.categoria_data, **kwargs}
        return Categoria.objects.create(**data)

    def crear_socio_menor_orm(self, **kwargs):
        """Socio de 11 años: entra en la categoría de prueba (hasta 12 en la temporada 2026)."""
        persona = self.crear_persona_orm(fecha_nacimiento=date(2015, 3, 1), **kwargs)
        return self.crear_socio_orm(persona=persona)

    def crear_jugador_orm(self, socio=None, categoria=None):
        socio = socio or self.crear_socio_menor_orm()
        categoria = categoria or self.crear_categoria_orm()
        jugador = Jugador.objects.create(socio=socio, categoria=categoria, obra_social="OSDE", tallaIndumentaria="M")
        VinculoFamiliar.objects.create(
            jugador=jugador, relacion="Madre", responsable_legal=True,
            persona=self.crear_persona_orm(dni=f"2{socio.persona.dni[1:]}"),
        )
        return jugador

    def crear_docente_orm(self, persona=None, legajo=None, con_asignacion=True):
        persona = persona or self.crear_persona_orm()
        docente = Docente.objects.create(persona=persona, legajo=legajo)
        if con_asignacion:
            # Categoría propia para no chocar con la de prueba (nombre/año/género son únicos)
            categoria = self.crear_categoria_orm(nombre=f"Docente {docente.pk}")
            DocenteCategoria.objects.create(docente=docente, categoria=categoria, cargo=self.cargo())
        return docente

    # ==================================================================
    # PERSONA
    # ==================================================================
    def test_persona_post(self):
        response = self.create_persona()
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)
        self.assertEqual(self.persona_data["dni"], response.data["dni"])
        self.assertIn("persona_id", response.data)

    def test_persona_post_dni_duplicado(self):
        self.crear_persona_orm()
        response = self.create_persona()
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("dni", response.data)

    def test_persona_post_campo_faltante(self):
        data = {"nombre": "Juan", "apellido": "Perez"}
        response = self.create_persona(data)
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("dni", response.data)

    def test_persona_get_list(self):
        self.crear_persona_orm()
        response = self.client.get("/api/padron/persona/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertGreaterEqual(len(response.data), 1)

    def buscar_personas(self, query):
        response = self.client.get("/api/padron/persona/", {"q": query})
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        return [item["dni"] for item in response.data]

    def test_persona_busqueda_ignora_mayusculas_y_tildes(self):
        persona = self.crear_persona_orm(nombre="Facundo", apellido="Pérez", dni="45870058")
        otra = self.crear_persona_orm(nombre="Ana", apellido="Gómez", dni="30111222")
        for query in ["perez", "PEREZ", "Pérez", "PÉREZ", "facundo"]:
            self.assertEqual([persona.dni], self.buscar_personas(query), query)
        self.assertEqual([otra.dni], self.buscar_personas("gomez"))

    def test_persona_busqueda_nombre_completo_en_cualquier_orden(self):
        persona = self.crear_persona_orm(nombre="Facundo", apellido="Pérez", dni="45870058")
        self.crear_persona_orm(nombre="Facundo", apellido="Gómez", dni="30111222")
        for query in ["facundo perez", "Pérez Facundo", "per fac"]:
            self.assertEqual([persona.dni], self.buscar_personas(query), query)

    def test_persona_busqueda_ene_coincide_con_n(self):
        persona = self.crear_persona_orm(nombre="Lucía", apellido="Muñoz", dni="45870058")
        self.assertEqual([persona.dni], self.buscar_personas("munoz lucia"))
        self.assertEqual([persona.dni], self.buscar_personas("Muñoz"))

    def test_persona_get_detail(self):
        persona = self.crear_persona_orm()
        response = self.client.get(f"/api/padron/persona/{persona.persona_id}/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(persona.nombre, response.data["nombre"])

    def test_persona_get_detail_no_existe(self):
        response = self.client.get("/api/padron/persona/9999/", format="json")
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_persona_put(self):
        persona = self.crear_persona_orm()
        payload = {"nombre": "Juan Carlos", "apellido": "Perez", "dni": persona.dni}
        response = self.client.put(f"/api/padron/persona/{persona.persona_id}/", payload, format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("Juan Carlos", response.data["nombre"])

    def test_persona_patch(self):
        persona = self.crear_persona_orm()
        response = self.client.patch(
            f"/api/padron/persona/{persona.persona_id}/", {"nombre": "Juancito"}, format="json"
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("Juancito", response.data["nombre"])
        self.assertEqual(persona.apellido, response.data["apellido"])

    def test_persona_put_no_existe(self):
        payload = {"nombre": "X", "apellido": "Y", "dni": "99999999"}
        response = self.client.put("/api/padron/persona/9999/", payload, format="json")
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_persona_delete_no_permitido(self):
        persona = self.crear_persona_orm()
        response = self.client.delete(f"/api/padron/persona/{persona.persona_id}/", format="json")
        self.assertEqual(status.HTTP_405_METHOD_NOT_ALLOWED, response.status_code)
        self.assertTrue(Persona.objects.filter(pk=persona.pk).exists())

    def test_persona_con_perfil_no_se_puede_borrar(self):
        socio = self.crear_socio_orm()
        with self.assertRaises(ProtectedError):
            socio.persona.delete()

    def test_persona_post_campos_obligatorios(self):
        response = self.create_persona({"nombre": "Juan", "apellido": "Perez", "dni": "12345678"})
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        for campo in ("telefono", "email", "fecha_nacimiento", "genero",
                      "domicilio_calle", "domicilio_numero", "domicilio_localidad"):
            self.assertIn(campo, response.data)

    def test_persona_post_dni_formato_invalido(self):
        for dni in ("123456", "123456789", "12.345.678", "abcdefg"):
            response = self.create_persona(self.datos_alta_persona(dni=dni))
            self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code, dni)
            self.assertIn("dni", response.data)

    def test_persona_post_dni_7_digitos(self):
        response = self.create_persona(self.datos_alta_persona(dni="1234567"))
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)

    def test_persona_post_email_invalido(self):
        response = self.create_persona(self.datos_alta_persona(email="no-es-un-email"))
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("email", response.data)

    def test_persona_post_email_duplicado(self):
        self.crear_persona_orm(dni="11111111", email="juan.perez@example.com")
        response = self.create_persona()
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)

    def test_persona_post_dni_duplicado_informa_ficha(self):
        socio = self.crear_socio_orm()
        response = self.create_persona(self.datos_alta_persona(dni=socio.persona.dni))
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertEqual(str(socio.persona.pk), response.data["persona_existente"]["persona_id"])
        self.assertNotIn("docente_id", response.data["persona_existente"])
        self.assertEqual(str(socio.pk), response.data["persona_existente"]["socio_id"])

    def test_persona_patch_dni_de_otra_persona(self):
        persona = self.crear_persona_orm()
        otra = self.crear_persona_orm(dni="22222222")
        response = self.client.patch(
            f"/api/padron/persona/{persona.persona_id}/", {"dni": otra.dni}, format="json"
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("dni", response.data)

    def test_persona_patch_no_permite_vaciar_obligatorio(self):
        persona = self.crear_persona_orm()
        response = self.client.patch(
            f"/api/padron/persona/{persona.persona_id}/", {"nombre": ""}, format="json"
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("nombre", response.data)

    def test_persona_edad(self):
        hoy = date.today()
        persona = self.crear_persona_orm(fecha_nacimiento=date(hoy.year - 20, 1, 1))
        self.assertEqual(20, persona.edad)
        persona.fecha_nacimiento = date(hoy.year - 20, 12, 31)
        self.assertEqual(20 if (hoy.month, hoy.day) == (12, 31) else 19, persona.edad)
        response = self.client.get(f"/api/padron/persona/{persona.persona_id}/", format="json")
        self.assertEqual(20, response.data["edad"])

    def test_persona_edad_sin_fecha_nacimiento(self):
        self.assertIsNone(self.crear_persona_orm().edad)

    def test_persona_busqueda(self):
        self.crear_persona_orm(nombre="Juan", apellido="Perez", dni="30111222")
        self.crear_persona_orm(nombre="Maria", apellido="Gomez", dni="40111222")
        self.crear_persona_orm(nombre="Juana", apellido="Gomez", dni="50111222")

        def buscar(q):
            response = self.client.get("/api/padron/persona/", {"q": q})
            self.assertEqual(status.HTTP_200_OK, response.status_code)
            return sorted(p["dni"] for p in response.data)

        self.assertEqual(["30111222", "50111222"], buscar("juan"))
        self.assertEqual(["40111222", "50111222"], buscar("GOMEZ"))
        self.assertEqual(["40111222"], buscar("4011"))
        self.assertEqual(["50111222"], buscar("juana gomez"))

    def test_persona_busqueda_por_numero_socio(self):
        socio = self.crear_socio_orm(persona=self.crear_persona_orm(dni="30111222"))
        self.crear_persona_orm(dni="40111222")
        response = self.client.get("/api/padron/persona/", {"q": str(socio.numero_socio)})
        self.assertEqual(["30111222"], [p["dni"] for p in response.data])

    def test_persona_busqueda_limita_resultados(self):
        for index in range(12):
            self.crear_persona_orm(apellido="Gomez", dni=f"301112{index:02d}")
        response = self.client.get("/api/padron/persona/", {"q": "gomez"})
        self.assertEqual(10, len(response.data))

    def test_persona_perfiles_incluye_vinculos_familiares(self):
        jugador = self.crear_jugador_orm()
        vinculo = jugador.vinculos_familiares.get()
        response = self.client.get(f"/api/padron/persona/{vinculo.persona_id}/")
        self.assertEqual([{
            "jugador_id": jugador.pk,
            "jugador_nombre": str(jugador.socio.persona),
            "relacion": "Madre",
        }], response.data["perfiles"]["vinculos"])

    def test_vinculo_familiar_no_exige_datos_de_alta(self):
        socio = self.crear_socio_orm()
        jugador = Jugador.objects.create(socio=socio)
        response = self.client.post("/api/padron/vinculo-familiar/", {
            "jugador": jugador.pk,
            "relacion": "Madre",
            "persona": {"dni": "33444555", "nombre": "Ana", "apellido": "Perez", "telefono": "221555"},
        }, format="json")
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertTrue(VinculoFamiliar.objects.filter(persona__dni="33444555").exists())

    # ==================================================================
    # SOCIO
    # ==================================================================
    def test_socio_post(self):
        response = self.create_socio()
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)
        self.assertEqual(self.persona_data["nombre"], response.data["nombre"])
        self.assertEqual(self.persona_data["apellido"], response.data["apellido"])
        self.assertEqual(self.persona_data["dni"], response.data["dni"])
        self.assertEqual(self.persona_data["telefono"], response.data["telefono"])
        self.assertIn("socio_id", response.data)

    def test_socio_post_campo_faltante(self):
        response = self.create_socio(data={"telefono": "123456789"})  # falta persona
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("nombre", response.data)
        self.assertIn("apellido", response.data)
        self.assertIn("dni", response.data)

    def test_socio_post_dni_de_socio_existente_informa_ficha(self):
        socio = self.crear_socio_orm()
        response = self.create_socio(self.datos_alta_persona(dni=socio.persona.dni))
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertEqual(str(socio.pk), response.data["persona_existente"]["socio_id"])

    def test_socio_post_reutiliza_persona_existente(self):
        persona = self.crear_persona_orm(dni="31222333")
        response = self.create_socio(self.datos_alta_persona(dni="31222333"))
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual(persona.pk, Socio.objects.get(pk=response.data["socio_id"]).persona_id)

    def test_socio_get_list(self):
        self.crear_socio_orm()
        response = self.client.get("/api/padron/socio/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertGreaterEqual(len(response.data), 1)

    def test_socio_get_list_filtra_por_es_jugador(self):
        solo_socio = self.crear_socio_orm()
        jugador = self.crear_jugador_orm()

        response = self.client.get("/api/padron/socio/?es_jugador=false", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual([solo_socio.socio_id], [item["socio_id"] for item in response.data])
        self.assertFalse(response.data[0]["es_jugador"])

        response = self.client.get("/api/padron/socio/?es_jugador=true", format="json")
        self.assertEqual([jugador.socio.socio_id], [item["socio_id"] for item in response.data])
        self.assertTrue(response.data[0]["es_jugador"])

    def test_socio_get_list_incluye_ex_jugadores_entre_socios(self):
        jugador = self.crear_jugador_orm()
        jugador.deactivate()

        response = self.client.get("/api/padron/socio/?es_jugador=false", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual([jugador.socio.socio_id], [item["socio_id"] for item in response.data])
        self.assertFalse(response.data[0]["es_jugador"])
        self.assertTrue(response.data[0]["es_ex_jugador"])
        self.assertEqual(jugador.jugador_id, response.data[0]["jugador_id"])

        response = self.client.get("/api/padron/socio/?es_jugador=true", format="json")
        self.assertEqual([], response.data)

    def test_socio_get_list_excluye_jugadores_con_baja_completa(self):
        jugador = self.crear_jugador_orm()
        jugador.socio.deactivate()

        response = self.client.get("/api/padron/socio/?es_jugador=false", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual([], response.data)

        response = self.client.get("/api/padron/socio/?es_jugador=true", format="json")
        self.assertEqual([jugador.socio.socio_id], [item["socio_id"] for item in response.data])

    def test_socio_alta_tras_baja_completa_vuelve_como_ex_jugador(self):
        jugador = self.crear_jugador_orm()
        jugador.socio.deactivate()
        activo = EstadoAdministrativo.objects.get(nombre="Activo")

        response = self.client.patch(
            f"/api/padron/socio/{jugador.socio.socio_id}/", {"estado_administrativo": activo.pk}, format="json"
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        jugador.refresh_from_db()
        self.assertEqual("Inactivo", jugador.estado.nombre)

        response = self.client.get("/api/padron/socio/?es_jugador=false", format="json")
        self.assertEqual([jugador.socio.socio_id], [item["socio_id"] for item in response.data])
        self.assertTrue(response.data[0]["es_ex_jugador"])

    def test_socio_get_list_incluye_socio_inactivo_sin_jugador(self):
        socio = self.crear_socio_orm()
        socio.deactivate()

        response = self.client.get("/api/padron/socio/?es_jugador=false", format="json")
        self.assertEqual([socio.socio_id], [item["socio_id"] for item in response.data])

    def test_socio_get_list_es_jugador_invalido(self):
        response = self.client.get("/api/padron/socio/?es_jugador=quizas", format="json")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_socio_get_detail(self):
        socio = self.crear_socio_orm()
        response = self.client.get(f"/api/padron/socio/{socio.socio_id}/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(socio.persona.nombre, response.data["nombre"])
        self.assertEqual(socio.persona.apellido, response.data["apellido"])
        self.assertEqual(socio.persona.dni, response.data["dni"])

    def test_socio_get_detail_no_existe(self):
        response = self.client.get("/api/padron/socio/9999/", format="json")
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_socio_put(self):
        socio = self.crear_socio_orm()
        payload = {
            "nombre": "Maria",
            "apellido": socio.persona.apellido,
            "dni": socio.persona.dni,
            "telefono": "987654321",
        }
        response = self.client.put(f"/api/padron/socio/{socio.socio_id}/", payload, format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("Maria", response.data["nombre"])
        self.assertEqual("987654321", response.data["telefono"])

    def test_socio_patch(self):
        socio = self.crear_socio_orm()
        response = self.client.patch(
            f"/api/padron/socio/{socio.socio_id}/", {"telefono": "555555"}, format="json"
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("555555", response.data["telefono"])

    def test_socio_delete_es_baja_logica(self):
        socio = self.crear_socio_orm()
        response = self.client.delete(f"/api/padron/socio/{socio.socio_id}/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("Inactivo", response.data["estado_administrativo_nombre"])
        socio.refresh_from_db()
        self.assertEqual("Inactivo", socio.estado_administrativo.nombre)
        self.assertEqual(
            status.HTTP_200_OK,
            self.client.get(f"/api/padron/socio/{socio.socio_id}/", format="json").status_code,
        )

    def test_socio_delete_da_de_baja_su_jugador(self):
        jugador = self.crear_jugador_orm()
        response = self.client.delete(f"/api/padron/socio/{jugador.socio.socio_id}/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        jugador.refresh_from_db()
        self.assertEqual("Inactivo", jugador.estado.nombre)

    def test_socio_patch_inactivo_da_de_baja_su_jugador(self):
        jugador = self.crear_jugador_orm()
        inactivo, _ = EstadoAdministrativo.objects.get_or_create(nombre="Inactivo")
        response = self.client.patch(
            f"/api/padron/socio/{jugador.socio.socio_id}/", {"estado_administrativo": inactivo.pk}, format="json"
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        jugador.refresh_from_db()
        self.assertEqual("Inactivo", jugador.estado.nombre)

    def test_jugador_patch_activo_reactiva_su_socio(self):
        jugador = self.crear_jugador_orm()
        jugador.socio.deactivate()
        activo = EstadoDeportivo.objects.get(nombre="Activo")
        response = self.client.patch(
            f"/api/padron/jugador/{jugador.jugador_id}/", {"estado": activo.pk}, format="json"
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code, response.data)
        jugador.socio.refresh_from_db()
        self.assertEqual("Activo", jugador.socio.estado_administrativo.nombre)

    def test_jugador_post_con_socio_inactivo_lo_reactiva(self):
        socio = self.crear_socio_menor_orm()
        socio.deactivate()
        response = self.client.post("/api/padron/jugador/", {
            "socio": socio.socio_id, **self.datos_jugador(self.crear_categoria_orm().pk),
        }, format="json")
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        socio.refresh_from_db()
        self.assertEqual("Activo", socio.estado_administrativo.nombre)

    def test_socio_post_asigna_activo_numero_y_fecha(self):
        inactivo = EstadoAdministrativo.objects.create(nombre="Inactivo")
        self.crear_socio_orm(numero_socio=41)
        response = self.create_socio({
            **self.datos_alta_persona(dni="32111222"),
            "estado_administrativo": inactivo.pk,
            "numero_socio": 1,
            "fecha_alta": "2000-01-01",
        })
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual("Activo", response.data["estado_administrativo_nombre"])
        self.assertEqual(42, response.data["numero_socio"])
        self.assertEqual(date.today().isoformat(), response.data["fecha_alta"])

    def test_socio_numero_se_reintenta_si_esta_ocupado(self):
        self.crear_socio_orm(numero_socio=5)
        socio = Socio(persona=self.crear_persona_orm())
        real_aggregate = Socio.objects.aggregate
        calls = []

        def stale_aggregate(*args, **kwargs):
            # Simula otra alta concurrente: el primer cálculo ve un máximo desactualizado
            calls.append(1)
            return {"max_number": 4} if len(calls) == 1 else real_aggregate(*args, **kwargs)

        with patch.object(Socio.objects, "aggregate", side_effect=stale_aggregate):
            socio.save()
        self.assertEqual(6, socio.numero_socio)

    def test_jugador_post_nuevo_socio_de_socio_existente_lo_reutiliza(self):
        socio = self.crear_socio_menor_orm(dni="34555666")
        response = self.client.post("/api/padron/jugador/", {
            "nuevo_socio": self.datos_alta_persona(dni="34555666", fecha_nacimiento="2015-03-01"),
            **self.datos_jugador(self.crear_categoria_orm().pk),
        }, format="json")
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual(socio.socio_id, response.data["socio"]["socio_id"])
        self.assertEqual(1, Socio.objects.filter(persona__dni="34555666").count())

    def test_socio_patch_sin_email_no_lo_borra(self):
        socio = self.crear_socio_orm(persona=self.crear_persona_orm(email="socio@example.com"))
        response = self.client.patch(
            f"/api/padron/socio/{socio.socio_id}/", {"telefono": "555555"}, format="json"
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("socio@example.com", response.data["email"])

    def test_socio_patch_reactiva(self):
        socio = self.crear_socio_orm()
        socio.deactivate()
        activo = EstadoAdministrativo.objects.get(nombre="Activo")
        response = self.client.patch(
            f"/api/padron/socio/{socio.socio_id}/", {"estado_administrativo": activo.pk}, format="json"
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("Activo", response.data["estado_administrativo_nombre"])

    def test_socio_con_domicilio_existente_no_duplica_domicilio(self):
        persona = self.crear_persona_orm(dni="33222111")
        self.client.patch(f"/api/padron/persona/{persona.pk}/", {
            "domicilio_calle": "Calle 1", "domicilio_numero": "10", "domicilio_localidad": self.localidad.pk,
        }, format="json")
        persona.refresh_from_db()
        domicilio_id = persona.domicilio_id
        response = self.create_socio(self.datos_alta_persona(dni="33222111", domicilio_calle="Calle 2"))
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        persona.refresh_from_db()
        self.assertEqual(domicilio_id, persona.domicilio_id)
        self.assertEqual("Calle 2", persona.domicilio.calle)

    def test_localidad_post_crea_y_reutiliza_existente(self):
        response = self.client.post("/api/padron/localidad/", {"nombre": "  Magdalena "}, format="json")
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual("Magdalena", response.data["nombre"])
        repetida = self.client.post("/api/padron/localidad/", {"nombre": "magdalena"}, format="json")
        self.assertEqual(response.data["localidad_id"], repetida.data["localidad_id"])
        self.assertEqual(1, Localidad.objects.filter(nombre__iexact="magdalena").count())

    def test_localidad_post_sin_nombre(self):
        response = self.client.post("/api/padron/localidad/", {"nombre": "   "}, format="json")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_barrio_get_filtra_por_localidad(self):
        otra_localidad = Localidad.objects.create(nombre="Berisso Test")
        Barrio.objects.create(nombre="Tolosa", localidad=self.localidad)
        Barrio.objects.create(nombre="Villa Zula", localidad=otra_localidad)
        response = self.client.get(f"/api/padron/barrio/?localidad={self.localidad.pk}")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(["Tolosa"], [barrio["nombre"] for barrio in response.data])

    def test_barrio_post_crea_y_reutiliza_existente(self):
        response = self.client.post("/api/padron/barrio/", {"nombre": "  Los   Ombues ", "localidad": self.localidad.pk}, format="json")
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual("Los Ombues", response.data["nombre"])
        repetido = self.client.post("/api/padron/barrio/", {"nombre": "los ombues", "localidad": self.localidad.pk}, format="json")
        self.assertEqual(response.data["barrio_id"], repetido.data["barrio_id"])
        self.assertEqual(1, Barrio.objects.filter(localidad=self.localidad).count())

    def test_socio_post_con_barrio(self):
        barrio = Barrio.objects.create(nombre="Tolosa", localidad=self.localidad)
        response = self.create_socio(self.datos_alta_persona(domicilio_barrio=barrio.pk))
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual(barrio.pk, response.data["domicilio_barrio"])
        self.assertEqual("Tolosa", response.data["domicilio_barrio_nombre"])

    def test_socio_post_barrio_de_otra_localidad(self):
        barrio = Barrio.objects.create(nombre="Villa Zula", localidad=Localidad.objects.create(nombre="Berisso Test"))
        response = self.create_socio(self.datos_alta_persona(domicilio_barrio=barrio.pk))
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("domicilio_barrio", response.data)

    def test_persona_patch_quita_barrio(self):
        barrio = Barrio.objects.create(nombre="Tolosa", localidad=self.localidad)
        persona_id = self.create_persona(self.datos_alta_persona(domicilio_barrio=barrio.pk)).data["persona_id"]
        response = self.client.patch(f"/api/padron/persona/{persona_id}/", {"domicilio_barrio": ""}, format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code, response.data)
        self.assertIsNone(Persona.objects.get(pk=persona_id).domicilio.barrio)

    def test_socio_delete_no_existe(self):
        response = self.client.delete("/api/padron/socio/9999/", format="json")
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    # ==================================================================
    # CATEGORIA
    # ==================================================================
    def test_categoria_post(self):
        response = self.create_categoria()
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)
        self.assertEqual(self.categoria_data["nombre"], response.data["nombre"])
        self.assertEqual(self.categoria_data["anio_vigente"], response.data["anio_vigente"])
        self.assertEqual(self.categoria_data["edad_maxima"], response.data["edad_maxima"])
        self.assertEqual(self.categoria_data["genero"], response.data["genero"])
        self.assertIn("categoria_id", response.data)

    def test_categoria_post_campo_faltante(self):
        response = self.create_categoria({})
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("nombre", response.data)
        self.assertIn("anio_vigente", response.data)
        self.assertIn("edad_maxima", response.data)
        self.assertIn("genero", response.data)

    def test_categoria_post_genero_invalido(self):
        data = {**self.categoria_data, "genero": "X"}
        response = self.create_categoria(data)
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("genero", response.data)

    def test_categoria_post_edad_negativa(self):
        data = {**self.categoria_data, "edad_maxima": -1}
        response = self.create_categoria(data)
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("edad_maxima", response.data)

    def test_categoria_post_duplicada(self):
        self.crear_categoria_orm()
        response = self.create_categoria()
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_categoria_post_mismo_nombre_distinto_genero(self):
        self.crear_categoria_orm()
        data = {**self.categoria_data, "genero": "F"}
        response = self.create_categoria(data)
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)

    def test_categoria_get_list(self):
        self.crear_categoria_orm()
        response = self.client.get("/api/padron/categoria/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertGreaterEqual(len(response.data), 1)

    def test_categoria_get_detail(self):
        categoria = self.crear_categoria_orm()
        response = self.client.get(f"/api/padron/categoria/{categoria.categoria_id}/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(categoria.nombre, response.data["nombre"])

    def test_categoria_get_detail_no_existe(self):
        response = self.client.get("/api/padron/categoria/9999/", format="json")
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_categoria_put(self):
        categoria = self.crear_categoria_orm()
        payload = {"nombre": "Superior"}
        response = self.client.put(f"/api/padron/categoria/{categoria.categoria_id}/", payload, format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("Superior", response.data["nombre"])

    def test_categoria_delete(self):
        categoria = self.crear_categoria_orm()
        response = self.client.delete(f"/api/padron/categoria/{categoria.categoria_id}/", format="json")
        self.assertEqual(status.HTTP_204_NO_CONTENT, response.status_code)
        self.assertEqual(
            status.HTTP_404_NOT_FOUND,
            self.client.get(f"/api/padron/categoria/{categoria.categoria_id}/", format="json").status_code,
        )

    def test_categoria_delete_no_existe(self):
        response = self.client.delete("/api/padron/categoria/9999/", format="json")
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_categoria_no_se_puede_borrar_si_tiene_jugadores(self):
        jugador = self.crear_jugador_orm()
        response = self.client.delete(f"/api/padron/categoria/{jugador.categoria_id}/")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("1 jugador asignado", response.data["detail"])
        self.assertIn(str(jugador.socio.persona), response.data["detail"])
        self.assertTrue(Categoria.objects.filter(pk=jugador.categoria_id).exists())

    def test_categoria_no_se_puede_borrar_si_es_secundaria_de_un_jugador(self):
        jugador = self.crear_jugador_orm()
        secundaria = self.crear_categoria_orm(nombre="Secundaria")
        jugador.categoria_secundaria = secundaria
        jugador.save()
        response = self.client.delete(f"/api/padron/categoria/{secundaria.pk}/")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("1 jugador asignado", response.data["detail"])
        self.assertTrue(Categoria.objects.filter(pk=secundaria.pk).exists())

    # ==================================================================
    # JUGADOR
    # ==================================================================
    def test_jugador_post(self):
        socio = self.crear_socio_menor_orm()
        categoria = self.crear_categoria_orm()
        response = self.create_jugador(socio.socio_id, categoria.categoria_id)
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual(socio.socio_id, response.data["socio"]["socio_id"])
        self.assertEqual(categoria.categoria_id, response.data["categoria"]["categoria_id"])
        self.assertEqual("Activo", response.data["estado"]["nombre"])
        self.assertIsNone(response.data["categoria_secundaria"])
        self.assertEqual(1, len(response.data["vinculos_familiares"]))

    def test_jugador_post_ignora_estado_enviado(self):
        inactivo = EstadoDeportivo.objects.create(nombre="Inactivo")
        response = self.create_jugador(
            self.crear_socio_menor_orm().socio_id, self.crear_categoria_orm().pk, estado=inactivo.pk
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual("Activo", response.data["estado"]["nombre"])

    def test_jugador_post_campos_obligatorios(self):
        socio = self.crear_socio_menor_orm()
        response = self.client.post("/api/padron/jugador/", {"socio": socio.socio_id}, format="json")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        for campo in ("categoria", "obra_social", "tallaIndumentaria"):
            self.assertIn(campo, response.data)

    def test_jugador_post_talle_invalido(self):
        response = self.create_jugador(
            self.crear_socio_menor_orm().socio_id, self.crear_categoria_orm().pk, tallaIndumentaria="XXXL"
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("tallaIndumentaria", response.data)

    def test_jugador_post_sin_vinculo_familiar(self):
        response = self.create_jugador(
            self.crear_socio_menor_orm().socio_id, self.crear_categoria_orm().pk, vinculos_familiares=[]
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("vinculos_familiares", response.data)

    def test_jugador_post_menor_sin_responsable_legal(self):
        response = self.create_jugador(
            self.crear_socio_menor_orm().socio_id, self.crear_categoria_orm().pk,
            vinculos_familiares=[self.contacto_payload(responsable_legal=False)],
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("responsable legal", str(response.data["vinculos_familiares"]))

    def test_jugador_post_mayor_sin_responsable_legal(self):
        socio = self.crear_socio_orm(persona=self.crear_persona_orm(fecha_nacimiento=date(1990, 1, 1)))
        categoria = self.crear_categoria_orm(nombre="Primera", edad_maxima=99)
        response = self.create_jugador(
            socio.socio_id, categoria.pk, vinculos_familiares=[self.contacto_payload(responsable_legal=False)]
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)

    def test_jugador_post_edad_supera_categoria(self):
        socio = self.crear_socio_orm(persona=self.crear_persona_orm(fecha_nacimiento=date(2012, 3, 1)))
        response = self.create_jugador(socio.socio_id, self.crear_categoria_orm().pk)  # 14 años, tope 12
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("categoria", response.data)

    def test_jugador_post_mas_chico_que_la_categoria_es_valido(self):
        socio = self.crear_socio_orm(persona=self.crear_persona_orm(fecha_nacimiento=date(2018, 3, 1)))
        response = self.create_jugador(socio.socio_id, self.crear_categoria_orm().pk)
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)

    def test_jugador_post_socio_sin_fecha_nacimiento(self):
        response = self.create_jugador(self.crear_socio_orm().socio_id, self.crear_categoria_orm().pk)
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("fecha_nacimiento", response.data)

    def test_jugador_post_categoria_secundaria(self):
        principal = self.crear_categoria_orm()
        secundaria = self.crear_categoria_orm(nombre="Superior", edad_maxima=14)
        response = self.create_jugador(
            self.crear_socio_menor_orm().socio_id, principal.pk, categoria_secundaria=secundaria.pk
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual(secundaria.pk, response.data["categoria_secundaria"]["categoria_id"])

    def test_jugador_post_categoria_secundaria_igual_a_principal(self):
        principal = self.crear_categoria_orm()
        response = self.create_jugador(
            self.crear_socio_menor_orm().socio_id, principal.pk, categoria_secundaria=principal.pk
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("categoria_secundaria", response.data)

    def test_jugador_post_nuevo_socio_directo(self):
        categoria = self.crear_categoria_orm()
        nuevo_socio_payload = {
            "nombre": "Mariano",
            "apellido": "Lopez",
            "dni": "99887766",
            "telefono": "221987654",
            "email": "mariano@example.com",
            "fecha_nacimiento": "2015-03-01",
            "genero": self.genero.pk,
            "domicilio_calle": "Calle 50",
            "domicilio_numero": "100",
            "domicilio_localidad": self.localidad.pk,
        }
        payload = {"nuevo_socio": nuevo_socio_payload, **self.datos_jugador(categoria.categoria_id)}
        response = self.client.post("/api/padron/jugador/", payload, format="json")
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual("Mariano", response.data["socio"]["nombre"])
        self.assertEqual("99887766", response.data["socio"]["dni"])
        self.assertTrue(Socio.objects.filter(persona__dni="99887766").exists())
        self.assertTrue(Jugador.objects.filter(socio__persona__dni="99887766").exists())

    def test_jugador_post_socio_inexistente(self):
        categoria = self.crear_categoria_orm()
        response = self.create_jugador(9999, categoria.categoria_id)
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_jugador_post_categoria_inexistente(self):
        socio = self.crear_socio_menor_orm()
        response = self.create_jugador(socio.socio_id, 9999)
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_jugador_get_list(self):
        self.crear_jugador_orm()
        response = self.client.get("/api/padron/jugador/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertGreaterEqual(len(response.data), 1)

    def test_jugador_get_detail(self):
        jugador = self.crear_jugador_orm()
        response = self.client.get(f"/api/padron/jugador/{jugador.jugador_id}/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(SocioSerializer(jugador.socio).data, response.data["socio"])

    def test_jugador_get_detail_no_existe(self):
        response = self.client.get("/api/padron/jugador/9999/", format="json")
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_jugador_put(self):
        jugador = self.crear_jugador_orm()
        otra_categoria = self.crear_categoria_orm(nombre="Superior")
        payload = {"socio": jugador.socio.socio_id, **self.datos_jugador(otra_categoria.categoria_id)}
        response = self.client.put(f"/api/padron/jugador/{jugador.jugador_id}/", payload, format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code, response.data)
        self.assertEqual(otra_categoria.categoria_id, response.data["categoria"]["categoria_id"])

    def test_jugador_patch_sin_contactos_conserva_los_existentes(self):
        jugador = self.crear_jugador_orm()
        response = self.client.patch(
            f"/api/padron/jugador/{jugador.jugador_id}/", {"obra_social": "IOMA"}, format="json"
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code, response.data)
        self.assertEqual(1, jugador.vinculos_familiares.count())

    def test_jugador_patch_edita_un_vinculo_existente(self):
        jugador = self.crear_jugador_orm()
        contacto = jugador.vinculos_familiares.get()
        payload = self.contacto_payload(dni=contacto.persona.dni)
        payload["persona"]["telefono"] = "2214854719"
        payload["relacion"] = "Tutor"
        response = self.client.patch(f"/api/padron/jugador/{jugador.jugador_id}/", {
            "vinculos_familiares": [{"vinculo_familiar_id": contacto.pk, **payload}],
        }, format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code, response.data)
        contacto.refresh_from_db()
        self.assertEqual(1, jugador.vinculos_familiares.count())
        self.assertEqual("Tutor", contacto.relacion)
        self.assertEqual("2214854719", contacto.persona.telefono)

    def test_jugador_patch_categoria_que_no_corresponde(self):
        jugador = self.crear_jugador_orm()
        chica = self.crear_categoria_orm(nombre="Chica", edad_maxima=9)
        response = self.client.patch(
            f"/api/padron/jugador/{jugador.jugador_id}/", {"categoria": chica.pk}, format="json"
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("categoria", response.data)

    def test_jugador_patch_quitar_responsable_legal_de_menor(self):
        jugador = self.crear_jugador_orm()
        contacto = jugador.vinculos_familiares.get()
        response = self.client.patch(f"/api/padron/jugador/{jugador.jugador_id}/", {
            "vinculos_familiares": [{
                "vinculo_familiar_id": contacto.pk,
                **self.contacto_payload(dni=contacto.persona.dni, responsable_legal=False),
            }],
        }, format="json")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("vinculos_familiares", response.data)

    def test_contacto_no_se_puede_borrar_si_es_el_unico(self):
        jugador = self.crear_jugador_orm()
        contacto = jugador.vinculos_familiares.get()
        response = self.client.delete(f"/api/padron/vinculo-familiar/{contacto.pk}/")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertTrue(VinculoFamiliar.objects.filter(pk=contacto.pk).exists())

    def test_contacto_no_puede_dejar_menor_sin_responsable_legal(self):
        jugador = self.crear_jugador_orm()
        contacto = jugador.vinculos_familiares.get()
        response = self.client.patch(
            f"/api/padron/vinculo-familiar/{contacto.pk}/", {"responsable_legal": False}, format="json"
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("responsable_legal", response.data)

    def test_jugador_patch_with_nuevo_socio(self):
        jugador = self.crear_jugador_orm()
        payload = {
            "socio": jugador.socio.socio_id,
            "nuevo_socio": {
                "nombre": "Juan Actualizado",
                "apellido": jugador.socio.persona.apellido,
                "dni": jugador.socio.persona.dni,
                "telefono": "9999999",
                "email": "juan.actualizado@example.com",
            },
            "obra_social": "SWISS MEDICAL",
        }
        response = self.client.patch(f"/api/padron/jugador/{jugador.jugador_id}/", payload, format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("Juan Actualizado", response.data["socio"]["nombre"])
        self.assertEqual("SWISS MEDICAL", response.data["obra_social"])

    def test_jugador_delete_es_baja_logica(self):
        jugador = self.crear_jugador_orm()
        response = self.client.delete(f"/api/padron/jugador/{jugador.jugador_id}/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("Inactivo", response.data["estado"]["nombre"])
        self.assertEqual("parcial", response.data["tipo_baja"])
        jugador.refresh_from_db()
        self.assertEqual("Inactivo", jugador.estado.nombre)
        self.assertEqual("Activo", jugador.socio.estado_administrativo.nombre)

    def test_jugador_delete_completa_da_de_baja_su_socio(self):
        jugador = self.crear_jugador_orm()
        response = self.client.delete(f"/api/padron/jugador/{jugador.jugador_id}/?completa=true", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("Inactivo", response.data["estado"]["nombre"])
        self.assertEqual("completa", response.data["tipo_baja"])
        jugador.refresh_from_db()
        self.assertEqual("Inactivo", jugador.estado.nombre)
        self.assertEqual("Inactivo", jugador.socio.estado_administrativo.nombre)

    def test_jugador_get_list_informa_tipo_baja(self):
        activo = self.crear_jugador_orm()
        response = self.client.get("/api/padron/jugador/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertIsNone(response.data[0]["tipo_baja"])

        activo.deactivate()
        response = self.client.get("/api/padron/jugador/", format="json")
        self.assertEqual("parcial", response.data[0]["tipo_baja"])

        activo.socio.deactivate()
        response = self.client.get("/api/padron/jugador/", format="json")
        self.assertEqual("completa", response.data[0]["tipo_baja"])

    def test_jugador_delete_no_existe(self):
        response = self.client.delete("/api/padron/jugador/9999/", format="json")
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    # ==================================================================
    # DOCENTE
    # ==================================================================
    def test_docente_post(self):
        persona = self.crear_persona_orm()
        categoria = self.crear_categoria_orm()
        response = self.create_docente(
            persona.persona_id, [{"cargo": self.cargo().pk, "categorias": [categoria.pk]}]
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual(1, response.data["legajo"])
        self.assertEqual(date.today().isoformat(), response.data["fecha_ingreso"])
        self.assertEqual("Activo", response.data["estado_nombre"])
        self.assertEqual(1, len(response.data["asignaciones"]))
        self.assertEqual("Director técnico o formador", response.data["asignaciones"][0]["cargo_nombre"])
        self.assertEqual(categoria.pk, response.data["asignaciones"][0]["categorias"][0]["categoria_id"])

    def test_docente_post_varios_cargos_con_categorias(self):
        primera = self.crear_categoria_orm(nombre="Primera", edad_maxima=99)
        tercera = self.crear_categoria_orm(nombre="Tercera", edad_maxima=20)
        reserva = self.crear_categoria_orm(nombre="Reserva", edad_maxima=23)
        octava = self.crear_categoria_orm(nombre="Octava", edad_maxima=14)
        dt, ayudante = self.cargo(), self.cargo("Ayudante técnico")
        response = self.create_docente(self.crear_persona_orm().pk, [
            {"cargo": dt.pk, "categorias": [primera.pk, tercera.pk]},
            {"cargo": ayudante.pk, "categorias": [reserva.pk, octava.pk]},
        ])
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        asignaciones = {a["cargo_nombre"]: sorted(c["nombre"] for c in a["categorias"]) for a in response.data["asignaciones"]}
        self.assertEqual({
            "Director técnico o formador": ["Primera", "Tercera"],
            "Ayudante técnico": ["Octava", "Reserva"],
        }, asignaciones)
        self.assertEqual(4, DocenteCategoria.objects.filter(docente_id=response.data["docente_id"]).count())

    def test_docente_post_legajo_automatico_ignora_el_enviado(self):
        self.crear_docente_orm(legajo=41)
        response = self.create_docente(self.crear_persona_orm(dni="22333444").pk, legajo=1, fecha_ingreso="2000-01-01")
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual(42, response.data["legajo"])
        self.assertEqual(date.today().isoformat(), response.data["fecha_ingreso"])

    def test_docente_post_ignora_estado_enviado(self):
        inactivo = EstadoAdministrativo.objects.get(nombre="Inactivo")
        response = self.create_docente(self.crear_persona_orm().pk, estado=inactivo.pk)
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual("Activo", response.data["estado_nombre"])

    def test_docente_post_sin_cargos(self):
        response = self.create_docente(self.crear_persona_orm().pk, asignaciones=[])
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("asignaciones", response.data)

    def test_docente_post_cargo_sin_categorias(self):
        response = self.create_docente(self.crear_persona_orm().pk, [{"cargo": self.cargo().pk, "categorias": []}])
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("asignaciones", response.data)

    def test_docente_post_cargo_repetido(self):
        categoria, otra = self.crear_categoria_orm(), self.crear_categoria_orm(nombre="Otra")
        response = self.create_docente(self.crear_persona_orm().pk, [
            {"cargo": self.cargo().pk, "categorias": [categoria.pk]},
            {"cargo": self.cargo().pk, "categorias": [otra.pk]},
        ])
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("asignaciones", response.data)

    def test_docente_post_categoria_en_dos_cargos(self):
        categoria = self.crear_categoria_orm()
        response = self.create_docente(self.crear_persona_orm().pk, [
            {"cargo": self.cargo().pk, "categorias": [categoria.pk]},
            {"cargo": self.cargo("Ayudante técnico").pk, "categorias": [categoria.pk]},
        ])
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("asignaciones", response.data)

    def test_docente_post_persona_ya_es_docente(self):
        docente = self.crear_docente_orm()
        response = self.create_docente(docente.persona.pk)
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertEqual(str(docente.pk), response.data["persona_existente"]["docente_id"])

    def test_docente_estado_independiente_del_socio(self):
        socio = self.crear_socio_orm()
        socio.deactivate()
        response = self.create_docente(socio.persona.pk)
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual("Activo", response.data["estado_nombre"])
        socio.refresh_from_db()
        self.assertEqual("Inactivo", socio.estado_administrativo.nombre)

    def test_cargo_docente_list(self):
        response = self.client.get("/api/padron/cargo-docente/")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(4, len(response.data))

    def test_docente_post_persona_inexistente(self):
        response = self.create_docente(9999)
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_docente_get_list(self):
        self.crear_docente_orm()
        response = self.client.get("/api/padron/docente/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertGreaterEqual(len(response.data), 1)

    def test_docente_get_detail(self):
        docente = self.crear_docente_orm()
        response = self.client.get(f"/api/padron/docente/{docente.docente_id}/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(docente.legajo, response.data["legajo"])

    def test_docente_get_detail_no_existe(self):
        response = self.client.get("/api/padron/docente/9999/", format="json")
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_docente_patch_no_cambia_legajo(self):
        docente = self.crear_docente_orm()
        response = self.client.patch(
            f"/api/padron/docente/{docente.docente_id}/", {"legajo": 3003}, format="json"
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(docente.legajo, response.data["legajo"])

    def test_docente_patch_reemplaza_asignaciones(self):
        response = self.create_docente(self.crear_persona_orm().pk)
        docente_id = response.data["docente_id"]
        nueva = self.crear_categoria_orm(nombre="Nueva")
        response = self.client.patch(f"/api/padron/docente/{docente_id}/", {
            "asignaciones": [{"cargo": self.cargo("Entrenador de arqueros").pk, "categorias": [nueva.pk]}],
        }, format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code, response.data)
        self.assertEqual(1, len(response.data["asignaciones"]))
        self.assertEqual("Entrenador de arqueros", response.data["asignaciones"][0]["cargo_nombre"])
        self.assertEqual(1, DocenteCategoria.objects.filter(docente_id=docente_id).count())

    def test_docente_patch_no_puede_quedar_sin_cargos(self):
        response = self.create_docente(self.crear_persona_orm().pk)
        response = self.client.patch(
            f"/api/padron/docente/{response.data['docente_id']}/", {"asignaciones": []}, format="json"
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_docente_patch_reactiva(self):
        docente = self.crear_docente_orm()
        docente.deactivate()
        activo = EstadoAdministrativo.objects.get(nombre="Activo")
        response = self.client.patch(f"/api/padron/docente/{docente.pk}/", {"estado": activo.pk}, format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("Activo", response.data["estado_nombre"])

    def test_docente_delete_es_baja_logica(self):
        docente = self.crear_docente_orm()
        response = self.client.delete(f"/api/padron/docente/{docente.docente_id}/", format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual("Inactivo", response.data["estado_nombre"])
        self.assertTrue(Docente.objects.filter(pk=docente.pk).exists())

    def test_docente_categoria_post_con_cargo(self):
        docente = self.crear_docente_orm()
        categoria = self.crear_categoria_orm()
        response = self.client.post("/api/padron/docente-categoria/", {
            "docente_id": docente.pk, "categoria_id": categoria.pk, "cargo_id": self.cargo().pk,
        }, format="json")
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual("Director técnico o formador", response.data["cargo"]["nombre"])

    def test_docente_categoria_post_sin_cargo(self):
        response = self.client.post("/api/padron/docente-categoria/", {
            "docente_id": self.crear_docente_orm().pk, "categoria_id": self.crear_categoria_orm().pk,
        }, format="json")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("cargo_id", response.data)

    def test_docente_patch_sin_asignaciones_conserva_las_existentes(self):
        docente = self.crear_docente_orm()
        response = self.client.patch(f"/api/padron/docente/{docente.pk}/", {"estado": docente.estado_id}, format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code, response.data)
        self.assertEqual(1, len(response.data["asignaciones"]))

    def test_docente_patch_sin_cargos_exige_asignarlos(self):
        docente = self.crear_docente_orm(con_asignacion=False)
        response = self.client.patch(f"/api/padron/docente/{docente.pk}/", {"estado": docente.estado_id}, format="json")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("asignaciones", response.data)

    def test_docente_con_asignacion_sin_cargo_no_cuenta(self):
        docente = self.crear_docente_orm(con_asignacion=False)
        DocenteCategoria.objects.create(docente=docente, categoria=self.crear_categoria_orm(), cargo=None)
        response = self.client.patch(f"/api/padron/docente/{docente.pk}/", {"estado": docente.estado_id}, format="json")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("asignaciones", response.data)

    def test_docente_categoria_no_se_puede_borrar_la_ultima(self):
        docente = self.crear_docente_orm()
        asignacion = docente.categorias_docente.get()
        response = self.client.delete(f"/api/padron/docente-categoria/{asignacion.pk}/")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertTrue(DocenteCategoria.objects.filter(pk=asignacion.pk).exists())

    def test_docente_categoria_se_puede_borrar_si_quedan_otras(self):
        docente = self.crear_docente_orm()
        otra = DocenteCategoria.objects.create(docente=docente, categoria=self.crear_categoria_orm(), cargo=self.cargo())
        response = self.client.delete(f"/api/padron/docente-categoria/{otra.pk}/")
        self.assertEqual(status.HTTP_204_NO_CONTENT, response.status_code)

    def test_categoria_no_se_puede_borrar_si_es_la_unica_de_un_docente(self):
        docente = self.crear_docente_orm()
        categoria = docente.categorias_docente.get().categoria
        response = self.client.delete(f"/api/padron/categoria/{categoria.pk}/")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertTrue(Categoria.objects.filter(pk=categoria.pk).exists())

    def test_categoria_se_puede_borrar_si_el_docente_tiene_otras(self):
        docente = self.crear_docente_orm()
        categoria = self.crear_categoria_orm()
        DocenteCategoria.objects.create(docente=docente, categoria=categoria, cargo=self.cargo("Ayudante técnico"))
        response = self.client.delete(f"/api/padron/categoria/{categoria.pk}/")
        self.assertEqual(status.HTTP_204_NO_CONTENT, response.status_code)
        self.assertTrue(docente.has_assignments())

    def test_docente_inactivo_puede_quedar_sin_cargos(self):
        docente = self.crear_docente_orm()
        docente.deactivate()
        response = self.client.patch(f"/api/padron/docente/{docente.pk}/", {"asignaciones": []}, format="json")
        self.assertEqual(status.HTTP_200_OK, response.status_code, response.data)
        self.assertEqual([], response.data["asignaciones"])
        self.assertFalse(docente.categorias_docente.exists())

    def test_docente_activo_no_puede_quedar_sin_cargos(self):
        docente = self.crear_docente_orm()
        response = self.client.patch(f"/api/padron/docente/{docente.pk}/", {"asignaciones": []}, format="json")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("asignaciones", response.data)

    def test_docente_categoria_inactivo_se_puede_borrar_la_ultima(self):
        docente = self.crear_docente_orm()
        docente.deactivate()
        asignacion = docente.categorias_docente.get()
        response = self.client.delete(f"/api/padron/docente-categoria/{asignacion.pk}/")
        self.assertEqual(status.HTTP_204_NO_CONTENT, response.status_code)
        self.assertFalse(docente.categorias_docente.exists())

    def test_categoria_se_puede_borrar_si_es_la_unica_de_un_docente_inactivo(self):
        docente = self.crear_docente_orm()
        docente.deactivate()
        categoria = docente.categorias_docente.get().categoria
        response = self.client.delete(f"/api/padron/categoria/{categoria.pk}/")
        self.assertEqual(status.HTTP_204_NO_CONTENT, response.status_code)
        self.assertFalse(docente.categorias_docente.exists())

    def test_docente_no_se_puede_reactivar_sin_cargos(self):
        docente = self.crear_docente_orm(con_asignacion=False)
        docente.deactivate()
        activo = EstadoAdministrativo.objects.get(nombre="Activo")
        response = self.client.patch(f"/api/padron/docente/{docente.pk}/", {"estado": activo.pk}, format="json")
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
        self.assertIn("dar de alta", str(response.data["asignaciones"]))

    def test_docente_delete_no_existe(self):
        response = self.client.delete("/api/padron/docente/9999/", format="json")
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_vinculo_familiar_guarda_domicilio_contacto(self):
        barrio = Barrio.objects.create(nombre="Tolosa", localidad=self.localidad)
        socio = self.crear_socio_menor_orm()
        categoria = self.crear_categoria_orm()
        response = self.create_jugador(
            socio.socio_id,
            categoria.pk,
            vinculos_familiares=[{
                "persona": {
                    "dni": "20444555",
                    "nombre": "Ana",
                    "apellido": "Perez",
                    "telefono": "221555",
                    "domicilio_calle": "Calle 50",
                    "domicilio_numero": "1240",
                    "domicilio_piso": "3",
                    "domicilio_departamento": "B",
                    "domicilio_entre_calle_1": "19",
                    "domicilio_entre_calle_2": "20",
                    "domicilio_localidad": self.localidad.pk,
                    "domicilio_barrio": barrio.pk,
                },
                "relacion": "Madre",
                "responsable_legal": True,
            }],
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        contacto = response.data["vinculos_familiares"][0]["persona"]
        self.assertEqual("Calle 50", contacto["domicilio_calle"])
        self.assertEqual("1240", contacto["domicilio_numero"])
        self.assertEqual("3", contacto["domicilio_piso"])
        self.assertEqual("B", contacto["domicilio_departamento"])
        self.assertEqual(self.localidad.pk, contacto["domicilio_localidad"])
        self.assertEqual(barrio.pk, contacto["domicilio_barrio"])

    def test_vinculo_familiar_domicilio_incompleto_falla(self):
        socio = self.crear_socio_menor_orm()
        categoria = self.crear_categoria_orm()
        response = self.create_jugador(
            socio.socio_id,
            categoria.pk,
            vinculos_familiares=[{
                "persona": {
                    "dni": "20444555",
                    "nombre": "Ana",
                    "apellido": "Perez",
                    "telefono": "221555",
                    "domicilio_calle": "Calle 50",
                },
                "relacion": "Madre",
                "responsable_legal": True,
            }],
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_docente_post_y_patch_con_vinculos_familiares(self):
        persona = self.crear_persona_orm()
        response = self.create_docente(
            persona.persona_id,
            vinculos_familiares=[{
                "persona": {
                    "dni": "25666777",
                    "nombre": "Laura",
                    "apellido": "Gomez",
                    "telefono": "2214445566",
                    "domicilio_calle": "Calle 12",
                    "domicilio_numero": "850",
                    "domicilio_localidad": self.localidad.pk,
                },
                "relacion": "Pareja",
            }],
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code, response.data)
        self.assertEqual(1, len(response.data["vinculos_familiares"]))
        self.assertEqual("Pareja", response.data["vinculos_familiares"][0]["relacion"])
        self.assertEqual("Calle 12", response.data["vinculos_familiares"][0]["persona"]["domicilio_calle"])
        self.assertFalse(response.data["vinculos_familiares"][0]["responsable_legal"])

        docente_id = response.data["docente_id"]
        patch_response = self.client.patch(
            f"/api/padron/docente/{docente_id}/",
            {"vinculos_familiares": []},
            format="json",
        )
        self.assertEqual(status.HTTP_200_OK, patch_response.status_code, patch_response.data)
        self.assertEqual([], patch_response.data["vinculos_familiares"])
        self.assertFalse(VinculoFamiliar.objects.filter(docente_id=docente_id).exists())

    def test_jugador_y_docente_no_pueden_ser_su_propio_contacto(self):
        socio = self.crear_socio_menor_orm()
        categoria = self.crear_categoria_orm()
        jugador_resp = self.create_jugador(
            socio.socio_id,
            categoria.pk,
            vinculos_familiares=[self.contacto_payload(dni=socio.persona.dni)],
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, jugador_resp.status_code)
        self.assertIn("vinculos_familiares", jugador_resp.data)

        persona_docente = self.crear_persona_orm(dni="35666777")
        docente_resp = self.create_docente(
            persona_docente.persona_id,
            asignaciones=[{"cargo": self.cargo().pk, "categorias": [categoria.pk]}],
            vinculos_familiares=[self.contacto_payload(dni=persona_docente.dni, responsable_legal=False)],
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, docente_resp.status_code)
        self.assertIn("vinculos_familiares", docente_resp.data)


class RecategorizationServiceTests(TestCase):
    CURRENT_YEAR = 2026

    def setUp(self):
        self.male, _ = Genero.objects.get_or_create(nombre="Masculino")
        self.female, _ = Genero.objects.get_or_create(nombre="Femenino")
        self.other, _ = Genero.objects.get_or_create(nombre="Otro")
        # Replace the seeded categories with a small, known ladder
        Categoria.objects.all().delete()
        self.categories = {
            name: Categoria.objects.create(nombre=name, edad_maxima=max_age, genero="M", anio_vigente=self.CURRENT_YEAR)
            for name, max_age in [
                ("2016", 10), ("2015", 11), ("PRE 9NA", 12), ("9NA", 13),
                ("4TA", 19), ("3RA", 26), ("1RA", 99),
            ]
        }
        self.unassigned = Categoria.objects.create(nombre="No asignado")
        ActualizacionCategoriasEjecucion.objects.create(ejecutado_por="Admin")
        self.dni_counter = 40000000

    def create_player(self, birth_year, category, secondary=None, gender=None, birth_date=True):
        self.dni_counter += 1
        person = Persona.objects.create(
            nombre="Jugador",
            apellido=str(self.dni_counter),
            dni=str(self.dni_counter),
            fecha_nacimiento=date(birth_year, 6, 1) if birth_date else None,
            genero=gender or self.male,
        )
        member = Socio.objects.create(persona=person)
        return Jugador.objects.create(socio=member, categoria=category, categoria_secundaria=secondary)

    def classify(self, player, last_run_year=None):
        return classify_player(player, build_category_ladders(), self.CURRENT_YEAR, last_run_year)

    def test_same_year_run_keeps_player_in_matching_category(self):
        result = self.classify(self.create_player(2015, self.categories["2015"]), last_run_year=2026)

        self.assertEqual(RecategorizacionResultado.TipoChoices.EXITO, result.tipo)
        self.assertEqual(self.categories["2015"], result.categoria_nueva)

    def test_first_run_only_validates_current_assignment(self):
        result = self.classify(self.create_player(2015, self.categories["2016"]))

        self.assertEqual(RecategorizacionResultado.TipoChoices.PENDIENTE, result.tipo)
        self.assertEqual(RecategorizacionResultado.MotivoChoices.CATEGORIA_MENOR, result.motivo)
        self.assertEqual(self.categories["2015"], result.categoria_sugerida)

    def test_new_year_run_moves_player_to_next_category(self):
        result = self.classify(self.create_player(2015, self.categories["2016"]), last_run_year=2025)

        self.assertEqual(RecategorizacionResultado.TipoChoices.EXITO, result.tipo)
        self.assertEqual(self.categories["2015"], result.categoria_nueva)

    def test_new_year_run_keeps_player_in_multi_year_category(self):
        result = self.classify(self.create_player(2008, self.categories["4TA"]), last_run_year=2025)

        self.assertEqual(RecategorizacionResultado.TipoChoices.EXITO, result.tipo)
        self.assertEqual(self.categories["4TA"], result.categoria_nueva)

    def test_new_year_run_flags_player_already_in_expected_or_higher_category(self):
        for category in (self.categories["2015"], self.categories["PRE 9NA"]):
            with self.subTest(category=category.nombre):
                result = self.classify(self.create_player(2015, category), last_run_year=2025)

                self.assertEqual(RecategorizacionResultado.TipoChoices.PENDIENTE, result.tipo)
                self.assertEqual(RecategorizacionResultado.MotivoChoices.CATEGORIA_IGUAL_O_MAYOR, result.motivo)
                self.assertEqual(self.categories["2015"], result.categoria_sugerida)

    def test_new_year_run_flags_player_more_than_one_category_behind(self):
        result = self.classify(self.create_player(2014, self.categories["2016"]), last_run_year=2025)

        self.assertEqual(RecategorizacionResultado.MotivoChoices.CATEGORIA_MENOR, result.motivo)
        self.assertEqual(self.categories["PRE 9NA"], result.categoria_sugerida)

    def test_same_year_run_flags_player_in_higher_category(self):
        result = self.classify(self.create_player(2015, self.categories["9NA"]), last_run_year=2026)

        self.assertEqual(RecategorizacionResultado.TipoChoices.PENDIENTE, result.tipo)
        self.assertEqual(RecategorizacionResultado.MotivoChoices.CATEGORIA_MAYOR, result.motivo)
        self.assertEqual(self.categories["2015"], result.categoria_sugerida)

    def test_secondary_category_matching_birth_year_is_suggested_as_main(self):
        player = self.create_player(2015, self.categories["9NA"], secondary=self.categories["2015"])

        result = self.classify(player, last_run_year=2026)

        self.assertEqual(RecategorizacionResultado.MotivoChoices.SECUNDARIA_CORRESPONDE, result.motivo)
        self.assertEqual(self.categories["2015"], result.categoria_sugerida)
        self.assertTrue(result.quitar_secundaria_sugerido)

    def test_player_with_secondary_category_requires_review(self):
        player = self.create_player(2015, self.categories["2016"], secondary=self.categories["9NA"])

        result = self.classify(player, last_run_year=2025)

        self.assertEqual(RecategorizacionResultado.TipoChoices.PENDIENTE, result.tipo)
        self.assertEqual(RecategorizacionResultado.MotivoChoices.TIENE_SECUNDARIA, result.motivo)
        self.assertEqual(self.categories["2015"], result.categoria_sugerida)
        self.assertFalse(result.quitar_secundaria_sugerido)

    def test_secondary_category_too_young_is_suggested_for_removal(self):
        player = self.create_player(2014, self.categories["9NA"], secondary=self.categories["2016"])

        result = self.classify(player, last_run_year=2026)

        self.assertEqual(RecategorizacionResultado.MotivoChoices.CATEGORIA_MAYOR, result.motivo)
        self.assertTrue(result.quitar_secundaria_sugerido)
        self.assertIn("2016", result.detalle)

    def test_adult_player_is_never_promoted_automatically(self):
        adult = self.classify(self.create_player(1995, self.categories["1RA"]), last_run_year=2025)
        turning_twenty = self.classify(self.create_player(2006, self.categories["4TA"]), last_run_year=2025)

        self.assertEqual(RecategorizacionResultado.TipoChoices.EXITO, adult.tipo)
        self.assertEqual(self.categories["1RA"], adult.categoria_nueva)
        self.assertEqual(RecategorizacionResultado.TipoChoices.PENDIENTE, turning_twenty.tipo)
        self.assertEqual(self.categories["3RA"], turning_twenty.categoria_sugerida)

    def test_players_without_required_data_are_reported_as_errors(self):
        cases = [
            (self.create_player(2015, self.categories["2015"], birth_date=False), "sin_fecha_nacimiento"),
            (self.create_player(2015, self.categories["2015"], gender=self.other), "sin_genero"),
            (self.create_player(2015, self.categories["2015"], gender=self.female), "sin_categoria_disponible"),
            (self.create_player(2015, self.unassigned), "categoria_incompatible"),
        ]
        for player, reason in cases:
            with self.subTest(reason=reason):
                result = self.classify(player, last_run_year=2026)

                self.assertEqual(RecategorizacionResultado.TipoChoices.ERROR, result.tipo)
                self.assertEqual(reason, result.motivo)
                self.assertIsNone(result.categoria_sugerida)

    def test_run_applies_successes_and_stores_every_result(self):
        RecategorizacionEjecucion.objects.create(
            anio=2025, ejecutado_por="Admin", estado=RecategorizacionEjecucion.EstadoChoices.FINALIZADA
        )
        promoted = self.create_player(2015, self.categories["2016"])
        pending = self.create_player(2015, self.categories["9NA"])
        partial_leave = self.create_player(2014, self.categories["2015"])
        partial_leave.deactivate()
        complete_leave = self.create_player(2014, self.categories["2015"])
        complete_leave.socio.deactivate()
        execution = RecategorizacionEjecucion.objects.create(anio=self.CURRENT_YEAR, ejecutado_por="Admin")

        run_recategorization(execution.pk)

        execution.refresh_from_db()
        promoted.refresh_from_db()
        pending.refresh_from_db()
        partial_leave.refresh_from_db()
        self.assertEqual(self.categories["2015"], promoted.categoria)
        self.assertEqual(self.categories["9NA"], pending.categoria)
        self.assertEqual(self.categories["PRE 9NA"], partial_leave.categoria)
        self.assertEqual((2, 1, 0), (execution.exitosos, execution.pendientes, execution.errores))
        self.assertEqual(RecategorizacionEjecucion.EstadoChoices.REVISION_PENDIENTE, execution.estado)
        self.assertFalse(execution.resultados.filter(jugador=complete_leave).exists())
        self.assertEqual(self.categories["2016"], execution.resultados.get(jugador=promoted).categoria_anterior)
        self.assertIn("Última ejecución previa: 2025", execution.registro)
        self.assertIn("2 exitosos | 1 pendientes | 0 errores", execution.registro)

    def test_run_without_pending_reviews_is_finished(self):
        self.create_player(2015, self.categories["2015"])
        execution = RecategorizacionEjecucion.objects.create(anio=self.CURRENT_YEAR, ejecutado_por="Admin")

        run_recategorization(execution.pk)

        execution.refresh_from_db()
        self.assertEqual(RecategorizacionEjecucion.EstadoChoices.FINALIZADA, execution.estado)
        self.assertIsNotNone(execution.fecha_fin)

    def test_failed_run_is_marked_and_rolled_back(self):
        player = self.create_player(2015, self.categories["2016"])
        RecategorizacionEjecucion.objects.create(
            anio=2025, ejecutado_por="Admin", estado=RecategorizacionEjecucion.EstadoChoices.FINALIZADA
        )
        execution = RecategorizacionEjecucion.objects.create(anio=self.CURRENT_YEAR, ejecutado_por="Admin")

        with patch("padron.services.RecategorizacionResultado.objects.bulk_create", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                run_recategorization(execution.pk)

        execution.refresh_from_db()
        player.refresh_from_db()
        self.assertEqual(RecategorizacionEjecucion.EstadoChoices.FALLIDA, execution.estado)
        self.assertIn("boom", execution.registro)
        self.assertEqual(self.categories["2016"], player.categoria)

    def test_start_enqueues_run_and_blocks_while_another_is_active(self):
        user = get_user_model().objects.create_user(username="admin", password="Clave-segura-123")

        with patch("django_q.tasks.async_task") as enqueue, self.captureOnCommitCallbacks(execute=True):
            execution = start_recategorization(user, "Administrador")

        enqueue.assert_called_once_with("padron.services.run_recategorization", execution.pk)
        self.assertEqual(user, execution.usuario)
        with self.assertRaises(RecategorizationInProgress):
            start_recategorization(user, "Administrador")

    def test_start_requires_the_category_update_to_run_this_year(self):
        ActualizacionCategoriasEjecucion.objects.update(anio=get_anio_actual() - 1)

        with patch("django_q.tasks.async_task") as enqueue, self.assertRaises(CategoriesOutdated):
            start_recategorization(None, "Administrador")

        enqueue.assert_not_called()
        self.assertFalse(RecategorizacionEjecucion.objects.exists())

    def test_start_discards_stale_runs(self):
        stale = RecategorizacionEjecucion.objects.create(
            ejecutado_por="Admin", fecha_inicio=timezone.now() - timedelta(hours=1)
        )

        with patch("django_q.tasks.async_task"):
            start_recategorization(None, "Administrador")

        stale.refresh_from_db()
        self.assertEqual(RecategorizacionEjecucion.EstadoChoices.FALLIDA, stale.estado)

    def test_category_year_rollover_no_longer_moves_players(self):
        Categoria.objects.update(anio_vigente=2000)
        player = self.create_player(2010, self.categories["2016"])

        pasr_de_anio_vigente_a_categoria()

        player.refresh_from_db()
        self.assertEqual(self.categories["2016"].pk, player.categoria_id)