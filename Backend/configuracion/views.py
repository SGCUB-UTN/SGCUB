import json

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from finanzas.models import ConfiguracionFinanciera
from finanzas.serializers import ConfiguracionFinancieraSerializer, VersionConfiguracionFinancieraSerializer
from finanzas.services import create_configuration_version

from .models import ConfiguracionGeneral, HistorialConfiguracion
from .serializers import ConfiguracionGeneralSerializer, HistorialConfiguracionSerializer
from .services import update_general_configuration


@extend_schema(tags=["Configuracion"], responses=ConfiguracionGeneralSerializer)
@api_view(["GET"])
def configuracion_general(request):
    return Response(ConfiguracionGeneralSerializer(ConfiguracionGeneral.load(), context={"request": request}).data)


@extend_schema(tags=["Configuracion"], responses=HistorialConfiguracionSerializer(many=True))
@api_view(["GET"])
def historial_configuracion(request):
    changes = HistorialConfiguracion.objects.select_related("usuario")
    section = request.query_params.get("seccion")
    if section:
        changes = changes.filter(seccion=section)
    return Response(HistorialConfiguracionSerializer(changes[:500], many=True).data)


def read_payload(request):
    """JSON body, or multipart with the data as JSON in `datos` and the logo as a file."""
    if "datos" not in request.data:
        return dict(request.data)
    try:
        payload = json.loads(request.data["datos"])
    except (TypeError, ValueError):
        raise ValueError("Los datos enviados no son válidos.") from None
    if not isinstance(payload, dict):
        raise ValueError("Los datos enviados no son válidos.")
    return payload


def validate_financial_changes(changes):
    """Validated parameters of the new version, or the errors. Fields not sent keep the version in force."""
    base = ConfiguracionFinanciera.load(changes.get("periodo_vigencia"))
    serializer = ConfiguracionFinancieraSerializer(data={**base.parameters(), **changes})
    if not serializer.is_valid():
        return None, serializer.errors
    if all(serializer.validated_data[field] == value for field, value in base.parameters().items()):
        return None, {"detail": ["No hay cambios en los aranceles ni en el calendario de facturación."]}
    return serializer.validated_data, None


@extend_schema(tags=["Configuracion"])
@api_view(["POST"])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def guardar_configuracion(request):
    """Saves every change of the configuration screen at once, with the person responsible for it.

    Body: {"responsable": str, "general": {...}, "quitar_logo": bool, "financiera": {"periodo_vigencia": "YYYY-MM", ...}}
    """
    try:
        payload = read_payload(request)
    except ValueError as error:
        return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

    general_changes = payload.get("general") or {}
    financial_changes = payload.get("financiera") or None
    if not isinstance(general_changes, dict) or not isinstance(financial_changes, (dict, type(None))):
        return Response({"detail": "Los datos enviados no son válidos."}, status=status.HTTP_400_BAD_REQUEST)
    general_changes = dict(general_changes)
    responsable = str(payload.get("responsable") or "").strip()
    remove_logo = bool(payload.get("quitar_logo"))
    if "club_logo" in request.FILES:
        general_changes["club_logo"] = request.FILES["club_logo"]

    errors = {}
    if not responsable:
        errors["responsable"] = ["Indicá quién es el responsable de los cambios."]
    if not (general_changes or financial_changes or remove_logo):
        errors["detail"] = ["No hay cambios para guardar."]

    configuration = ConfiguracionGeneral.load()
    general_serializer = ConfiguracionGeneralSerializer(configuration, data=general_changes, partial=True)
    if not general_serializer.is_valid():
        errors["general"] = general_serializer.errors

    financial_values = None
    if financial_changes:
        financial_values, financial_errors = validate_financial_changes(dict(financial_changes))
        if financial_errors:
            errors["financiera"] = financial_errors

    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user if request.user.is_authenticated else None
    with transaction.atomic():
        configuration = update_general_configuration(general_serializer.validated_data, user, responsable, remove_logo)
        version = create_configuration_version(financial_values, user, responsable) if financial_values else None

    return Response({
        "general": ConfiguracionGeneralSerializer(configuration, context={"request": request}).data,
        "financiera": VersionConfiguracionFinancieraSerializer(version).data if version else None,
    })
