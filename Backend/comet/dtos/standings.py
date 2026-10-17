from dataclasses import dataclass
from typing import Optional


@dataclass
class CometStandingsDTO:
    """Fila de tabla de posiciones."""

    equipo: str = ""
    pj: Optional[int] = None      # partidos jugados
    pg: Optional[int] = None      # ganados
    pe: Optional[int] = None      # empatados
    pp: Optional[int] = None      # perdidos
    gf: Optional[int] = None      # goles a favor
    gc: Optional[int] = None      # goles en contra
    puntos: Optional[int] = None
    # TODO spec: agregar los campos reales

    @classmethod
    def from_payload(cls, data: dict) -> "CometStandingsDTO":
        fields = cls.__dataclass_fields__
        return cls(**{k: v for k, v in data.items() if k in fields})

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v not in (None, "")}