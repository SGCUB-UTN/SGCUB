from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from padron.models import Jugador

from ..models import CometOperationLog
from ..serializers import CometOperationLogSerializer
from ..services import exportar_jugador, listar_jugadores_comet


@extend_schema(tags=["Comet / Jugadores"])
@api_view(["GET"])
def jugadores_view(request):
    """Proxy de solo lectura al listado de jugadores de COMET."""
    filtros = dict(request.query_params)
    return Response(listar_jugadores_comet(filtros))


@extend_schema(
    tags=["Comet / Jugadores"],
    responses=CometOperationLogSerializer,
)
@api_view(["POST"])
def exportar_jugador_view(request, pk):
    jugador = get_object_or_404(
        Jugador.objects.select_related(
            "socio__persona__genero", "categoria", "estado",
        ),
        pk=pk,
    )
    usuario = request.user if request.user.is_authenticated else None
    log = exportar_jugador(jugador, usuario=usuario)
    return Response(
        CometOperationLogSerializer(log).data,
        status=status.HTTP_201_CREATED if log.exitoso else status.HTTP_400_BAD_REQUEST,
    )


@extend_schema(tags=["Comet / Jugadores"])
@api_view(["GET"])
def estado_jugador_view(request, pk):
    """Estado del último intento de exportación de un jugador."""
    jugador = get_object_or_404(Jugador, pk=pk)
    ultimo = jugador.comet_operations.first()
    return Response({
        "jugador_id": jugador.pk,
        "exportado": bool(ultimo and ultimo.exitoso),
        "ultimo_intento": CometOperationLogSerializer(ultimo).data if ultimo else None,
    })


@extend_schema(
    tags=["Comet / Logs"],
    responses=CometOperationLogSerializer(many=True),
)
@api_view(["GET"])
def log_operaciones_view(request):
    logs = CometOperationLog.objects.select_related(
        "jugador__socio__persona", "usuario",
    )
    jugador_id = request.query_params.get("jugador_id")
    if jugador_id and jugador_id.isdigit():
        logs = logs.filter(jugador_id=int(jugador_id))
    operacion = request.query_params.get("operacion")
    if operacion:
        logs = logs.filter(operacion=operacion)
    return Response(CometOperationLogSerializer(logs, many=True).data)