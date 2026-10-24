from django.urls import path

from .views import automatizacion_detail, automatizacion_list

urlpatterns = [
    path("", automatizacion_list, name="automatizacion-list"),
    path("<int:pk>/", automatizacion_detail, name="automatizacion-detail"),
]
