from django.urls import path

from .views import (
    automatizacion_detail,
    automatizacion_execution_list,
    automatizacion_list,
    category_update_run,
    category_update_status,
    recategorization_accept_all,
    recategorization_decision,
    recategorization_log,
    recategorization_results,
    recategorization_run,
    recategorization_status,
)

urlpatterns = [
    path("", automatizacion_list, name="automatizacion-list"),
    path("ejecuciones/", automatizacion_execution_list, name="automatizacion-ejecuciones"),
    path("<int:pk>/", automatizacion_detail, name="automatizacion-detail"),
    path("categorias/", category_update_status, name="categorias-estado"),
    path("categorias/ejecutar/", category_update_run, name="categorias-ejecutar"),
    path("recategorizacion/", recategorization_status, name="recategorizacion-estado"),
    path("recategorizacion/ejecutar/", recategorization_run, name="recategorizacion-ejecutar"),
    path("recategorizacion/<int:pk>/resultados/", recategorization_results, name="recategorizacion-resultados"),
    path("recategorizacion/<int:pk>/registro/", recategorization_log, name="recategorizacion-registro"),
    path(
        "recategorizacion/<int:pk>/aceptar-sugeridos/",
        recategorization_accept_all,
        name="recategorizacion-aceptar-sugeridos",
    ),
    path(
        "recategorizacion/resultados/<int:pk>/decision/",
        recategorization_decision,
        name="recategorizacion-decision",
    ),
]
