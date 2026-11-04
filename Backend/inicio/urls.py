from django.urls import path

from .views import resumen_inicio

urlpatterns = [
    path("resumen/", resumen_inicio, name="inicio-resumen"),
]
