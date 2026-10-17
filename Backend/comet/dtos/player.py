from dataclasses import asdict, dataclass
from typing import Optional


@dataclass
class CometPlayerDTO:
    """
    Representación de un jugador en el formato que espera COMET.

    IMPORTANTE: los nombres de los campos son tentativos. Cuando llegue
    la especificación real, ajustar SOLO este archivo y `transformer.py`.
    El resto del sistema no debería necesitar cambios.
    """

    # --- Identificación ---
    documento: str
    tipo_documento: str = "DNI"

    # --- Datos personales ---
    nombres: str = ""
    apellidos: str = ""
    fecha_nacimiento: str = ""
    genero: str = ""

    # --- Club ---
    numero_socio: Optional[int] = None
    categoria: str = ""
    numero_camiseta: Optional[int] = None

    # --- Documentación ---
    apto_fisico_vigente: bool = False
    apto_fisico_vencimiento: Optional[str] = None

    def to_payload(self) -> dict:
        """Diccionario listo para serializar como JSON."""
        return {k: v for k, v in asdict(self).items() if v not in (None, "")}

    @classmethod
    def from_payload(cls, data: dict) -> "CometPlayerDTO":
        """Parsea una respuesta de COMET al DTO."""
        fields = cls.__dataclass_fields__
        return cls(**{k: v for k, v in data.items() if k in fields})