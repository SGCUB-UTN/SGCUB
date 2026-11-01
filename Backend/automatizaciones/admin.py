from django.contrib import admin
from django_q.admin import ScheduleAdmin
from django_q.models import Schedule


class ReadOnlyScheduleAdmin(ScheduleAdmin):
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]


admin.site.unregister(Schedule)
admin.site.register(Schedule, ReadOnlyScheduleAdmin)
