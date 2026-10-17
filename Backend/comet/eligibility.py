from typing import Optional

from documental.models import Documento


APTO_FISICO_TIPO = "Apto Físico"
ESTADO_VIGENTE = "Vigente"


def _apto_fisico_query(jugador):
    return Documento.objects.filter(
        persona=jugador.socio.persona,
        tipo_documento__nombre=APTO_FISICO_TIPO,
        estado_documento__nombre=ESTADO_VIGENTE,
    )


def tiene_apto_fisico_vigente(jugador) -> tuple[bool, Optional[str]]:
    #Solo se pueden exportar jugadores que tengan apto físico vigente cargado en el sistema.
    if not _apto_fisico_query(jugador).exists():
        return False, "No tiene apto físico vigente cargado."
    return True, None


def apto_fisico_vencimiento(jugador) -> Optional[str]:
    """Fecha ISO del vencimiento del apto vigente, o None si no aplica."""
    apto = (
        _apto_fisico_query(jugador)
        .order_by("-fecha_vencimiento")
        .first()
    )
    if apto is None or apto.fecha_vencimiento is None:
        return None
    return apto.fecha_vencimiento.date().isoformat()