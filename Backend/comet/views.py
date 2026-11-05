from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from padron.models import Categoria, ESTADO_DEPORTIVO_ACTIVO, Jugador

from .eligibility import apto_fisico_vencimiento, tiene_apto_fisico_vigente
from .pdf import generar_planilla_jugador_pdf, generar_planillas_categoria_pdf


@extend_schema(tags=["Comet / Jugadores"])
@api_view(["GET"])
def estado_jugador_comet_view(request, pk):
    """Devuelve si el jugador cuenta con apto físico vigente y habilitación para COMET."""
    jugador = get_object_or_404(Jugador, pk=pk)
    puede, motivo = tiene_apto_fisico_vigente(jugador)
    vencimiento = apto_fisico_vencimiento(jugador)

    return Response({
        "jugador_id": jugador.pk,
        "apto_fisico_vigente": puede,
        "motivo": motivo,
        "vencimiento": vencimiento,
    })


@extend_schema(tags=["Comet / Jugadores"])
@api_view(["GET", "POST"])
def exportar_planilla_jugador_view(request, pk):
    """
    Genera y descarga la planilla de datos de un jugador para COMET en formato PDF.
    Aplica la regla estricta: bloquea con 400 si no posee apto físico vigente.
    """
    jugador = get_object_or_404(
        Jugador.objects.select_related(
            "socio__persona__genero",
            "socio__persona__domicilio__localidad",
            "categoria",
            "categoria_secundaria",
            "estado",
        ),
        pk=pk,
    )

    puede, motivo = tiene_apto_fisico_vigente(jugador)
    if not puede:
        return Response(
            {"detail": motivo or "El jugador no posee apto físico vigente cargado."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    pdf_bytes = generar_planilla_jugador_pdf(jugador)
    dni = jugador.socio.persona.dni or str(jugador.pk)
    apellido = jugador.socio.persona.apellido.strip().replace(" ", "_") or "jugador"

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="planilla_comet_{dni}_{apellido}.pdf"'
    response["Access-Control-Expose-Headers"] = "Content-Disposition"
    return response


@extend_schema(tags=["Comet / Categorías"])
@api_view(["GET"])
def exportar_planillas_categoria_view(request, pk):
    """
    Genera y descarga un PDF consolidado con las planillas COMET de todos los
    jugadores activos de la categoría que posean apto físico vigente.
    """
    categoria = get_object_or_404(Categoria, pk=pk)
    jugadores = list(
        Jugador.objects.filter(
            categoria=categoria,
            estado__nombre=ESTADO_DEPORTIVO_ACTIVO,
        ).select_related(
            "socio__persona__genero",
            "socio__persona__domicilio__localidad",
            "categoria",
            "categoria_secundaria",
            "estado",
        ).order_by("socio__persona__apellido", "socio__persona__nombre")
    )

    aptos = [j for j in jugadores if tiene_apto_fisico_vigente(j)[0]]
    if not aptos:
        return Response(
            {"detail": f"No hay jugadores en la categoría '{categoria.nombre}' con apto físico vigente."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    pdf_bytes = generar_planillas_categoria_pdf(aptos)
    cat_slug = categoria.nombre.strip().lower().replace(" ", "_")

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="planillas_comet_{cat_slug}.pdf"'
    response["Access-Control-Expose-Headers"] = "Content-Disposition, X-Total-Aptos, X-Total-Excluidos"
    response["X-Total-Aptos"] = str(len(aptos))
    response["X-Total-Excluidos"] = str(len(jugadores) - len(aptos))
    return response

