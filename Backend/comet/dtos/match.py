from dataclasses import dataclass


@dataclass
class CometMatchDTO:
    """Partido programado o jugado."""

    id: str = ""
    local: str = ""
    visitante: str = ""
    fecha: str = ""
    hora: str = ""
    cancha: str = ""
    estado: str = ""  # TODO spec: "programado", "en_juego", "finalizado", etc.
    # TODO spec: agregar los campos reales

    @classmethod
    def from_payload(cls, data: dict) -> "CometMatchDTO":
        fields = cls.__dataclass_fields__
        return cls(**{k: v for k, v in data.items() if k in fields})

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v not in (None, "")}