from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .services import home_summary


@extend_schema(tags=["Inicio"], summary="Resumen operativo del panel principal")
@api_view(["GET"])
def resumen_inicio(request):
    return Response(home_summary())
