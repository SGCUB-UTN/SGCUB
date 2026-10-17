from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..services import listar_partidos_comet, listar_resultados_comet


@extend_schema(tags=["Comet / Partidos"])
@api_view(["GET"])
def partidos_view(request):
    """Proxy de solo lectura al listado de partidos de COMET."""
    filtros = dict(request.query_params)
    return Response(listar_partidos_comet(filtros))


@extend_schema(tags=["Comet / Partidos"])
@api_view(["GET"])
def resultados_view(request):
    """Proxy de solo lectura al listado de resultados de COMET."""
    filtros = dict(request.query_params)
    return Response(listar_resultados_comet(filtros))