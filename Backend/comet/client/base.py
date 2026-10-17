import logging

import requests
from requests import RequestException

from ..config import CometConfig
from ..exceptions import CometAuthError, CometError, CometValidationError

logger = logging.getLogger(__name__)


class BaseCometClient:
    """
    Define la interfaz pública del cliente COMET.
    RealCometClient la implementa pegándole a la API.
    MockCometClient la implementa con datos fake.
    """

    def __init__(self, config: CometConfig | None = None):
        self.config = config or CometConfig.from_settings()

    # --- HTTP helpers (los usa RealCometClient) ---

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _request(self, method: str, path: str, **kwargs) -> dict:
        url = f"{self.config.base_url}/{path.lstrip('/')}"
        logger.info("COMET[%s] %s %s", self.config.mode, method, url)
        try:
            response = requests.request(
                method, url, headers=self._headers(),
                timeout=self.config.timeout, **kwargs,
            )
        except RequestException as exc:
            raise CometError(f"Error de red al contactar COMET: {exc}") from exc

        if response.status_code == 401:
            raise CometAuthError("Credenciales de COMET inválidas.")
        if response.status_code in (400, 422):
            raise CometValidationError(response.text)
        if not response.ok:
            raise CometError(f"COMET respondió {response.status_code}: {response.text}")

        return response.json() if response.content else {}

    # --- Interfaz pública: READ ---

    def listar_jugadores(self, filtros: dict | None = None) -> list[dict]:
        raise NotImplementedError

    def listar_inscripciones(self, filtros: dict | None = None) -> list[dict]:
        raise NotImplementedError

    def listar_competiciones(self, filtros: dict | None = None) -> list[dict]:
        raise NotImplementedError

    def listar_equipos(self, filtros: dict | None = None) -> list[dict]:
        raise NotImplementedError

    def listar_partidos(self, filtros: dict | None = None) -> list[dict]:
        raise NotImplementedError

    def listar_resultados(self, filtros: dict | None = None) -> list[dict]:
        raise NotImplementedError

    def listar_tablas(self, filtros: dict | None = None) -> list[dict]:
        raise NotImplementedError

    # --- Interfaz pública: WRITE ---

    def exportar_jugador(self, payload: dict) -> dict:
        raise NotImplementedError

    def inscribir_jugador(self, payload: dict) -> dict:
        raise NotImplementedError

    def actualizar_inscripcion(self, inscripcion_id: str, payload: dict) -> dict:
        raise NotImplementedError

    def finalizar_inscripcion(self, inscripcion_id: str) -> dict:
        raise NotImplementedError

    def gestionar_roster(self, equipo_id: str, payload: dict) -> dict:
        raise NotImplementedError

    def solicitar_participacion(self, payload: dict) -> dict:
        raise NotImplementedError

    def cargar_alineacion(self, partido_id: str, payload: dict) -> dict:
        raise NotImplementedError