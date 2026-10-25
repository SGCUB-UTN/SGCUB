from .tasks import refresh_document_states
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from django.db.models import OuterRef, Subquery

from .models import Documento, TipoDocumento, EstadoDocumento
from .serializers import DocumentoSerializer, TipoDocumentoSerializer, EstadoDocumentoSerializer

@extend_schema(tags=["Documental / Documentos"], request=DocumentoSerializer, responses=DocumentoSerializer)
@api_view(["GET", "POST"])
def documento_list_create(request):
    refresh_document_states()
    if request.method == "GET":
        persona_id = request.query_params.get('persona_id')
        documentos = Documento.objects.select_related(
            'persona',
            'persona__socio__jugador__estado',
            'persona__socio__jugador__categoria',
            'persona__socio__estado_administrativo',
            'persona__docente__estado',
        )
        if persona_id:
            documentos = documentos.filter(persona_id=persona_id)
        else:
            documentos = documentos.all()
        serializer = DocumentoSerializer(documentos, many=True)
        return Response(serializer.data)
    elif request.method == "POST":
        serializer = DocumentoSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        print("SERIALIZER ERRORS:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(tags=["Documental / Documentos"], responses=DocumentoSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def documento_detail(request, pk):
    documento = get_object_or_404(Documento, pk=pk)
    if request.method == "GET":
        serializer = DocumentoSerializer(documento)
        return Response(serializer.data)
    elif request.method in ["PUT", "PATCH"]:
        serializer = DocumentoSerializer(documento, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == "DELETE":
        documento.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@extend_schema(tags=["Documental / Tipos"], request=TipoDocumentoSerializer, responses=TipoDocumentoSerializer)
@api_view(["GET", "POST"])
def tipo_documento_list(request):
    if request.method == "GET":
        tipos = TipoDocumento.objects.order_by('nombre')
        if request.query_params.get('activos') in ('1', 'true'):
            tipos = tipos.filter(activo=True)
        return Response(TipoDocumentoSerializer(tipos, many=True).data)

    serializer = TipoDocumentoSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(TipoDocumentoSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Documental / Tipos"], request=TipoDocumentoSerializer, responses=TipoDocumentoSerializer)
@api_view(["PATCH", "DELETE"])
def tipo_documento_detail(request, pk):
    tipo = get_object_or_404(TipoDocumento, pk=pk)
    if request.method == "DELETE":
        if tipo.documentos.exists():
            return Response(
                {"detail": "El tipo ya tiene documentos cargados: deshabilitalo en lugar de eliminarlo."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tipo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = TipoDocumentoSerializer(tipo, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(TipoDocumentoSerializer(serializer.save()).data)

@extend_schema(tags=["Documental / Estados"], request=EstadoDocumentoSerializer, responses=EstadoDocumentoSerializer)
@api_view(["GET"])
def estado_documento_list(request):
    estados = EstadoDocumento.objects.all()
    serializer = EstadoDocumentoSerializer(estados, many=True)
    return Response(serializer.data)

from django.utils import timezone
from datetime import timedelta

@extend_schema(tags=["Documental / Alertas"])
@api_view(["GET"])
def alertas_count(request):
    refresh_document_states()
    hoy = timezone.now().date()
    limite = hoy + timedelta(days=30)
    
    # Subquery to get the most recently uploaded document per persona+tipo
    latest_docs = Documento.objects.filter(
        persona=OuterRef('persona'),
        tipo_documento=OuterRef('tipo_documento')
    ).order_by('-id_documento')

    documentos = Documento.objects.filter(
        id_documento=Subquery(latest_docs.values('id_documento')[:1])
    ).exclude(fecha_vencimiento__isnull=True).select_related(
        'persona', 
        'persona__socio', 
        'persona__socio__jugador', 
        'persona__socio__jugador__estado',
        'persona__socio__estado_administrativo',
        'persona__docente',
        'persona__docente__estado'
    )
    
    vencidos = 0
    proximos = 0
    
    for doc in documentos:
        # Check active status
        persona = doc.persona
        is_active = False
        if hasattr(persona, 'socio') and hasattr(persona.socio, 'jugador'):
            if persona.socio.jugador.estado and persona.socio.jugador.estado.nombre == 'Activo':
                is_active = True
        elif hasattr(persona, 'socio'):
            if persona.socio.estado_administrativo and persona.socio.estado_administrativo.nombre == 'Activo':
                is_active = True
                
        if hasattr(persona, 'docente'):
            if persona.docente.estado and persona.docente.estado.nombre == 'Activo':
                is_active = True
                
        if not is_active:
            continue
            
        vencimiento = timezone.localtime(doc.fecha_vencimiento).date()
        dias = (vencimiento - hoy).days
        if dias < 0:
            vencidos += 1
        elif dias <= 30:
            proximos += 1

    return Response({
        "vencidos": vencidos,
        "proximos": proximos
    })

import zipfile
import io
import os
from django.http import HttpResponse

@extend_schema(tags=["Documental / Exportar"])
@api_view(["GET"])
def download_zip(request, persona_id):
    documentos = Documento.objects.filter(persona_id=persona_id).exclude(archivoUrl='')
    if not documentos.exists():
        return Response({'detail': 'No hay documentos con archivos adjuntos.'}, status=404)
        
    zip_buffer = io.BytesIO()
    files_added = 0
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for doc in documentos:
            if doc.archivoUrl and doc.archivoUrl.storage.exists(doc.archivoUrl.name):
                file_path = doc.archivoUrl.path
                file_name = os.path.basename(file_path)
                zip_file.write(file_path, arcname=file_name)
                files_added += 1
                
    if files_added == 0:
        return Response({'detail': 'No hay documentos físicos válidos para descargar.'}, status=404)
        
    response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="documentos_persona_{persona_id}.zip"'
    return response
