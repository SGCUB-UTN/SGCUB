from dataclasses import dataclass


@dataclass
class CometCompetitionDTO:
    """Competición/torneo en COMET."""

    id: str = ""
    nombre: str = ""
    temporada: str = ""
    categoria: str = ""
    fecha_inicio: str = ""
    fecha_fin: str = ""
    estado: str = ""
    # TODO spec: agregar los campos reales

    @classmethod
    def from_payload(cls, data: dict) -> "CometCompetitionDTO":
        fields = cls.__dataclass_fields__
        return cls(**{k: v for k, v in data.items() if k in fields})

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v not in (None, "")}