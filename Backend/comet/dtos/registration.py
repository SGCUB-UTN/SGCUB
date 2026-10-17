from dataclasses import dataclass


@dataclass
class CometRegistrationDTO:
    """Inscripción de un jugador a una competición."""

    id: str = ""
    jugador_id: str = ""
    competicion_id: str = ""
    estado: str = ""  # TODO spec: catálogo de estados ("en_proceso", "finalizada", etc.)
    fecha_inscripcion: str = ""
    # TODO spec: agregar los campos reales que devuelva COMET

    @classmethod
    def from_payload(cls, data: dict) -> "CometRegistrationDTO":
        fields = cls.__dataclass_fields__
        return cls(**{k: v for k, v in data.items() if k in fields})

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v not in (None, "")}