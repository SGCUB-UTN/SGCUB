from django.urls import path

from .views import configuracion_general, guardar_configuracion, historial_configuracion

urlpatterns = [
    path("", configuracion_general, name="configuracion-general"),
    path("guardar/", guardar_configuracion, name="configuracion-guardar"),
    path("historial/", historial_configuracion, name="historial-configuracion"),
]
