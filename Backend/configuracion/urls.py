from django.urls import path

from .views import configuracion_general, historial_configuracion

urlpatterns = [
    path("", configuracion_general, name="configuracion-general"),
    path("historial/", historial_configuracion, name="historial-configuracion"),
]
