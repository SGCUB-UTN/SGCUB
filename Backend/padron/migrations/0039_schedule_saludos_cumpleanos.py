from datetime import timedelta
from django.db import migrations
from django.utils import timezone

SCHEDULE_NAME = "Padrón - Saludos de cumpleaños"


def next_daily_run(now):
    candidate = now.replace(hour=9, minute=0, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def create_schedules(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    now = timezone.localtime()
    Schedule.objects.update_or_create(
        name=SCHEDULE_NAME,
        defaults={
            "func": "padron.tasks.send_scheduled_birthday_greetings",
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
        ("padron", "0038_seed_personas_catalog"),
        ("django_q", "0019_alter_task_options_alter_ormq_key_alter_ormq_lock_and_more"),
    ]

    operations = [
        migrations.RunPython(create_schedules, delete_schedules),
    ]

