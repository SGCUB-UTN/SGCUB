from dataclasses import dataclass
from typing import Optional


@dataclass
class CometResultDTO:
    """Resultado final de un partido."""

    partido_id: str = ""
    goles_local: Optional[int] = None
    goles_visitante: Optional[int] = None
    # TODO spec: agregar los campos reales

    @classmethod
    def from_payload(cls, data: dict) -> "CometResultDTO":
        fields = cls.__dataclass_fields__
        return cls(**{k: v for k, v in data.items() if k in fields})

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v not in (None, "")}