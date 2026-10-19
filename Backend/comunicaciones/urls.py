from django.urls import path

from .views import (
    envio_notificacion_detail,
    notificacion_detail,
    notificacion_list_create,
    opciones_comunicacion,
)

urlpatterns = [
    path("opciones/", opciones_comunicacion, name="comunicaciones-opciones"),
    path("notificacion/", notificacion_list_create, name="notificacion-list-create"),
    path("notificacion/<int:pk>/", notificacion_detail, name="notificacion-detail"),
   path("envio-notificacion/<int:pk>/", envio_notificacion_detail, name="envio-notificacion-detail"),
]
