import logging
import uuid

from .base import BaseCometClient

logger = logging.getLogger(__name__)


class MockCometClient(BaseCometClient):
    """
    Cliente falso. No pega a COMET. Devuelve estructuras realistas
    para permitir desarrollo end-to-end del frontend y los services.
    """

    def __init__(self, config=None):
        super().__init__(config)
        logger.warning(
            "CometClient en modo MOCK: las llamadas NO salen a COMET. "
            "No usar en producción."
        )

    def _id(self, prefix: str) -> str:
        return f"{prefix}-{uuid.uuid4().hex[:8]}"

    # --- READ ---

    def listar_jugadores(self, filtros=None):
        logger.info("COMET[mock] listar_jugadores(%s)", filtros)
        return [
            {
                "id": self._id("mock"),
                "documento": "20000000",
                "nombres": "Falopa",
                "apellidos": "Papaap",
                "modo": "mock",
            },
        ]

    def listar_inscripciones(self, filtros=None):
        logger.info("COMET[mock] listar_inscripciones(%s)", filtros)
        return [
            {
                "id": self._id("mock"),
                "jugador_id": self._id("mock"),
                "competicion_id": self._id("mock"),
                "estado": "en_proceso",
                "modo": "mock",
            },
        ]

    def listar_competiciones(self, filtros=None):
        logger.info("COMET[mock] listar_competiciones(%s)", filtros)
        return [
            {
                "id": self._id("mock"),
                "nombre": "Liga Amateur 2026",
                "temporada": "2026",
                "modo": "mock",
            },
        ]

    def listar_equipos(self, filtros=None):
        logger.info("COMET[mock] listar_equipos(%s)", filtros)
        return [
            {
                "id": self._id("mock"),
                "nombre": "SGCUB Primera",
                "categoria": "Primera",
                "modo": "mock",
            },
        ]

    def listar_partidos(self, filtros=None):
        logger.info("COMET[mock] listar_partidos(%s)", filtros)
        return [
            {
                "id": self._id("mock"),
                "local": "SGCUB Primera",
                "visitante": "Rival FC",
                "fecha": "2026-11-15",
                "estado": "programado",
                "modo": "mock",
            },
        ]

    def listar_resultados(self, filtros=None):
        logger.info("COMET[mock] listar_resultados(%s)", filtros)
        return [
            {
                "partido_id": self._id("mock"),
                "goles_local": 2,
                "goles_visitante": 1,
                "modo": "mock",
            },
        ]

    def listar_tablas(self, filtros=None):
        logger.info("COMET[mock] listar_tablas(%s)", filtros)
        return [
            {
                "equipo": "SGCUB Primera",
                "pj": 5,
                "pg": 4,
                "pe": 1,
                "pp": 0,
                "gf": 12,
                "gc": 3,
                "puntos": 13,
                "modo": "mock",
            },
        ]

    # --- WRITE ---

    def exportar_jugador(self, payload):
        logger.info("COMET[mock] exportar_jugador(%s)", payload.get("documento"))
        return {
            "id": self._id("mock"),
            "documento": payload.get("documento"),
            "estado": "creado",
            "modo": "mock",
        }

    def inscribir_jugador(self, payload):
        logger.info("COMET[mock] inscribir_jugador(%s)", payload)
        return {
            "id": self._id("mock"),
            "estado": "inscripto",
            "modo": "mock",
            **payload,
        }

    def actualizar_inscripcion(self, inscripcion_id, payload):
        logger.info("COMET[mock] actualizar_inscripcion(%s, %s)", inscripcion_id, payload)
        return {
            "id": inscripcion_id,
            "estado": "actualizado",
            "modo": "mock",
            **payload,
        }

    def finalizar_inscripcion(self, inscripcion_id):
        logger.info("COMET[mock] finalizar_inscripcion(%s)", inscripcion_id)
        return {
            "id": inscripcion_id,
            "estado": "finalizado",
            "modo": "mock",
        }

    def gestionar_roster(self, equipo_id, payload):
        logger.info("COMET[mock] gestionar_roster(%s, %s)", equipo_id, payload)
        return {
            "equipo_id": equipo_id,
            "estado": "roster_actualizado",
            "modo": "mock",
            **payload,
        }

    def solicitar_participacion(self, payload):
        logger.info("COMET[mock] solicitar_participacion(%s)", payload)
        return {
            "id": self._id("mock"),
            "estado": "solicitada",
            "modo": "mock",
            **payload,
        }

    def cargar_alineacion(self, partido_id, payload):
        logger.info("COMET[mock] cargar_alineacion(%s, %s)", partido_id, payload)
        return {
            "partido_id": partido_id,
            "estado": "alineacion_cargada",
            "modo": "mock",
            **payload,
        }