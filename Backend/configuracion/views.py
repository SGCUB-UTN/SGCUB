from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import ConfiguracionGeneral, HistorialConfiguracion
from .serializers import ConfiguracionGeneralSerializer, HistorialConfiguracionSerializer
from .services import update_general_configuration


@extend_schema(tags=["Configuracion"], request=ConfiguracionGeneralSerializer, responses=ConfiguracionGeneralSerializer)
@api_view(["GET", "PATCH"])
def configuracion_general(request):
    configuration = ConfiguracionGeneral.load()
    if request.method == "GET":
        return Response(ConfiguracionGeneralSerializer(configuration).data)

    serializer = ConfiguracionGeneralSerializer(configuration, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    user = request.user if request.user.is_authenticated else None
    configuration = update_general_configuration(serializer.validated_data, user)
    return Response(ConfiguracionGeneralSerializer(configuration).data)


@extend_schema(tags=["Configuracion"], responses=HistorialConfiguracionSerializer(many=True))
@api_view(["GET"])
def historial_configuracion(request):
    changes = HistorialConfiguracion.objects.select_related("usuario")
    section = request.query_params.get("seccion")
    if section:
        changes = changes.filter(seccion=section)
    return Response(HistorialConfiguracionSerializer(changes[:500], many=True).data)
