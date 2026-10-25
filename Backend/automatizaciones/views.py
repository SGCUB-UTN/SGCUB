from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.core.paginator import Paginator
from django.db.models import F
from django_q.models import Schedule, Task
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from padron.models import ActualizacionCategoriasEjecucion, RecategorizacionEjecucion, RecategorizacionResultado
from padron.serializers import JugadorSerializer
from padron.services import (
    CATEGORY_UPDATE_TASK,
    CATEGORY_UPDATE_TASK_NAME,
    GENERO_PERSONA_A_CATEGORIA,
    RECATEGORIZATION_TASK,
    RECATEGORIZATION_TASK_NAME,
    CategoriesOutdated,
    RecategorizationDecisionError,
    RecategorizationInProgress,
    accept_all_suggestions,
    can_keep_categories,
    categories_status,
    decide_result,
    mark_stale_runs_as_failed,
    start_recategorization,
    update_categories_year,
)

MANUAL_TASKS = {
    RECATEGORIZATION_TASK: (RECATEGORIZATION_TASK_NAME, RecategorizacionEjecucion),
    CATEGORY_UPDATE_TASK: (CATEGORY_UPDATE_TASK_NAME, ActualizacionCategoriasEjecucion),
}


class CanManageAutomatizaciones(BasePermission):
    permission_by_method = {
        "GET": "django_q.view_schedule",
        "PATCH": "django_q.change_schedule",
    }

    def has_permission(self, request, view):
        permission = self.permission_by_method.get(request.method)
        if permission is None:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.has_perm(permission)
        )


def _serialize_schedule(schedule):
    return {
        "id": schedule.pk,
        "name": schedule.name,
        "func": schedule.func,
        "schedule_type": schedule.schedule_type,
        "minutes": schedule.minutes,
        "cron": schedule.cron,
        "next_run": schedule.next_run,
        "is_active": schedule.repeats != 0,
    }


EDITABLE_SCHEDULE_FIELDS = {"is_active", "schedule_type", "next_run"}
EDITABLE_FREQUENCIES = (Schedule.DAILY, Schedule.WEEKLY, Schedule.MONTHLY, Schedule.QUARTERLY, Schedule.YEARLY)
CHANGE_KEYS_BY_FUNC = {
    "finanzas.services.generar_cuotas_mensuales": ("cuotas_creadas",),
    "finanzas.services.apply_surcharges": ("recargos_primer_vencimiento", "recargos_segundo_vencimiento"),
    "finanzas.services.finish_expired_scholarships": ("becas_finalizadas",),
}


@extend_schema(tags=["Automatizaciones"])
@api_view(["GET"])
@permission_classes([CanManageAutomatizaciones])
def automatizacion_list(request):
    schedules = Schedule.objects.order_by("pk")
    return Response([_serialize_schedule(schedule) for schedule in schedules])


@extend_schema(tags=["Automatizaciones"])
@api_view(["PATCH"])
@permission_classes([CanManageAutomatizaciones])
def automatizacion_detail(request, pk):
    data = request.data if isinstance(request.data, dict) else {}
    if not data or not set(data) <= EDITABLE_SCHEDULE_FIELDS:
        return Response(
            {"detail": "Solo se puede modificar el estado, la frecuencia y la próxima ejecución."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    errors = {}
    if "is_active" in data and not isinstance(data["is_active"], bool):
        errors["is_active"] = ["Enviá un valor booleano para is_active."]
    if "schedule_type" in data and data["schedule_type"] not in EDITABLE_FREQUENCIES:
        errors["schedule_type"] = ["Elegí una frecuencia válida: diaria, semanal, mensual, trimestral o anual."]
    next_run = None
    if "next_run" in data:
        next_run = parse_datetime(data["next_run"]) if isinstance(data["next_run"], str) else None
        if next_run is None:
            errors["next_run"] = ["Ingresá una fecha y hora válidas."]
        else:
            next_run = next_run if timezone.is_aware(next_run) else timezone.make_aware(next_run)
            if next_run <= timezone.now():
                errors["next_run"] = ["La próxima ejecución tiene que ser posterior a este momento."]
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    schedule = get_object_or_404(Schedule, pk=pk)
    if "is_active" in data:
        schedule.repeats = -1 if data["is_active"] else 0
    if "schedule_type" in data:
        schedule.schedule_type = data["schedule_type"]
        schedule.cron = None
    if next_run is not None:
        schedule.next_run = next_run
    schedule.save(update_fields=["repeats", "schedule_type", "cron", "next_run"])
    return Response(_serialize_schedule(schedule))


def _changes_count(task, manual_run):
    """How many records an execution actually modified, read from what each task stores."""
    if not task.success:
        return None
    if task.func == RECATEGORIZATION_TASK:
        return _recategorization_changes(manual_run) if manual_run else None
    if task.func == CATEGORY_UPDATE_TASK:
        return manual_run.categorias_actualizadas if manual_run else None
    result = task.result if isinstance(task.result, dict) else {}
    keys = CHANGE_KEYS_BY_FUNC.get(task.func)
    if not keys or not any(key in result for key in keys):
        return None
    return sum(int(result.get(key) or 0) for key in keys)


def _recategorization_changes(execution):
    rows = execution.resultados.filter(categoria_nueva__isnull=False).values_list(
        "categoria_anterior_id", "categoria_nueva_id", "categoria_secundaria_anterior_id", "categoria_secundaria_nueva_id",
    )
    return sum(1 for main_before, main_after, secondary_before, secondary_after in rows
               if main_before != main_after or secondary_before != secondary_after)


@extend_schema(tags=["Automatizaciones"])
@api_view(["GET"])
@permission_classes([CanManageAutomatizaciones])
def automatizacion_execution_list(request):
    schedules = list(Schedule.objects.order_by("pk").values("name", "func"))
    schedule_names = {func: name for func, (name, _) in MANUAL_TASKS.items()}
    for schedule in schedules:
        schedule_names.setdefault(schedule["func"], schedule["name"] or schedule["func"])

    page_number = request.query_params.get("page", "1")
    if not page_number.isdecimal() or int(page_number) < 1:
        return Response(
            {"page": ["Ingresá un número de página mayor que cero."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    func = request.query_params.get("func")
    if func and func not in schedule_names:
        return Response({"func": ["Elegí una función válida."]}, status=status.HTTP_400_BAD_REQUEST)

    executions = Task.objects.filter(func=func) if func else Task.objects.filter(func__in=schedule_names)
    executions = executions.order_by("-stopped", "-id")
    page = Paginator(executions, 5).get_page(page_number)
    manual_runs = {
        func: model.objects.in_bulk([
            task.args[0] for task in page.object_list if task.func == func and task.args
        ])
        for func, (_, model) in MANUAL_TASKS.items()
    }
    results = []
    for task in page.object_list:
        manual_run = manual_runs[task.func].get(task.args[0]) if task.func in manual_runs and task.args else None
        results.append({
            "id": task.pk,
            "executed_at": task.stopped,
            "automation": schedule_names[task.func],
            "func": task.func,
            "scope": task.func.split(".", 1)[0].replace("_", " ").capitalize(),
            "success": task.success,
            "is_manual": task.func in MANUAL_TASKS,
            "executed_by": manual_run.ejecutado_por if manual_run else None,
            "recategorization_id": manual_run.pk if manual_run and task.func == RECATEGORIZATION_TASK else None,
            "recategorization_year": manual_run.anio if manual_run and task.func == RECATEGORIZATION_TASK else None,
            "changes": _changes_count(task, manual_run),
            "detail": task.result if isinstance(task.result, (dict, str)) else None,
        })
    return Response({
        "functions": [{"func": key, "name": name} for key, name in schedule_names.items()],
        "results": results,
        "count": page.paginator.count,
        "page": page.number,
        "page_size": 5,
        "total_pages": page.paginator.num_pages,
    })


RESULTS_PAGE_SIZE = 20
Tipo = RecategorizacionResultado.TipoChoices
Decision = RecategorizacionResultado.DecisionChoices


class CanManageRecategorizacion(BasePermission):
    permissions_by_method = {
        "GET": ("django_q.view_schedule",),
        "POST": ("django_q.change_schedule", "padron.change_jugador"),
    }

    def has_permission(self, request, view):
        permissions = self.permissions_by_method.get(request.method)
        if permissions is None:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.has_perms(permissions)
        )


def _serialize_category(category):
    if category is None:
        return None
    return {"id": category.pk, "nombre": category.nombre, "edad_maxima": category.edad_maxima}


def _serialize_execution(execution):
    if execution is None:
        return None
    return {
        "id": execution.pk,
        "anio": execution.anio,
        "fecha_inicio": execution.fecha_inicio,
        "fecha_fin": execution.fecha_fin,
        "ejecutado_por": execution.ejecutado_por,
        "estado": execution.estado,
        "exitosos": execution.exitosos,
        "pendientes": execution.pendientes,
        "errores": execution.errores,
        "pendientes_sin_revisar": execution.resultados.filter(tipo=Tipo.PENDIENTE, decision="").count(),
        "errores_sin_revisar": execution.resultados.filter(tipo=Tipo.ERROR, decision="").count(),
    }


def _serialize_result(result):
    player = result.jugador
    person = player.socio.persona
    return {
        "id": result.pk,
        "jugador_id": player.pk,
        "jugador": f"{person.apellido}, {person.nombre}",
        "dni": person.dni,
        "anio_nacimiento": person.fecha_nacimiento.year if person.fecha_nacimiento else None,
        "genero": GENERO_PERSONA_A_CATEGORIA.get(getattr(person.genero, "nombre", None)),
        "tipo": result.tipo,
        "motivo": result.motivo,
        "motivo_display": result.get_motivo_display() if result.motivo else "",
        "detalle": result.detalle,
        "categoria_anterior": _serialize_category(result.categoria_anterior),
        "categoria_secundaria_anterior": _serialize_category(result.categoria_secundaria_anterior),
        "categoria_nueva": _serialize_category(result.categoria_nueva),
        "categoria_secundaria_nueva": _serialize_category(result.categoria_secundaria_nueva),
        "categoria_sugerida": _serialize_category(result.categoria_sugerida),
        "quitar_secundaria_sugerido": result.quitar_secundaria_sugerido,
        "categoria_actual": _serialize_category(player.categoria),
        "categoria_secundaria_actual": _serialize_category(player.categoria_secundaria),
        "puede_mantener": can_keep_categories(player, result.ejecucion.anio),
        "decision": result.decision,
        "decision_display": result.get_decision_display() if result.decision else "",
        "fecha_decision": result.fecha_decision,
    }


def _latest_execution():
    return RecategorizacionEjecucion.objects.order_by("-fecha_inicio", "-ejecucion_id").first()


def _executed_by(request):
    executed_by = request.data.get("ejecutado_por") if isinstance(request.data, dict) else None
    executed_by = executed_by.strip() if isinstance(executed_by, str) else ""
    return executed_by if 0 < len(executed_by) <= 150 else None


@extend_schema(tags=["Automatizaciones / Recategorización"], summary="Estado de la última recategorización")
@api_view(["GET"])
@permission_classes([CanManageRecategorizacion])
def recategorization_status(request):
    mark_stale_runs_as_failed()
    return Response({
        "ultima_ejecucion": _serialize_execution(_latest_execution()),
        "categorias": categories_status(),
    })


@extend_schema(tags=["Automatizaciones / Recategorización"], summary="Ejecutar recategorización de jugadores")
@api_view(["POST"])
@permission_classes([CanManageRecategorizacion])
def recategorization_run(request):
    executed_by = _executed_by(request)
    if not executed_by:
        return Response(
            {"ejecutado_por": ["Indicá quién ejecuta la recategorización (hasta 150 caracteres)."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        execution = start_recategorization(request.user, executed_by)
    except RecategorizationInProgress:
        return Response(
            {"detail": "Ya hay una recategorización en curso o con revisiones pendientes."},
            status=status.HTTP_409_CONFLICT,
        )
    except CategoriesOutdated as error:
        return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)
    return Response({"ultima_ejecucion": _serialize_execution(execution)}, status=status.HTTP_202_ACCEPTED)


@extend_schema(tags=["Automatizaciones / Recategorización"], summary="Resultados de una recategorización")
@api_view(["GET"])
@permission_classes([CanManageRecategorizacion])
def recategorization_results(request, pk):
    execution = get_object_or_404(RecategorizacionEjecucion, pk=pk)
    result_type = request.query_params.get("tipo", Tipo.EXITO)
    direction = request.query_params.get("orden", "asc")
    page_number = request.query_params.get("page", "1")
    if result_type not in Tipo.values:
        return Response(
            {"tipo": [f"Elegí un tipo válido: {', '.join(Tipo.values)}."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if direction not in ("asc", "desc"):
        return Response({"orden": ["Elegí un orden válido: asc o desc."]}, status=status.HTTP_400_BAD_REQUEST)
    if not page_number.isdecimal() or int(page_number) < 1:
        return Response(
            {"page": ["Ingresá un número de página mayor que cero."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    birth_date_field = F("jugador__socio__persona__fecha_nacimiento")
    birth_date = birth_date_field.asc(nulls_last=True) if direction == "asc" else birth_date_field.desc(nulls_last=True)
    ordering = [birth_date, "jugador__socio__persona__apellido", "jugador__socio__persona__nombre", "resultado_id"]
    if result_type == Tipo.PENDIENTE:
        ordering.insert(0, "decision")
    results = (
        execution.resultados
        .filter(tipo=result_type)
        .select_related(
            "jugador__socio__persona__genero",
            "jugador__categoria",
            "jugador__categoria_secundaria",
            "categoria_anterior",
            "categoria_secundaria_anterior",
            "categoria_nueva",
            "categoria_secundaria_nueva",
            "categoria_sugerida",
            "ejecucion",
        )
        .order_by(*ordering)
    )
    page = Paginator(results, RESULTS_PAGE_SIZE).get_page(page_number)
    return Response({
        "results": [_serialize_result(result) for result in page.object_list],
        "count": page.paginator.count,
        "page": page.number,
        "page_size": RESULTS_PAGE_SIZE,
        "total_pages": page.paginator.num_pages,
    })


@extend_schema(tags=["Automatizaciones / Recategorización"], summary="Registro de una recategorización")
@api_view(["GET"])
@permission_classes([CanManageRecategorizacion])
def recategorization_log(request, pk):
    execution = get_object_or_404(RecategorizacionEjecucion, pk=pk)
    return Response({"registro": execution.registro})


@extend_schema(tags=["Automatizaciones / Recategorización"], summary="Revisar un resultado de la recategorización")
@api_view(["POST"])
@permission_classes([CanManageRecategorizacion])
def recategorization_decision(request, pk):
    result = get_object_or_404(RecategorizacionResultado.objects.select_related("jugador"), pk=pk)
    data = request.data if isinstance(request.data, dict) else {}
    decision = data.get("decision")
    if decision not in Decision.values:
        return Response(
            {"decision": [f"Elegí una decisión válida: {', '.join(Decision.values)}."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    categories = {}
    if decision == Decision.EDITADA:
        serializer = JugadorSerializer(
            result.jugador,
            data={
                "categoria": data.get("categoria"),
                "categoria_secundaria": data.get("categoria_secundaria"),
            },
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        categories = {
            "categoria": serializer.validated_data["categoria"],
            "categoria_secundaria": serializer.validated_data.get("categoria_secundaria"),
        }

    try:
        result = decide_result(result.pk, decision, request.user, **categories)
    except RecategorizationDecisionError as error:
        return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
    result = (
        RecategorizacionResultado.objects
        .select_related("jugador__socio__persona__genero", "ejecucion")
        .get(pk=result.pk)
    )
    return Response({
        "resultado": _serialize_result(result),
        "ultima_ejecucion": _serialize_execution(result.ejecucion),
    })


@extend_schema(tags=["Automatizaciones / Recategorización"], summary="Aceptar todas las sugerencias pendientes")
@api_view(["POST"])
@permission_classes([CanManageRecategorizacion])
def recategorization_accept_all(request, pk):
    execution = get_object_or_404(RecategorizacionEjecucion, pk=pk)
    try:
        accepted = accept_all_suggestions(execution.pk, request.user)
    except RecategorizationDecisionError as error:
        return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
    execution.refresh_from_db()
    return Response({"aceptados": accepted, "ultima_ejecucion": _serialize_execution(execution)})


def _serialize_categories_status():
    last_update = ActualizacionCategoriasEjecucion.objects.order_by("-fecha", "-actualizacion_id").first()
    return {
        **categories_status(),
        "ultima_actualizacion": {
            "id": last_update.pk,
            "anio": last_update.anio,
            "fecha": last_update.fecha,
            "ejecutado_por": last_update.ejecutado_por,
            "categorias_actualizadas": last_update.categorias_actualizadas,
        } if last_update else None,
    }


@extend_schema(tags=["Automatizaciones / Categorías"], summary="Estado del año de las categorías")
@api_view(["GET"])
@permission_classes([CanManageRecategorizacion])
def category_update_status(request):
    return Response(_serialize_categories_status())


@extend_schema(tags=["Automatizaciones / Categorías"], summary="Actualizar las categorías al año actual")
@api_view(["POST"])
@permission_classes([CanManageRecategorizacion])
def category_update_run(request):
    executed_by = _executed_by(request)
    if not executed_by:
        return Response(
            {"ejecutado_por": ["Indicá quién actualiza las categorías (hasta 150 caracteres)."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    update_categories_year(request.user, executed_by)
    return Response(_serialize_categories_status())
