import unicodedata
from collections import Counter

from django.utils import timezone

from configuracion.models import ConfiguracionGeneral
from padron.models import (
    ESTADO_ADMINISTRATIVO_ACTIVO,
    ESTADO_DEPORTIVO_ACTIVO,
    Docente,
    Jugador,
)

from .models import Documento, TipoDocumento, _local_date

PERFIL_JUGADOR = "jugador"
PERFIL_DOCENTE = "docente"

VIGENTE = "vigente"
POR_VENCER = "por_vencer"
VENCIDO = "vencido"
FALTANTE = "faltante"
DISQUALIFYING_STATES = {VENCIDO, FALTANTE}
DOCUMENT_STATES = (VIGENTE, POR_VENCER, VENCIDO, FALTANTE)
FILTERABLE_STATES = (VENCIDO, POR_VENCER, FALTANTE, VIGENTE)
PROFILES = (PERFIL_JUGADOR, PERFIL_DOCENTE)

NO_CATEGORY = "none"
GENDER_PREFIX = "gender:"
GENDER_LABELS = {"M": "Masc.", "F": "Fem."}


class PadronFilterError(ValueError):
    pass


def document_state(document, today, alert_days):
    if document is None:
        return FALTANTE
    if document.fecha_vencimiento is None:
        return VIGENTE
    days_left = (_local_date(document.fecha_vencimiento) - today).days
    if days_left < 0:
        return VENCIDO
    if days_left <= alert_days:
        return POR_VENCER
    return VIGENTE


def serialize_categoria(categoria):
    return {"categoria_id": categoria.categoria_id, "nombre": categoria.nombre, "genero": categoria.genero}


def active_profiles():
    jugadores = Jugador.objects.filter(estado__nombre=ESTADO_DEPORTIVO_ACTIVO).select_related("socio__persona", "categoria")
    docentes = Docente.objects.filter(estado__nombre=ESTADO_ADMINISTRATIVO_ACTIVO).select_related("persona").prefetch_related(
        "categorias_docente__categoria"
    )
    profiles = [
        {
            "perfil": PERFIL_JUGADOR,
            "perfil_id": jugador.jugador_id,
            "socio_id": jugador.socio.socio_id,
            "persona": jugador.socio.persona,
            "categorias": [serialize_categoria(jugador.categoria)],
            "url_perfil": f"/padron/jugadores/{jugador.jugador_id}",
        }
        for jugador in jugadores
    ]
    profiles += [
        {
            "perfil": PERFIL_DOCENTE,
            "perfil_id": docente.docente_id,
            "socio_id": None,
            "persona": docente.persona,
            "categorias": sorted(
                (serialize_categoria(asignacion.categoria) for asignacion in docente.categorias_docente.all()),
                key=lambda categoria: categoria["nombre"],
            ),
            "url_perfil": f"/padron/docentes/{docente.docente_id}",
        }
        for docente in docentes
    ]
    return profiles


def latest_documents(persona_ids, tipos):
    documents = Documento.objects.filter(persona_id__in=persona_ids, tipo_documento__in=tipos).only(
        "id_documento", "persona_id", "tipo_documento_id", "fecha_vencimiento", "archivoUrl"
    ).order_by("id_documento")
    return {(document.persona_id, document.tipo_documento_id): document for document in documents}


def build_padron_documental():
    today = timezone.localdate()
    alert_days = ConfiguracionGeneral.load().dias_alerta_documentos
    tipos = list(TipoDocumento.objects.filter(activo=True, obligatorio=True).order_by("nombre"))
    required_by_profile = {
        PERFIL_JUGADOR: [tipo for tipo in tipos if tipo.aplica_jugador],
        PERFIL_DOCENTE: [tipo for tipo in tipos if tipo.aplica_docente],
    }
    profiles = active_profiles()
    documents = latest_documents({profile["persona"].persona_id for profile in profiles}, tipos)

    personas = []
    for profile in profiles:
        persona = profile.pop("persona")
        documentos = []
        for tipo in required_by_profile[profile["perfil"]]:
            document = documents.get((persona.persona_id, tipo.id_tipo_documento))
            documentos.append({
                "tipo_documento": tipo.id_tipo_documento,
                "tipo_documento_nombre": tipo.nombre,
                "id_documento": document.id_documento if document else None,
                "archivo_url": document.archivoUrl.url if document and document.archivoUrl else None,
                "estado": document_state(document, today, alert_days),
                "fecha_vencimiento": _local_date(document.fecha_vencimiento) if document and document.fecha_vencimiento else None,
            })
        personas.append({
            **profile,
            "clave": f"{profile['perfil']}-{profile['perfil_id']}",
            "persona_id": persona.persona_id,
            "nombre": persona.nombre,
            "apellido": persona.apellido,
            "dni": persona.dni,
            "email": persona.email or "",
            "habilitado": not any(documento["estado"] in DISQUALIFYING_STATES for documento in documentos),
            "documentos": documentos,
        })

    personas.sort(key=lambda persona: (persona["apellido"].lower(), persona["nombre"].lower(), persona["clave"]))
    return {"dias_alerta": alert_days, "personas": personas}


def normalize_text(value):
    text = unicodedata.normalize("NFD", str(value or ""))
    return " ".join("".join(char for char in text if not unicodedata.combining(char)).lower().split())


def matches_search(query, fields):
    haystack = normalize_text(" ".join(str(field) for field in fields if field is not None))
    return all(term in haystack for term in normalize_text(query).split())


def parse_padron_filters(params):
    estado = params.get("estado") or None
    perfil = params.get("perfil") or None
    tipo = params.get("tipo") or None
    categoria = params.get("categoria") or None
    if estado and estado not in FILTERABLE_STATES:
        raise PadronFilterError(f"El estado debe ser uno de: {', '.join(FILTERABLE_STATES)}.")
    if perfil and perfil not in PROFILES:
        raise PadronFilterError(f"El perfil debe ser uno de: {', '.join(PROFILES)}.")
    if tipo and not tipo.isdigit():
        raise PadronFilterError("El tipo de documento debe ser un número.")
    if categoria and categoria != NO_CATEGORY:
        gender = categoria.removeprefix(GENDER_PREFIX) if categoria.startswith(GENDER_PREFIX) else None
        if gender is not None and gender not in GENDER_LABELS:
            raise PadronFilterError("El género de la categoría debe ser M o F.")
        if gender is None and not categoria.isdigit():
            raise PadronFilterError("La categoría debe ser un número, none o gender:M/F.")
    return {"estado": estado, "perfil": perfil, "tipo": int(tipo) if tipo else None, "categoria": categoria, "q": params.get("q", "")}


def category_matches(persona, categoria):
    categorias = persona["categorias"]
    if not categoria:
        return True
    if categoria == NO_CATEGORY:
        return not categorias
    if categoria.startswith(GENDER_PREFIX):
        return any(item["genero"] == categoria.removeprefix(GENDER_PREFIX) for item in categorias)
    return any(item["categoria_id"] == int(categoria) for item in categorias)


def filter_document_rows(personas, estado=None, perfil=None, tipo=None, categoria=None, q=""):
    return [
        (persona, documento)
        for persona in personas
        if (not perfil or persona["perfil"] == perfil)
        and category_matches(persona, categoria)
        and matches_search(q, [persona["apellido"], persona["nombre"], persona["dni"]])
        for documento in persona["documentos"]
        if (not estado or documento["estado"] == estado)
        and (not tipo or documento["tipo_documento"] == tipo)
    ]


def category_label(categoria):
    gender = GENDER_LABELS.get(categoria["genero"])
    return f"{categoria['nombre']} ({gender})" if gender else categoria["nombre"]


def most_affected_categories(personas, disabled):
    labels = {categoria["categoria_id"]: category_label(categoria) for persona in personas for categoria in persona["categorias"]}
    totals = Counter(categoria["categoria_id"] for persona in personas for categoria in persona["categorias"])
    affected = Counter(categoria["categoria_id"] for persona in disabled for categoria in persona["categorias"])
    return [
        {"categoria_id": categoria_id, "categoria": labels[categoria_id], "inhabilitados": count, "total": totals[categoria_id]}
        for categoria_id, count in sorted(affected.items(), key=lambda item: (-item[1], labels[item[0]]))
    ]


def padron_summary(personas):
    disabled = [persona for persona in personas if not persona["habilitado"]]
    document_counts = Counter(documento["estado"] for persona in personas for documento in persona["documentos"])
    return {
        "total": len(personas),
        "habilitados": len(personas) - len(disabled),
        "inhabilitados": len(disabled),
        "inhabilitados_por_perfil": {perfil: sum(persona["perfil"] == perfil for persona in disabled) for perfil in PROFILES},
        "cumplimiento": round((len(personas) - len(disabled)) * 100 / len(personas), 1) if personas else 100.0,
        "documentos": {estado: document_counts[estado] for estado in DOCUMENT_STATES},
        "categorias_afectadas": most_affected_categories(personas, disabled),
    }
