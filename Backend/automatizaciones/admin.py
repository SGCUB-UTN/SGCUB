from django.contrib import admin
from django_q.admin import ScheduleAdmin
from django_q.models import Schedule


admin.site.unregister(Schedule)
admin.site.register(Schedule)
