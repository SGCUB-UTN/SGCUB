from ..client import get_comet_client


def listar_partidos_comet(filtros: dict | None = None) -> list[dict]:
    """Proxy de lectura al listado de partidos de COMET."""
    return get_comet_client().listar_partidos(filtros)


def listar_resultados_comet(filtros: dict | None = None) -> list[dict]:
    """Proxy de lectura al listado de resultados de COMET."""
    return get_comet_client().listar_resultados(filtros)