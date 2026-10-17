from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..services import listar_competiciones_comet


@extend_schema(tags=["Comet / Competiciones"])
@api_view(["GET"])
def competiciones_view(request):
    """Proxy de solo lectura al listado de competiciones de COMET."""
    filtros = dict(request.query_params)
    return Response(listar_competiciones_comet(filtros))