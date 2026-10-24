from django.urls import path

from .views import (
    automatizacion_detail,
    automatizacion_execution_list,
    automatizacion_list,
)

urlpatterns = [
    path("", automatizacion_list, name="automatizacion-list"),
    path("ejecuciones/", automatizacion_execution_list, name="automatizacion-ejecuciones"),
    path("<int:pk>/", automatizacion_detail, name="automatizacion-detail"),
]
