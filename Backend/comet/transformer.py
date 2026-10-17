from .dtos import CometPlayerDTO
from .eligibility import apto_fisico_vencimiento, tiene_apto_fisico_vigente


GENERO_A_COMET = {
    "Masculino": "M",
    "Femenino": "F",
}


def _genero(persona) -> str:
    if persona.genero is None:
        return ""
    return GENERO_A_COMET.get(persona.genero.nombre, "")


def _fecha_iso(fecha) -> str:
    return fecha.isoformat() if fecha else ""


def jugador_a_comet(jugador) -> CometPlayerDTO:
    """Convierte un `padron.Jugador` al DTO que viaja a COMET."""
    persona = jugador.socio.persona
    puede, _ = tiene_apto_fisico_vigente(jugador)

    return CometPlayerDTO(
        documento=persona.dni,
        nombres=persona.nombre,
        apellidos=persona.apellido,
        fecha_nacimiento=_fecha_iso(persona.fecha_nacimiento),
        genero=_genero(persona),
        numero_socio=jugador.socio.numero_socio,
        categoria=jugador.categoria.nombre if jugador.categoria else "",
        apto_fisico_vigente=puede,
        apto_fisico_vencimiento=apto_fisico_vencimiento(jugador),
    )