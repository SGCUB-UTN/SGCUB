from django.urls import path
from . import views

urlpatterns = [
    path('documentos/', views.documento_list_create, name='documento_list_create'),
    path('documentos/<int:pk>/', views.documento_detail, name='documento_detail'),
    path('tipos/', views.tipo_documento_list, name='tipo_documento_list'),
    path('tipos/<int:pk>/', views.tipo_documento_detail, name='tipo_documento_detail'),
    path('estados/', views.estado_documento_list, name='estado_documento_list'),
    path('alertas/', views.alertas_count, name='alertas_count'),
    path('zip/<int:persona_id>/', views.download_zip, name='download_zip'),
]
