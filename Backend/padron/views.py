from django.db import models as django_models, transaction
from django.db.models import Count, ProtectedError, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from configuracion.services import Seccion, record_change
from .search import normalize_text, normalized_field

from .models import CargoDocente, Persona, Socio, Categoria, Jugador, Docente, EstadoDeportivo, VinculoFamiliar, EstadoAdministrativo, Genero, Localidad, Barrio, DocenteCategoria, ESTADO_ADMINISTRATIVO_ACTIVO, ESTADO_DEPORTIVO_ACTIVO, ObraSocial, TalleIndumentaria, TipoRelacionFamiliar
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
    ObraSocialSerializer,
    TalleIndumentariaSerializer,
    TipoRelacionFamiliarSerializer,
    player_contacts_error,
)

PERSONA_SEARCH_LIMIT = 10


def request_user(request):
    return request.user if getattr(request, "user", None) and request.user.is_authenticated else None


def talle_sort_key(nombre):
    name = (nombre or "").strip().upper()
    if name.isdigit():
        return (0, int(name), "")
    letter_ranks = {
        "XXXS": 1, "XXS": 2, "XS": 3, "S": 4, "M": 5, "L": 6,
        "XL": 7, "XXL": 8, "2XL": 8, "XXXL": 9, "3XL": 9, "4XL": 10,
    }
    if name in letter_ranks:
        return (1, letter_ranks[name], "")
    return (2, 0, name)


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
    record_change(Seccion.PERSONAS, f"Localidad {locality.nombre}", "", "Alta", request_user(request))
    return Response(LocalidadSerializer(locality).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Padron / Localidad"], request=LocalidadSerializer, responses=LocalidadSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def localidad_detail(request, pk):
    localidad = get_object_or_404(Localidad, pk=pk)

    if request.method == "GET":
        return Response(LocalidadSerializer(localidad).data)

    if request.method in ["PUT", "PATCH"]:
        old_name = localidad.nombre
        old_cp = localidad.codigo_postal
        serializer = LocalidadSerializer(localidad, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        localidad = serializer.save()
        before_str = f"{old_name}" + (f" (CP {old_cp})" if old_cp else "")
        after_str = f"{localidad.nombre}" + (f" (CP {localidad.codigo_postal})" if localidad.codigo_postal else "")
        if before_str != after_str:
            record_change(Seccion.PERSONAS, f"Localidad {old_name}", before_str, after_str, request_user(request))
        return Response(LocalidadSerializer(localidad).data)

    if request.method == "DELETE":
        if localidad.domicilios.exists() or localidad.barrios.exists():
            return Response(
                {"detail": "No se puede eliminar la localidad porque tiene barrios o domicilios asociados."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nombre = localidad.nombre
        localidad.delete()
        record_change(Seccion.PERSONAS, f"Localidad {nombre}", "Existente", "Eliminado", request_user(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


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
    record_change(Seccion.PERSONAS, f"Barrio {neighborhood.nombre}", "", f"Alta ({neighborhood.localidad.nombre})", request_user(request))
    return Response(BarrioSerializer(neighborhood).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Padron / Barrio"], request=BarrioSerializer, responses=BarrioSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def barrio_detail(request, pk):
    barrio = get_object_or_404(Barrio, pk=pk)

    if request.method == "GET":
        return Response(BarrioSerializer(barrio).data)

    if request.method in ["PUT", "PATCH"]:
        old_name = barrio.nombre
        old_loc = barrio.localidad.nombre
        serializer = BarrioSerializer(barrio, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        barrio = serializer.save()
        before_str = f"{old_name} ({old_loc})"
        after_str = f"{barrio.nombre} ({barrio.localidad.nombre})"
        if before_str != after_str:
            record_change(Seccion.PERSONAS, f"Barrio {old_name}", before_str, after_str, request_user(request))
        return Response(BarrioSerializer(barrio).data)

    if request.method == "DELETE":
        if barrio.domicilios.exists():
            return Response(
                {"detail": "No se puede eliminar el barrio porque tiene domicilios asociados."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nombre = f"{barrio.nombre} ({barrio.localidad.nombre})"
        barrio.delete()
        record_change(Seccion.PERSONAS, f"Barrio {nombre}", "Existente", "Eliminado", request_user(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


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


@extend_schema(tags=["Padron / Docente"], request=CargoDocenteSerializer, responses=CargoDocenteSerializer)
@api_view(["GET", "POST"])
def cargo_docente_list(request):
    if request.method == "GET":
        positions = CargoDocente.objects.order_by("nombre")
        return Response(CargoDocenteSerializer(positions, many=True).data)

    serializer = CargoDocenteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    cargo = serializer.save()
    record_change(Seccion.PERSONAS, f"Cargo docente {cargo.nombre}", "", "Alta", request_user(request))
    return Response(CargoDocenteSerializer(cargo).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Padron / Docente"], request=CargoDocenteSerializer, responses=CargoDocenteSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def cargo_docente_detail(request, pk):
    cargo = get_object_or_404(CargoDocente, pk=pk)

    if request.method == "GET":
        return Response(CargoDocenteSerializer(cargo).data)

    if request.method in ["PUT", "PATCH"]:
        old_name = cargo.nombre
        serializer = CargoDocenteSerializer(cargo, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        cargo = serializer.save()
        if old_name != cargo.nombre:
            record_change(Seccion.PERSONAS, f"Cargo docente {old_name}", old_name, cargo.nombre, request_user(request))
        return Response(CargoDocenteSerializer(cargo).data)

    if request.method == "DELETE":
        if cargo.asignaciones.exists():
            return Response(
                {"detail": "No se puede eliminar el cargo porque está asignado a docentes."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nombre = cargo.nombre
        cargo.delete()
        record_change(Seccion.PERSONAS, f"Cargo docente {nombre}", "Existente", "Eliminado", request_user(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Padron / VinculoFamiliar"], request=TipoRelacionFamiliarSerializer, responses=TipoRelacionFamiliarSerializer)
@api_view(["GET", "POST"])
def tipo_relacion_familiar_list_create(request):
    if request.method == "GET":
        relaciones = TipoRelacionFamiliar.objects.annotate(
            is_otro=django_models.Case(
                django_models.When(nombre__iexact="Otro", then=django_models.Value(1)),
                default=django_models.Value(0),
                output_field=django_models.IntegerField(),
            )
        ).order_by("is_otro", "nombre")
        return Response(TipoRelacionFamiliarSerializer(relaciones, many=True).data)

    serializer = TipoRelacionFamiliarSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    relacion = serializer.save()
    record_change(Seccion.PERSONAS, f"Vínculo familiar {relacion.nombre}", "", "Alta", request_user(request))
    return Response(TipoRelacionFamiliarSerializer(relacion).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Padron / VinculoFamiliar"], request=TipoRelacionFamiliarSerializer, responses=TipoRelacionFamiliarSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def tipo_relacion_familiar_detail(request, pk):
    relacion = get_object_or_404(TipoRelacionFamiliar, pk=pk)

    if request.method == "GET":
        return Response(TipoRelacionFamiliarSerializer(relacion).data)

    if relacion.nombre.strip().lower() == "otro":
        return Response(
            {"detail": "La relación 'Otro' es un valor fijo del sistema y no se puede modificar ni eliminar."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if request.method in ["PUT", "PATCH"]:
        old_name = relacion.nombre
        serializer = TipoRelacionFamiliarSerializer(relacion, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        relacion = serializer.save()
        if old_name != relacion.nombre:
            VinculoFamiliar.objects.filter(relacion__iexact=old_name).update(relacion=relacion.nombre)
            record_change(Seccion.PERSONAS, f"Vínculo familiar {old_name}", old_name, relacion.nombre, request_user(request))
        return Response(TipoRelacionFamiliarSerializer(relacion).data)

    if request.method == "DELETE":
        if VinculoFamiliar.objects.filter(relacion__iexact=relacion.nombre).exists():
            return Response(
                {"detail": "No se puede eliminar la relación porque está en uso por vínculos familiares."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nombre = relacion.nombre
        relacion.delete()
        record_change(Seccion.PERSONAS, f"Vínculo familiar {nombre}", "Existente", "Eliminado", request_user(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


def obra_social_sort_key(nombre):
    norm = (nombre or "").strip().lower()
    if norm == "sin obra social":
        return (0, "")
    return (1, norm)


@extend_schema(tags=["Padron / Jugador"], request=ObraSocialSerializer, responses=ObraSocialSerializer)
@api_view(["GET", "POST"])
def obra_social_list_create(request):
    if request.method == "GET":
        obras = sorted(ObraSocial.objects.all(), key=lambda o: obra_social_sort_key(o.nombre))
        return Response(ObraSocialSerializer(obras, many=True).data)

    serializer = ObraSocialSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    obra = serializer.save()
    record_change(Seccion.PERSONAS, f"Obra social {obra.nombre}", "", "Alta", request_user(request))
    return Response(ObraSocialSerializer(obra).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Padron / Jugador"], request=ObraSocialSerializer, responses=ObraSocialSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def obra_social_detail(request, pk):
    obra = get_object_or_404(ObraSocial, pk=pk)

    if request.method == "GET":
        return Response(ObraSocialSerializer(obra).data)

    if obra.nombre.strip().lower() == "sin obra social":
        return Response(
            {"detail": "La opción 'Sin obra social' es un valor fijo del sistema y no se puede modificar ni eliminar."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if request.method in ["PUT", "PATCH"]:
        old_name = obra.nombre
        serializer = ObraSocialSerializer(obra, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        obra = serializer.save()
        if old_name != obra.nombre:
            Jugador.objects.filter(obra_social__iexact=old_name).update(obra_social=obra.nombre)
            record_change(Seccion.PERSONAS, f"Obra social {old_name}", old_name, obra.nombre, request_user(request))
        return Response(ObraSocialSerializer(obra).data)

    if request.method == "DELETE":
        if Jugador.objects.filter(obra_social__iexact=obra.nombre).exists():
            return Response(
                {"detail": "No se puede eliminar la obra social porque está asignada a jugadores."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nombre = obra.nombre
        obra.delete()
        record_change(Seccion.PERSONAS, f"Obra social {nombre}", "Existente", "Eliminado", request_user(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Padron / Jugador"], request=TalleIndumentariaSerializer, responses=TalleIndumentariaSerializer)
@api_view(["GET", "POST"])
def talle_indumentaria_list_create(request):
    if request.method == "GET":
        talles = sorted(TalleIndumentaria.objects.all(), key=lambda t: talle_sort_key(t.nombre))
        return Response(TalleIndumentariaSerializer(talles, many=True).data)

    serializer = TalleIndumentariaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    talle = serializer.save()
    record_change(Seccion.PERSONAS, f"Talle {talle.nombre}", "", "Alta", request_user(request))
    return Response(TalleIndumentariaSerializer(talle).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Padron / Jugador"], request=TalleIndumentariaSerializer, responses=TalleIndumentariaSerializer)
@api_view(["GET", "PUT", "PATCH", "DELETE"])
def talle_indumentaria_detail(request, pk):
    talle = get_object_or_404(TalleIndumentaria, pk=pk)

    if request.method == "GET":
        return Response(TalleIndumentariaSerializer(talle).data)

    if request.method in ["PUT", "PATCH"]:
        old_name = talle.nombre
        old_desc = talle.descripcion
        serializer = TalleIndumentariaSerializer(talle, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        talle = serializer.save()
        if old_name != talle.nombre:
            Jugador.objects.filter(tallaIndumentaria__iexact=old_name).update(tallaIndumentaria=talle.nombre)
        before_str = f"{old_name}" + (f" ({old_desc})" if old_desc else "")
        after_str = f"{talle.nombre}" + (f" ({talle.descripcion})" if talle.descripcion else "")
        if before_str != after_str:
            record_change(Seccion.PERSONAS, f"Talle {old_name}", before_str, after_str, request_user(request))
        return Response(TalleIndumentariaSerializer(talle).data)

    if request.method == "DELETE":
        if Jugador.objects.filter(tallaIndumentaria__iexact=talle.nombre).exists():
            return Response(
                {"detail": "No se puede eliminar el talle porque está asignado a jugadores."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nombre = talle.nombre
        talle.delete()
        record_change(Seccion.PERSONAS, f"Talle {nombre}", "Existente", "Eliminado", request_user(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


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
