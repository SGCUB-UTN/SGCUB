from dataclasses import dataclass


@dataclass
class CometTeamDTO:
    """Equipo registrado en COMET."""

    id: str = ""
    nombre: str = ""
    categoria: str = ""
    competicion_id: str = ""
    # TODO spec: agregar los campos reales

    @classmethod
    def from_payload(cls, data: dict) -> "CometTeamDTO":
        fields = cls.__dataclass_fields__
        return cls(**{k: v for k, v in data.items() if k in fields})

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v not in (None, "")}