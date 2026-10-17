from ..client import get_comet_client


def listar_competiciones_comet(filtros: dict | None = None) -> list[dict]:
    """Proxy de lectura al listado de competiciones de COMET."""
    return get_comet_client().listar_competiciones(filtros)