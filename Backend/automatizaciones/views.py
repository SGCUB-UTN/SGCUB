from django.shortcuts import get_object_or_404
from django_q.models import Schedule
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response


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
    if (
        not isinstance(request.data, dict)
        or set(request.data) != {"is_active"}
        or not isinstance(request.data["is_active"], bool)
    ):
        return Response(
            {"is_active": ["Enviá únicamente un valor booleano para is_active."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    schedule = get_object_or_404(Schedule, pk=pk)
    schedule.repeats = -1 if request.data["is_active"] else 0
    schedule.save(update_fields=["repeats"])
    return Response(_serialize_schedule(schedule))
