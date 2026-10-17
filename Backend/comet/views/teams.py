from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..services import listar_equipos_comet


@extend_schema(tags=["Comet / Equipos"])
@api_view(["GET"])
def equipos_view(request):
    """Proxy de solo lectura al listado de equipos de COMET."""
    filtros = dict(request.query_params)
    return Response(listar_equipos_comet(filtros))