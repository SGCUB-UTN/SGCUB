from datetime import timedelta

from django.db import migrations
from django.utils import timezone

DAILY_SCHOLARSHIP_FINISH = "Finanzas - Finalización de becas"


def next_daily_run(now):
    candidate = now.replace(hour=2, minute=30, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def create_schedule(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    Schedule.objects.update_or_create(
        name=DAILY_SCHOLARSHIP_FINISH,
        defaults={
            "func": "finanzas.services.finish_expired_scholarships",
            "schedule_type": "D",
            "repeats": -1,
            "next_run": next_daily_run(timezone.localtime()),
        },
    )


def delete_schedule(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    Schedule.objects.filter(name=DAILY_SCHOLARSHIP_FINISH).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0034_backfill_beca_items"),
        ("django_q", "0019_alter_task_options_alter_ormq_key_alter_ormq_lock_and_more"),
    ]

    operations = [
        migrations.RunPython(create_schedule, delete_schedule),
    ]
