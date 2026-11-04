from django.urls import path
from . import views

urlpatterns = [
    path('documentos/', views.documento_list_create, name='documento_list_create'),
    path('documentos/<int:pk>/', views.documento_detail, name='documento_detail'),
    path('tipos/', views.tipo_documento_list, name='tipo_documento_list'),
    path('tipos/<int:pk>/', views.tipo_documento_detail, name='tipo_documento_detail'),
    path('tipos/<int:pk>/plantilla/', views.plantilla_documento_detail, name='plantilla_documento_detail'),
    path('tipos/<int:pk>/plantilla/personas/<int:persona_id>/pdf/', views.plantilla_documento_pdf, name='plantilla_documento_pdf'),
    path('tipos/<int:pk>/plantilla/personas/<int:persona_id>/imagen/', views.plantilla_documento_imagen, name='plantilla_documento_imagen'),
    path(
        'tipos/<int:pk>/plantilla/personas/<int:persona_id>/destinatario/',
        views.plantilla_documento_destinatario,
        name='plantilla_documento_destinatario',
    ),
    path('estados/', views.estado_documento_list, name='estado_documento_list'),
    path('alertas/', views.alertas_count, name='alertas_count'),
    path('padron/', views.padron_documental, name='padron_documental'),
    path('padron/reporte/', views.padron_documental_pdf, name='padron_documental_pdf'),
    path('zip/<int:persona_id>/', views.download_zip, name='download_zip'),
]
