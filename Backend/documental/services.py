import unicodedata
from collections import Counter

from django.utils import timezone

from configuracion.models import ConfiguracionGeneral
from configuracion.services import category_label as category_model_label
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


def applies_to(tipo, perfil):
    return tipo.aplica_jugador if perfil == PERFIL_JUGADOR else tipo.aplica_docente


def serialize_document(tipo, document, today, alert_days):
    return {
        "tipo_documento": tipo.id_tipo_documento,
        "tipo_documento_nombre": tipo.nombre,
        "obligatorio": tipo.obligatorio,
        "id_documento": document.id_documento if document else None,
        "archivo_url": document.archivoUrl.url if document and document.archivoUrl else None,
        "estado": document_state(document, today, alert_days),
        "fecha_vencimiento": _local_date(document.fecha_vencimiento) if document and document.fecha_vencimiento else None,
    }


def build_padron_documental():
    today = timezone.localdate()
    alert_days = ConfiguracionGeneral.load().dias_alerta_documentos
    tipos = list(TipoDocumento.objects.filter(activo=True).order_by("-obligatorio", "nombre"))
    profiles = active_profiles()
    documents = latest_documents({profile["persona"].persona_id for profile in profiles}, tipos)

    personas = []
    for profile in profiles:
        persona = profile.pop("persona")
        documentos = []
        for tipo in tipos:
            document = documents.get((persona.persona_id, tipo.id_tipo_documento))
            if applies_to(tipo, profile["perfil"]) and (tipo.obligatorio or document):
                documentos.append(serialize_document(tipo, document, today, alert_days))
        personas.append({
            **profile,
            "clave": f"{profile['perfil']}-{profile['perfil_id']}",
            "persona_id": persona.persona_id,
            "nombre": persona.nombre,
            "apellido": persona.apellido,
            "dni": persona.dni,
            "email": persona.email or "",
            "habilitado": not any(
                documento["obligatorio"] and documento["estado"] in DISQUALIFYING_STATES for documento in documentos
            ),
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


def most_affected_categories(personas):
    labels = {}
    counts = {}
    for persona in personas:
        states = Counter(documento["estado"] for documento in persona["documentos"])
        for categoria in persona["categorias"]:
            labels[categoria["categoria_id"]] = category_label(categoria)
            counts.setdefault(categoria["categoria_id"], Counter()).update(states)
    affected = [
        {
            "categoria_id": categoria_id,
            "categoria": labels[categoria_id],
            "vencidos": states[VENCIDO],
            "faltantes": states[FALTANTE],
            "total": sum(states.values()),
        }
        for categoria_id, states in counts.items()
        if states[VENCIDO] or states[FALTANTE]
    ]
    return sorted(affected, key=lambda item: (-(item["vencidos"] + item["faltantes"]), item["categoria"]))


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
        "categorias_afectadas": most_affected_categories(personas),
    }


MINOR_AGE = 18


class TemplateSubjectError(Exception):
    pass


def default_template_legend(document_name):
    return f"Declaro haber recibido y leído {document_name}, y presto conformidad con su contenido."


def template_subject(tipo, persona):
    jugador = getattr(getattr(persona, "socio", None), "jugador", None)
    if jugador and tipo.aplica_jugador:
        is_minor = persona.edad is not None and persona.edad < MINOR_AGE
        guardian = None
        if is_minor:
            guardian = jugador.vinculos_familiares.filter(responsable_legal=True).select_related("persona").first()
        return {
            "persona": persona,
            "perfil": PERFIL_JUGADOR,
            "categoria": category_model_label(jugador.categoria),
            "menor": is_minor,
            "responsable": guardian,
        }
    if getattr(persona, "docente", None) and tipo.aplica_docente:
        return {"persona": persona, "perfil": PERFIL_DOCENTE, "categoria": None, "menor": False, "responsable": None}
    raise TemplateSubjectError(f'El documento "{tipo.nombre}" no se pide a esta persona.')


def template_recipient(subject):
    guardian = subject["responsable"]
    contact = guardian.persona if guardian else subject["persona"]
    return {
        "nombre": f"{contact.nombre} {contact.apellido}",
        "telefono": contact.telefono,
        "es_responsable_legal": guardian is not None,
    }
