from datetime import timedelta
from django.db import migrations
from django.utils import timezone

SCHEDULE_NAME = "Documental - Actualización de estados y alertas"


def next_daily_run(now):
    candidate = now.replace(hour=1, minute=0, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def create_schedules(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    now = timezone.localtime()
    Schedule.objects.update_or_create(
        name=SCHEDULE_NAME,
        defaults={
            "func": "documental.tasks.refresh_document_states",
            "schedule_type": "D",
            "repeats": -1,
            "next_run": next_daily_run(now),
        },
    )


def delete_schedules(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    Schedule.objects.filter(name=SCHEDULE_NAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("documental", "0007_tipo_documento_configuracion"),
        ("django_q", "0019_alter_task_options_alter_ormq_key_alter_ormq_lock_and_more"),
    ]

    operations = [
        migrations.RunPython(create_schedules, delete_schedules),
    ]

