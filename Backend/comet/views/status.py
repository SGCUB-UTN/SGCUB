from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..config import CometConfig
from ..exceptions import CometNotConfiguredError


@extend_schema(tags=["Comet / Estado"])
@api_view(["GET"])
def status_view(request):
    """Informa el modo actual de la integración y si está configurada."""
    try:
        config = CometConfig.from_settings()
        return Response({
            "modo": config.mode,
            "configurado": True,
            "base_url": config.base_url if config.mode != "mock" else None,
            "timestamp": timezone.now().isoformat(),
        })
    except CometNotConfiguredError as exc:
        return Response({
            "modo": None,
            "configurado": False,
            "detalle": str(exc),
            "timestamp": timezone.now().isoformat(),
        })