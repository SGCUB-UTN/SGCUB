from .base import BaseCometClient


class RealCometClient(BaseCometClient):
    """
    Implementación HTTP real.
    TODOS los paths son placeholders: ajustar cuando llegue el spec.
    """

    # --- READ ---

    def listar_jugadores(self, filtros=None):
        # TODO spec
        return self._request("GET", "/api/players", params=filtros or {})

    def listar_inscripciones(self, filtros=None):
        # TODO spec
        return self._request("GET", "/api/registrations", params=filtros or {})

    def listar_competiciones(self, filtros=None):
        # TODO spec
        return self._request("GET", "/api/competitions", params=filtros or {})

    def listar_equipos(self, filtros=None):
        # TODO spec
        return self._request("GET", "/api/teams", params=filtros or {})

    def listar_partidos(self, filtros=None):
        # TODO spec
        return self._request("GET", "/api/matches", params=filtros or {})

    def listar_resultados(self, filtros=None):
        # TODO spec
        return self._request("GET", "/api/results", params=filtros or {})

    def listar_tablas(self, filtros=None):
        # TODO spec
        return self._request("GET", "/api/standings", params=filtros or {})

    # --- WRITE ---

    def exportar_jugador(self, payload):
        # TODO spec
        return self._request("POST", "/api/players", json=payload)

    def inscribir_jugador(self, payload):
        # TODO spec
        return self._request("POST", "/api/registrations", json=payload)

    def actualizar_inscripcion(self, inscripcion_id, payload):
        # TODO spec
        return self._request("PUT", f"/api/registrations/{inscripcion_id}", json=payload)

    def finalizar_inscripcion(self, inscripcion_id):
        # TODO spec
        return self._request("POST", f"/api/registrations/{inscripcion_id}/finish")

    def gestionar_roster(self, equipo_id, payload):
        # TODO spec
        return self._request("PUT", f"/api/teams/{equipo_id}/roster", json=payload)

    def solicitar_participacion(self, payload):
        # TODO spec
        return self._request("POST", "/api/competitions/participation", json=payload)

    def cargar_alineacion(self, partido_id, payload):
        # TODO spec
        return self._request("POST", f"/api/matches/{partido_id}/lineup", json=payload)