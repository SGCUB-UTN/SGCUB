from ..client import get_comet_client


def listar_equipos_comet(filtros: dict | None = None) -> list[dict]:
    """Proxy de lectura al listado de equipos de COMET."""
    return get_comet_client().listar_equipos(filtros)