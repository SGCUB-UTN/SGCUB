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
        "id_documento", "persona_id", "tipo_documento_id", "fecha_vencimiento"
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
