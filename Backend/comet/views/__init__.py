from .competitions import competiciones_view
from .matches import partidos_view, resultados_view
from .players import (
    estado_jugador_view,
    exportar_jugador_view,
    jugadores_view,
    log_operaciones_view,
)
from .registrations import inscripciones_view
from .standings import tablas_view
from .status import status_view
from .teams import equipos_view

__all__ = [
    # Jugadores
    "jugadores_view",
    "exportar_jugador_view",
    "estado_jugador_view",
    "log_operaciones_view",
    # Otros READ
    "inscripciones_view",
    "competiciones_view",
    "equipos_view",
    "partidos_view",
    "resultados_view",
    "tablas_view",
    # Estado
    "status_view",
]