import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from configuracion.models import ConfiguracionGeneral
from padron.models import ESTADO_ADMINISTRATIVO_ACTIVO, Socio

from .models import CanalNotificacion, EnvioNotificacion, EstadoNotificacion, Notificacion
from .serializers import EnvioNotificacionSerializer, NotificacionSerializer
from .services import despachar_envios_email_notificacion, enviar_email_individual

logger = logging.getLogger(__name__)


@extend_schema(
    tags=["Comunicaciones / Resumen"],
    summary="Resumen e indicadores de comunicaciones",
    description="Devuelve métricas reales de envíos, tasa de entrega, cobertura de contacto del padrón activo y configuración del remitente.",
)
@api_view(["GET"])
def resumen_comunicaciones(request):
    now = timezone.localtime()
    notificaciones_qs = Notificacion.objects.all()
    notificaciones_mes_qs = notificaciones_qs.filter(
        fecha_creacion__year=now.year,
        fecha_creacion__month=now.month,
    )

    envios_qs = EnvioNotificacion.objects.all()
    envios_mes_qs = envios_qs.filter(
        notificacion__fecha_creacion__year=now.year,
        notificacion__fecha_creacion__month=now.month,
    )

    total_envios = envios_qs.count()
    envios_exitosos = envios_qs.filter(estado=EstadoNotificacion.ENVIADA).count()
    envios_fallidos = envios_qs.filter(estado=EstadoNotificacion.FALLIDA).count()

    envios_mes_exitosos = envios_mes_qs.filter(estado=EstadoNotificacion.ENVIADA).count()
    envios_mes_fallidos = envios_mes_qs.filter(estado=EstadoNotificacion.FALLIDA).count()

    tasa_entrega = round((envios_exitosos / total_envios) * 100, 1) if total_envios > 0 else 0.0

    socios_activos = Socio.objects.select_related("persona", "estado_administrativo").filter(
        estado_administrativo__nombre=ESTADO_ADMINISTRATIVO_ACTIVO
    )
    padron_total = socios_activos.count()
    con_email_q = Q(persona__email__isnull=False) & ~Q(persona__email="") & Q(persona__email__contains="@")
    con_telefono_q = Q(persona__telefono__isnull=False) & ~Q(persona__telefono="")

    con_email = socios_activos.filter(con_email_q).count()
    con_telefono = socios_activos.filter(con_telefono_q).count()
    con_ambos = socios_activos.filter(con_email_q & con_telefono_q).count()
    sin_contacto = socios_activos.exclude(con_email_q | con_telefono_q).count()

    configuracion = ConfiguracionGeneral.load()
    default_from = getattr(settings, "DEFAULT_FROM_EMAIL", "") or ""
    smtp_host = getattr(settings, "EMAIL_HOST", "") or ""
    smtp_user = getattr(settings, "EMAIL_HOST_USER", "") or ""
    smtp_pass = getattr(settings, "EMAIL_HOST_PASSWORD", "") or ""

    return Response(
        {
            "envios_mes": notificaciones_mes_qs.count(),
            "notificaciones_totales": notificaciones_qs.count(),
            "notificaciones_enviadas": notificaciones_qs.filter(estado=EstadoNotificacion.ENVIADA).count(),
            "notificaciones_fallidas": notificaciones_qs.filter(estado=EstadoNotificacion.FALLIDA).count(),
            "mensajes_entregados": envios_exitosos,
            "mensajes_entregados_mes": envios_mes_exitosos,
            "mensajes_fallidos": envios_fallidos,
            "mensajes_fallidos_mes": envios_mes_fallidos,
            "mensajes_totales": total_envios,
            "tasa_entrega": tasa_entrega,
            "por_canal": {
                "mail_enviados": envios_qs.filter(
                    canal=CanalNotificacion.MAIL, estado=EstadoNotificacion.ENVIADA
                ).count(),
                "mail_fallidos": envios_qs.filter(
                    canal=CanalNotificacion.MAIL, estado=EstadoNotificacion.FALLIDA
                ).count(),
                "whatsapp_enviados": envios_qs.filter(
                    canal=CanalNotificacion.WHATSAPP, estado=EstadoNotificacion.ENVIADA
                ).count(),
                "whatsapp_fallidos": envios_qs.filter(
                    canal=CanalNotificacion.WHATSAPP, estado=EstadoNotificacion.FALLIDA
                ).count(),
            },
            "cobertura": {
                "padron_total": padron_total,
                "con_email": con_email,
                "con_telefono": con_telefono,
                "con_ambos": con_ambos,
                "sin_email": max(0, padron_total - con_email),
                "sin_telefono": max(0, padron_total - con_telefono),
                "sin_contacto": sin_contacto,
            },
            "sin_contacto": sin_contacto,
            "remitente": {
                "club_nombre": configuracion.club_nombre,
                "nombre_remitente": configuracion.email_nombre_remitente or configuracion.club_nombre,
                "email_remitente": default_from,
                "email_secretaria": configuracion.club_email or default_from,
                "firma": configuracion.email_firma,
                "smtp_host": smtp_host,
                "smtp_configurado": bool(smtp_host and smtp_user and smtp_pass),
            },
        }
    )
    
@extend_schema(
    tags=["Comunicaciones / Opciones"],
    summary="Listar opciones de comunicación",
    description="Devuelve las opciones disponibles de canales (WhatsApp, Email) y estados (Programada, Enviada, Fallida).",
    responses={
        200: {
            "type": "object",
            "properties": {
                "canales": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "value": {"type": "string"},
                            "label": {"type": "string"},
                        },
                    },
                },
                "estados": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "value": {"type": "string"},
                            "label": {"type": "string"},
                        },
                    },
                },
            },
        }
    },
)
@api_view(["GET"])
def opciones_comunicacion(request):
    return Response(
        {
            "canales": [
                {"value": value, "label": label}
                for value, label in CanalNotificacion.choices
            ],
            "estados": [
                {"value": value, "label": label}
                for value, label in EstadoNotificacion.choices
            ],
        }
    )


@extend_schema(
    methods=["GET"],
    tags=["Comunicaciones / Notificaciones"],
    operation_id="comunicaciones_notificacion_list",
    summary="Listar notificaciones",
    description="Devuelve el listado de todas las notificaciones institucionales ordenadas por fecha de creación descendente.",
    responses=NotificacionSerializer(many=True),
)
@extend_schema(
    methods=["POST"],
    tags=["Comunicaciones / Notificaciones"],
    operation_id="comunicaciones_notificacion_create",
    summary="Crear y persistir notificación",
    description="Crea y persiste una nueva notificación institucional en la base de datos.",
    request=NotificacionSerializer,
    responses={201: NotificacionSerializer},
)
@api_view(["GET", "POST"])
def notificacion_list_create(request):
    if request.method == "GET":
        notificaciones = (
            Notificacion.objects.select_related("usuario")
            .prefetch_related("envios__socio__persona")
            .all()
            .order_by("-fecha_creacion")
        )
        serializer = NotificacionSerializer(notificaciones, many=True)
        return Response(serializer.data)

    serializer = NotificacionSerializer(data=request.data)
    if serializer.is_valid():
        envios_data = request.data.get("envios", [])
        if not isinstance(envios_data, list):
            return Response(
                {"envios": ["Se esperaba una lista de envíos."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
                notificacion = serializer.save(usuario=user)
                for index, item in enumerate(envios_data):
                    if not isinstance(item, dict):
                        raise ValidationError(
                            {"envios": {index: ["Cada envío debe ser un objeto."]}}
                        )
                    envio_serializer = EnvioNotificacionSerializer(
                        data={**item, "notificacion": notificacion.pk}
                    )
                    if not envio_serializer.is_valid():
                        raise ValidationError({"envios": {index: envio_serializer.errors}})
                    envio_serializer.save()
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        # Despachar correos vía SMTP (.env) y actualizar estado real
        copia_secretaria = bool(request.data.get("copia_secretaria", False))
        try:
            despachar_envios_email_notificacion(notificacion.id, copia_secretaria=copia_secretaria)
            notificacion.refresh_from_db()
        except Exception as exc:
            logger.error("Error al despachar envíos de notificación %s: %s", notificacion.id, exc)

        notificacion = (
            Notificacion.objects.select_related("usuario")
            .prefetch_related("envios__socio__persona")
            .get(pk=notificacion.pk)
        )
        return Response(NotificacionSerializer(notificacion).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    methods=["GET"],
    tags=["Comunicaciones / Notificaciones"],
    operation_id="comunicaciones_notificacion_retrieve",
    summary="Obtener notificación por ID",
    description="Devuelve el detalle de una notificación junto con sus envíos asociados.",
    responses=NotificacionSerializer,
)
@extend_schema(
    methods=["PUT"],
    tags=["Comunicaciones / Notificaciones"],
    operation_id="comunicaciones_notificacion_update",
    summary="Actualizar notificación completa",
    description="Actualiza todos los campos de una notificación existente.",
    request=NotificacionSerializer,
    responses=NotificacionSerializer,
)
@extend_schema(
    methods=["PATCH"],
    tags=["Comunicaciones / Notificaciones"],
    operation_id="comunicaciones_notificacion_partial_update",
    summary="Actualizar notificación parcialmente",
    description="Actualiza uno o varios campos de una notificación existente.",
    request=NotificacionSerializer,
    responses=NotificacionSerializer,
)
@extend_schema(
    methods=["DELETE"],
    tags=["Comunicaciones / Notificaciones"],
    operation_id="comunicaciones_notificacion_destroy",
    summary="Eliminar notificación",
    description="Elimina la notificación especificada.",
    responses={204: None},
)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def notificacion_detail(request, pk):
    notificacion = get_object_or_404(
        Notificacion.objects.select_related("usuario").prefetch_related("envios__socio__persona"), pk=pk
    )

    if request.method == "GET":
        serializer = NotificacionSerializer(notificacion)
        return Response(serializer.data)

    if request.method in ["PUT", "PATCH"]:
        serializer = NotificacionSerializer(notificacion, data=request.data, partial=request.method == "PATCH")
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    notificacion.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    methods=["GET"],
    tags=["Comunicaciones / Envíos"],
    operation_id="comunicaciones_envio_notificacion_list",
    summary="Listar envíos de notificaciones",
    description="Devuelve el historial de envíos individuales de notificaciones ordenados por fecha de envío descendente.",
    responses=EnvioNotificacionSerializer(many=True),
)
@extend_schema(
    methods=["POST"],
    tags=["Comunicaciones / Envíos"],
    operation_id="comunicaciones_envio_notificacion_create",
    summary="Registrar envío de notificación",
    description="Registra un envío individual asociado a una notificación en la base de datos.",
    request=EnvioNotificacionSerializer,
    responses={201: EnvioNotificacionSerializer},
    examples=[
        OpenApiExample(
            "Envio de notificación",
            value={
                "notificacion": 1,
                "socio": 1,
                "canal": "WHATSAPP",
                "estado": "ENVIADA",
                "detalle_fallo": "",
            },
            request_only=True,
        )
    ],
)

@extend_schema(
    methods=["GET"],
    tags=["Comunicaciones / Envíos"],
    operation_id="comunicaciones_envio_notificacion_retrieve",
    summary="Obtener detalle de envío",
    description="Devuelve la información de un envío de notificación por su ID.",
    responses=EnvioNotificacionSerializer,
)
@extend_schema(
    methods=["PUT"],
    tags=["Comunicaciones / Envíos"],
    operation_id="comunicaciones_envio_notificacion_update",
    summary="Actualizar envío completo",
    description="Actualiza todos los campos de un envío existente.",
    request=EnvioNotificacionSerializer,
    responses=EnvioNotificacionSerializer,
    examples=[
        OpenApiExample(
            "Actualizar envio",
            value={
                "notificacion": 1,
                "socio": 1,
                "canal": "MAIL",
                "estado": "ENVIADA",
                "detalle_fallo": "",
            },
            request_only=True,
        )
    ],
)
@extend_schema(
    methods=["PATCH"],
    tags=["Comunicaciones / Envíos"],
    operation_id="comunicaciones_envio_notificacion_partial_update",
    summary="Actualizar envío parcialmente",
    description="Actualiza uno o varios campos de un envío existente.",
    request=EnvioNotificacionSerializer,
    responses=EnvioNotificacionSerializer,
)
@extend_schema(
    methods=["DELETE"],
    tags=["Comunicaciones / Envíos"],
    operation_id="comunicaciones_envio_notificacion_destroy",
    summary="Eliminar envío",
    description="Elimina el registro de un envío de notificación.",
    responses={204: None},
)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def envio_notificacion_detail(request, pk):
    envio = get_object_or_404(
        EnvioNotificacion.objects.select_related(
            "notificacion", "socio__persona"
        ),
        pk=pk,
    )

    if request.method == "GET":
        serializer = EnvioNotificacionSerializer(envio)
        return Response(serializer.data)

    if request.method in ["PUT", "PATCH"]:
        serializer = EnvioNotificacionSerializer(envio, data=request.data, partial=request.method == "PATCH")
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    envio.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
