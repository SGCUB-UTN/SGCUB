from django.urls import path

from .views import (
    estado_jugador_comet_view,
    exportar_planilla_jugador_view,
    exportar_planillas_categoria_view,
)

urlpatterns = [
    # Estado del jugador (apto físico vigente, vencimiento)
    path("jugador/<int:pk>/estado/", estado_jugador_comet_view, name="comet-estado-jugador"),

    # Descarga de la planilla individual (PDF)
    path("jugador/<int:pk>/planilla/", exportar_planilla_jugador_view, name="comet-planilla-jugador"),
    path("jugador/<int:pk>/exportar/", exportar_planilla_jugador_view, name="comet-exportar-jugador"),  # Alias retrocompatible

    # Descarga de planillas consolidadas por categoría (PDF)
    path("categoria/<int:pk>/planillas/", exportar_planillas_categoria_view, name="comet-planillas-categoria"),
]
