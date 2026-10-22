from django.db import transaction
from django.db.models import Count, ProtectedError, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .search import normalize_text, normalized_field
from .services import recategorizar_jugadores
from .services import pasr_de_anio_vigente_a_categoria

from .models import CargoDocente, Persona, Socio, Categoria, Jugador, Docente, EstadoDeportivo, VinculoFamiliar, EstadoAdministrativo, Genero, Localidad, Barrio, DocenteCategoria, ESTADO_ADMINISTRATIVO_ACTIVO, ESTADO_DEPORTIVO_ACTIVO
from .serializers import (
    CargoDocenteSerializer,
    DocenteCategoriaSerializer,
    PersonaSerializer,
    SocioSerializer,
    CategoriaSerializer,
    CategoriaListSerializer,
    EstadoDeportivoSerializer,
    JugadorSerializer,
    JugadorListSerializer,
    JugadorSerializerDetail,
    DocenteSerializer,
    VinculoFamiliarSerializer,
    EstadoAdministrativoSerializer,
    GeneroSerializer,
    LocalidadSerializer,
    BarrioSerializer,
    player_contacts_error,
)

PERSONA_SEARCH_LIMIT = 10


@extend_schema(tags=["Padron / Genero"], request=GeneroSerializer, responses=GeneroSerializer)
@api_view(["GET"])
def genero_list(request):
    genders = Genero.objects.all()
    return Response(GeneroSerializer(genders, many=True).data)


@extend_schema(tags=["Padron / Localidad"], request=LocalidadSerializer, responses=LocalidadSerializer)
@api_view(["GET", "POST"])
def localidad_list(request):
    if request.method == "GET":
        localities = Localidad.objects.order_by("nombre")
        return Response(LocalidadSerializer(localities, many=True).data)

    serializer = LocalidadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    locality = serializer.save()
    return Response(LocalidadSerializer(locality).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Padron / Barrio"], request=BarrioSerializer, responses=BarrioSerializer)
@api_view(["GET", "POST"])
def barrio_list_create(request):
    if request.method == "GET":
        neighborhoods = Barrio.objects.all()
        locality_id = request.query_params.get("localidad")
        if locality_id:
            neighborhoods = neighborhoods.filter(localidad_id=locality_id)
        return Response(BarrioSerializer(neighborhoods, many=True).data)

    serializer = BarrioSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    neighborhood = serializer.save()
    return Response(BarrioSerializer(neighborhood).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Padron / EstadoAdministrativo"], request=EstadoAdministrativoSerializer, responses=EstadoAdministrativoSerializer)
@api_view(["GET"])
def estado_administrativo_list_create(request):
    member_statuses = EstadoAdministrativo.objects.all()
    serializer = EstadoAdministrativoSerializer(member_statuses, many=True)
    return Response(serializer.data)


@extend_schema(tags=["Padron / EstadoAdministrativo"], request=EstadoAdministrativoSerializer, responses=EstadoAdministrativoSerializer)
@api_view(["GET"])
def estado_administrativo_detail(request, pk):
    member_status = get_object_or_404(EstadoAdministrativo, pk=pk)
    serializer = EstadoAdministrativoSerializer(member_status)
    return Response(serializer.data)


@extend_schema(tags=["Padron / Persona"], request=PersonaSerializer, responses=PersonaSerializer)
@api_view(["GET", "POST"])
def persona_list_create(request):
    if request.method == "GET":
        people = Persona.objects.select_related(
            "genero", "domicilio__localidad", "domicilio__barrio", "socio__jugador", "docente"
        ).prefetch_related("vinculos_familiares__jugador__socio__persona", "vinculos_familiares__docente__persona")
        dni = request.query_params.get("dni")
        dni_prefix = request.query_params.get("dni_prefix")
        search = request.query_params.get("q", "").strip()
        if dni:
            people = people.filter(dni=dni)
        elif dni_prefix:
            people = people.filter(dni__startswith=dni_prefix).order_by("dni")[:5]
        elif search:
            people = people.annotate(
                normalized_name=normalized_field("nombre"),
                normalized_surname=normalized_field("apellido"),
            )
            for term in normalize_text(search).split():
                term_filter = (
                    Q(dni__startswith=term)
                    | Q(normalized_name__contains=term)
                    | Q(normalized_surname__contains=term)
                )
                if term.isdigit():
                    term_filter |= Q(socio__numero_socio=int(term))
                people = people.filter(term_filter)
            people = people.order_by("apellido", "nombre")[:PERSONA_SEARCH_LIMIT]
        serializer = PersonaSerializer(people, many=True)
        return Response(serializer.data)

    serializer = PersonaSerializer(data=request.data)
    if serializer.is_valid():
        person = serializer.save()
        return Response(PersonaSerializer(person).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["Padron / Persona"], request=PersonaSerializer, responses=PersonaSerializer)
@api_view(["GET", "PUT", "PATCH"])
def persona_detail(request, pk):
    person = get_object_or_404(Persona, pk=pk)

    if request.method == "GET":
        serializer = PersonaSerializer(person)
        return Response(serializer.data)

    serializer = PersonaSerializer(person, data=request.data, partial=True)
    if serializer.is_valid():
        person = serializer.save()
        return Response(PersonaSerializer(person).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["Padron / Socio"], request=SocioSerializer, responses=SocioSerializer)
@api_view(["GET", "POST"])
def socio_list_create(request):
    if request.method == "GET":
        members = Socio.objects.select_related(
            "persona__genero", "persona__domicilio__localidad", "persona__domicilio__barrio", "estado_administrativo", "jugador__estado"
        )
        is_player = request.query_params.get("es_jugador")
        if is_player is not None:
            if is_player not in ("true", "false"):
                return Response({"es_jugador": "Debe ser 'true' o 'false'."}, status=status.HTTP_400_BAD_REQUEST)
            members_only = Q(jugador__isnull=True) | (
                Q(estado_administrativo__nombre=ESTADO_ADMINISTRATIVO_ACTIVO) & ~Q(jugador__estado__nombre=ESTADO_DEPORTIVO_ACTIVO)
            )
            members = members.exclude(members_only) if is_player == "true" else members.filter(members_only)
        serializer = SocioSerializer(members, many=True)
        return Response(serializer.data)

    serializer = SocioSerializer(data=request.data)

    if serializer.is_valid():
        member = serializer.save()
        return Response(
            SocioSerializer(member).data,
            status=status.HTTP_201_CREATED
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


@extend_schema(tags=["Padron / Socio"], request=SocioSerializer, responses=SocioSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def socio_detail(request, pk):
    member = get_object_or_404(Socio, pk=pk)

    if request.method == "GET":
        serializer = SocioSerializer(member)
        return Response(serializer.data)

    if request.method == "DELETE":
        # Baja lógica: el registro se conserva con estado Inactivo
        member.deactivate()
        return Response(SocioSerializer(member).data)

    serializer = SocioSerializer(member, data=request.data, partial=True)
    if serializer.is_valid():
        member = serializer.save()
        return Response(SocioSerializer(member).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def format_names(names, limit=3):
    """Lista hasta `limit` nombres y resume el resto: 'A, B, C y 2 más'."""
    if len(names) <= limit:
        return ", ".join(names)
    return f"{', '.join(names[:limit])} y {len(names) - limit} más"


@extend_schema(tags=["Padron / Categoria"], request=CategoriaSerializer, responses=CategoriaListSerializer)
@api_view(["GET", "POST"])
def categoria_list_create(request):
    if request.method == "GET":
        categories = Categoria.objects.annotate(
            main_players_count=Count("jugadores", distinct=True),
            secondary_players_count=Count("jugadores_secundarios", distinct=True),
            cantidad_docentes=Count("docentes_categoria", distinct=True),
        )
        serializer = CategoriaListSerializer(categories, many=True)
        return Response(serializer.data)

    serializer = CategoriaSerializer(data=request.data)
    if serializer.is_valid():
        category = serializer.save()
        return Response(CategoriaSerializer(category).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["Padron / Categoria"], request=CategoriaSerializer, responses=CategoriaSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def categoria_detail(request, pk):
    category = get_object_or_404(Categoria, pk=pk)

    if request.method == "GET":
        serializer = CategoriaSerializer(category)
        return Response(serializer.data)

    if request.method == "PUT":
        serializer = CategoriaSerializer(category, data=request.data, partial=True)
        if serializer.is_valid():
            category = serializer.save()
            return Response(CategoriaSerializer(category).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == "PATCH":
        serializer = CategoriaSerializer(category, data=request.data, partial=True)
        if serializer.is_valid():
            category = serializer.save()
            return Response(CategoriaSerializer(category).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        players = [
            str(player.socio.persona)
            for player in Jugador.objects.filter(Q(categoria=category) | Q(categoria_secundaria=category))
            .select_related("socio__persona")
            .distinct()
        ]
        if players:
            noun = "1 jugador asignado" if len(players) == 1 else f"{len(players)} jugadores asignados"
            return Response(
                {"detail": f"No se puede eliminar {category.nombre}: tiene {noun} ({format_names(players)}). "
                           "Reasignalos a otra categoría antes de eliminarla."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        teachers_left_without_assignments = [
            str(assignment.docente.persona)
            for assignment in category.docentes_categoria.select_related("docente__persona", "docente__estado")
            if not assignment.docente.is_inactive
            and not assignment.docente.has_assignments(exclude={"categoria": category})
        ]
        if teachers_left_without_assignments:
            return Response(
                {"detail": f"No se puede eliminar {category.nombre}: es la única categoría de "
                           f"{format_names(teachers_left_without_assignments)}. "
                           "Asignales otra categoría o debe darlo de baja antes de eliminarla."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            category.delete()
        except ProtectedError:
            return Response(
                {"detail": f"No se puede eliminar {category.nombre}: tiene registros asociados."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Padron / EstadoDeportivo"], request=EstadoDeportivoSerializer, responses=EstadoDeportivoSerializer)
@api_view(["GET", "POST"])
def estado_list_create(request):
    if request.method == "GET":
        sport_statuses = EstadoDeportivo.objects.all()
        serializer = EstadoDeportivoSerializer(sport_statuses, many=True)
        return Response(serializer.data)

    serializer = EstadoDeportivoSerializer(data=request.data)
    if serializer.is_valid():
        sport_status = serializer.save()
        return Response(EstadoDeportivoSerializer(sport_status).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["Padron / EstadoDeportivo"], request=EstadoDeportivoSerializer, responses=EstadoDeportivoSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def estado_detail(request, pk):
    sport_status = get_object_or_404(EstadoDeportivo, pk=pk)

    if request.method == "GET":
        serializer = EstadoDeportivoSerializer(sport_status)
        return Response(serializer.data)

    if request.method == "PUT":
        serializer = EstadoDeportivoSerializer(sport_status, data=request.data, partial=True)
        if serializer.is_valid():
            sport_status = serializer.save()
            return Response(EstadoDeportivoSerializer(sport_status).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == "PATCH":
        serializer = EstadoDeportivoSerializer(sport_status, data=request.data, partial=True)
        if serializer.is_valid():
            sport_status = serializer.save()
            return Response(EstadoDeportivoSerializer(sport_status).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    sport_status.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Padron / Jugador"], request=JugadorSerializer, responses={200: JugadorListSerializer, 201: JugadorListSerializer})
@api_view(["GET", "POST"])
def jugador_list_create(request):
    if request.method == "GET":
        players = Jugador.objects.select_related(
            "socio__persona__genero", "socio__persona__domicilio__localidad", "socio__persona__domicilio__barrio", "socio__estado_administrativo",
            "categoria", "categoria_secundaria", "estado",
        ).prefetch_related(
            "vinculos_familiares__persona__genero",
            "vinculos_familiares__persona__domicilio__localidad",
            "vinculos_familiares__persona__domicilio__barrio",
        )
        category_id = request.query_params.get("categoria")
        if category_id:
            if not category_id.isdigit():
                return Response({"categoria": "Debe ser un número."}, status=status.HTTP_400_BAD_REQUEST)
            players = players.filter(Q(categoria_id=category_id) | Q(categoria_secundaria_id=category_id))
        serializer = JugadorListSerializer(players, many=True)
        return Response(serializer.data)

    serializer = JugadorSerializer(data=request.data)
    if serializer.is_valid():
        player = serializer.save()
        return Response(JugadorSerializerDetail(player).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["Padron / Jugador"], request=JugadorSerializer, responses={200: JugadorSerializerDetail, 201: JugadorSerializerDetail})
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def jugador_detail(request, pk):
    player = get_object_or_404(Jugador, pk=pk)

    if request.method == "GET":
        serializer = JugadorSerializerDetail(player)
        return Response(serializer.data)

    if request.method == "PUT":
        serializer = JugadorSerializer(player, data=request.data, partial=False)
        if serializer.is_valid():
            player = serializer.save()
            return Response(JugadorSerializerDetail(player).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == "PATCH":
        serializer = JugadorSerializer(player, data=request.data, partial=True)
        if serializer.is_valid():
            player = serializer.save()
            return Response(JugadorSerializerDetail(player).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Baja lógica: el registro se conserva con estado deportivo Inactivo
    if request.query_params.get("completa") == "true":
        player.socio.deactivate()
        player.refresh_from_db()
    else:
        player.deactivate()
    return Response(JugadorSerializerDetail(player).data)


@extend_schema(tags=["Padron / Docente"], request=DocenteSerializer, responses=DocenteSerializer)
@api_view(["GET", "POST"])
def docente_list_create(request):
    if request.method == "GET":
        teachers = Docente.objects.select_related(
            "persona__genero", "persona__domicilio__localidad", "persona__domicilio__barrio", "persona__socio__jugador", "estado"
        ).prefetch_related(
            "categorias_docente__cargo",
            "categorias_docente__categoria",
            "vinculos_familiares__persona__genero",
            "vinculos_familiares__persona__domicilio__localidad",
            "vinculos_familiares__persona__domicilio__barrio",
        )
        serializer = DocenteSerializer(teachers, many=True)
        return Response(serializer.data)

    serializer = DocenteSerializer(data=request.data)
    if serializer.is_valid():
        teacher = serializer.save()
        return Response(DocenteSerializer(teacher).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["Padron / Docente"], request=DocenteSerializer, responses=DocenteSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def docente_detail(request, pk):
    teacher = get_object_or_404(Docente, pk=pk)

    if request.method == "GET":
        serializer = DocenteSerializer(teacher)
        return Response(serializer.data)

    if request.method == "DELETE":
        # Baja lógica: el registro se conserva con estado Inactivo
        teacher.deactivate()
        return Response(DocenteSerializer(teacher).data)

    serializer = DocenteSerializer(teacher, data=request.data, partial=True)
    if serializer.is_valid():
        teacher = serializer.save()
        return Response(DocenteSerializer(teacher).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["Padron / Docente"], responses=CargoDocenteSerializer)
@api_view(["GET"])
def cargo_docente_list(request):
    positions = CargoDocente.objects.order_by("nombre")
    return Response(CargoDocenteSerializer(positions, many=True).data)


@extend_schema(tags=["Padron / VinculoFamiliar"], request=VinculoFamiliarSerializer, responses=VinculoFamiliarSerializer)
@api_view(["GET", "POST"])
def vinculo_familiar_list_create(request):
    if request.method == "GET":
        contacts = VinculoFamiliar.objects.select_related(
            "persona__genero",
            "persona__domicilio__localidad",
            "persona__domicilio__barrio",
            "jugador",
            "docente",
        )

        serializer = VinculoFamiliarSerializer(contacts, many=True)
        return Response(serializer.data)

    serializer = VinculoFamiliarSerializer(data=request.data)

    if serializer.is_valid():
        contact = serializer.save()

        return Response(
            VinculoFamiliarSerializer(contact).data,
            status=status.HTTP_201_CREATED,
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST,
    )


@extend_schema(tags=["Padron / VinculoFamiliar"], request=VinculoFamiliarSerializer, responses=VinculoFamiliarSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def vinculo_familiar_detail(request, pk):
    contact = get_object_or_404(
        VinculoFamiliar.objects.select_related(
            "persona__genero",
            "persona__domicilio__localidad",
            "persona__domicilio__barrio",
            "jugador",
            "docente",
        ),
        pk=pk,
    )

    if request.method == "GET":
        serializer = VinculoFamiliarSerializer(contact)
        return Response(serializer.data)

    if request.method in ["PUT", "PATCH"]:
        serializer = VinculoFamiliarSerializer(
            contact,
            data=request.data,
            partial=request.method == "PATCH",
        )

        if serializer.is_valid():
            contact = serializer.save()
            return Response(VinculoFamiliarSerializer(contact).data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    player = contact.jugador
    if player is not None:
        remaining_flags = list(
            player.vinculos_familiares.exclude(pk=contact.pk).values_list("responsable_legal", flat=True)
        )
        error = player_contacts_error(player.socio.persona.fecha_nacimiento, remaining_flags)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
    contact.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Padron / Jugador"], summary="Recategorizar jugadores")
@api_view(["POST"])
def recategorize_players_view(request):
    recategorizar_jugadores()
    return Response({"message": "Recategorización de jugadores completada."}, status=status.HTTP_200_OK)


@extend_schema(tags=["Padron / Categoria"], summary="Actualizar año vigente de categorías")
@api_view(["POST"])
def update_categories_current_year_view(request):
    pasr_de_anio_vigente_a_categoria()
    return Response({"message": "Año vigente de categorías actualizado."}, status=status.HTTP_200_OK)


@extend_schema(tags=["Padron / DocenteCategoria"], request=DocenteCategoriaSerializer, responses=DocenteCategoriaSerializer)
@api_view(["GET", "POST"])
def docente_categoria_list(request):
    if request.method == "POST":
        serializer = DocenteCategoriaSerializer(data=request.data)
        if serializer.is_valid():
            teacher_category = serializer.save()
            return Response(
                DocenteCategoriaSerializer(teacher_category).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    teacher_categories = DocenteCategoria.objects.select_related("docente", "categoria", "cargo")

    teacher_id = (
        request.query_params.get("idDocente")
        or request.query_params.get("docente_id")
        or request.query_params.get("docente")
    )
    category_id = (
        request.query_params.get("idCategoria")
        or request.query_params.get("categoria_id")
        or request.query_params.get("categoria")
    )

    if teacher_id:
        teacher_categories = teacher_categories.filter(docente_id=teacher_id)
    if category_id:
        teacher_categories = teacher_categories.filter(categoria_id=category_id)

    serializer = DocenteCategoriaSerializer(teacher_categories, many=True)
    return Response(serializer.data)


@extend_schema(tags=["Padron / DocenteCategoria"], responses=DocenteCategoriaSerializer)
@api_view(["GET", "DELETE"])
def docente_categoria_detail(request, pk):
    teacher_category = get_object_or_404(
        DocenteCategoria.objects.select_related("docente", "categoria", "cargo"),
        pk=pk,
    )
    if request.method == "DELETE":
        teacher = teacher_category.docente
        if not teacher.is_inactive and not teacher.has_assignments(exclude={"pk": teacher_category.pk}):
            return Response(
                {"detail": "Es la única categoría del docente: debe tener al menos un cargo con una categoría."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        teacher_category.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = DocenteCategoriaSerializer(teacher_category)
    return Response(serializer.data)


@extend_schema(tags=["Padron / DocenteCategoria"], request=DocenteCategoriaSerializer, responses=DocenteCategoriaSerializer)
@api_view(["POST"])
def docente_categoria_create(request):
    serializer = DocenteCategoriaSerializer(data=request.data)
    if serializer.is_valid():
        teacher_category = serializer.save()
        return Response(
            DocenteCategoriaSerializer(teacher_category).data,
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
