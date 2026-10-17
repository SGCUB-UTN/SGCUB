from django.urls import path

from .views import (
    competiciones_view,
    equipos_view,
    estado_jugador_view,
    exportar_jugador_view,
    inscripciones_view,
    jugadores_view,
    log_operaciones_view,
    partidos_view,
    resultados_view,
    status_view,
    tablas_view,
)

urlpatterns = [
    # --- Estado ---
    path("status/", status_view, name="comet-status"),

    # --- Jugadores ---
    path("jugadores/", jugadores_view, name="comet-jugadores"),
    path("jugador/<int:pk>/exportar/", exportar_jugador_view, name="comet-exportar-jugador"),
    path("jugador/<int:pk>/estado/", estado_jugador_view, name="comet-estado-jugador"),

    # --- Inscripciones ---
    path("inscripciones/", inscripciones_view, name="comet-inscripciones"),

    # --- Competiciones ---
    path("competiciones/", competiciones_view, name="comet-competiciones"),

    # --- Equipos ---
    path("equipos/", equipos_view, name="comet-equipos"),

    # --- Partidos / Resultados ---
    path("partidos/", partidos_view, name="comet-partidos"),
    path("resultados/", resultados_view, name="comet-resultados"),

    # --- Tablas ---
    path("tablas/", tablas_view, name="comet-tablas"),

    # --- Logs ---
    path("logs/", log_operaciones_view, name="comet-logs"),
]