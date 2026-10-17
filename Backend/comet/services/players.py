import logging

from ..client import get_comet_client
from ..eligibility import tiene_apto_fisico_vigente
from ..exceptions import CometError
from ..models import CometOperationChoices, CometOperationLog
from ..transformer import jugador_a_comet

logger = logging.getLogger(__name__)


# --- READ ---

def listar_jugadores_comet(filtros: dict | None = None) -> list[dict]:
    """Proxy directo al cliente COMET. No persiste."""
    client = get_comet_client()
    return client.listar_jugadores(filtros)


# --- WRITE ---

def exportar_jugador(jugador, usuario=None) -> CometOperationLog:
    """
    Exporta un jugador a COMET y registra el resultado.
    HU-16: solo si tiene apto físico vigente.
    """
    puede, motivo = tiene_apto_fisico_vigente(jugador)
    if not puede:
        return CometOperationLog.objects.create(
            operacion=CometOperationChoices.EXPORTAR_JUGADOR,
            jugador=jugador,
            usuario=usuario,
            exitoso=False,
            mensaje=motivo,
        )

    dto = jugador_a_comet(jugador)
    payload = dto.to_payload()

    try:
        client = get_comet_client()
        respuesta = client.exportar_jugador(payload)
    except CometError as exc:
        logger.exception("Error al exportar jugador %s a COMET", jugador.pk)
        return CometOperationLog.objects.create(
            operacion=CometOperationChoices.EXPORTAR_JUGADOR,
            jugador=jugador,
            usuario=usuario,
            exitoso=False,
            mensaje=str(exc),
            payload_enviado=payload,
        )

    return CometOperationLog.objects.create(
        operacion=CometOperationChoices.EXPORTAR_JUGADOR,
        jugador=jugador,
        usuario=usuario,
        exitoso=True,
        mensaje="Exportación exitosa.",
        payload_enviado=payload,
        respuesta=respuesta,
        referencia_externa=respuesta.get("id", ""),
    )