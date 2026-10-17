from ..client import get_comet_client


def listar_tablas_comet(filtros: dict | None = None) -> list[dict]:
    """Proxy de lectura a las tablas de posiciones de COMET."""
    return get_comet_client().listar_tablas(filtros)