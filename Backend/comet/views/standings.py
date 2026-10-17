from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..services import listar_tablas_comet


@extend_schema(tags=["Comet / Tablas"])
@api_view(["GET"])
def tablas_view(request):
    """Proxy de solo lectura a las tablas de posiciones de COMET."""
    filtros = dict(request.query_params)
    return Response(listar_tablas_comet(filtros))