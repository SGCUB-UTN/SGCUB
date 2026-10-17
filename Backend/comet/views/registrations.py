from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..services import listar_inscripciones_comet


@extend_schema(tags=["Comet / Inscripciones"])
@api_view(["GET"])
def inscripciones_view(request):
    """Proxy de solo lectura al listado de inscripciones de COMET."""
    filtros = dict(request.query_params)
    return Response(listar_inscripciones_comet(filtros))