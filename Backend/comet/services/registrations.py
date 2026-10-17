from ..client import get_comet_client


def listar_inscripciones_comet(filtros: dict | None = None) -> list[dict]:
    """Proxy de lectura al listado de inscripciones de COMET."""
    return get_comet_client().listar_inscripciones(filtros)