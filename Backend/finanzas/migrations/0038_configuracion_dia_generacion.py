from datetime import timedelta

from django.db import migrations, models
from django.utils import timezone

MONTHLY_GENERATION = "Finanzas - Generación mensual de cuotas"
SCHEDULED_GENERATION = "finanzas.services.generate_scheduled_cuotas"
MONTHLY_FUNCTION = "finanzas.services.generar_cuotas_mensuales"


def next_daily_run(now):
    candidate = now.replace(hour=1, minute=0, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def next_monthly_run(now):
    candidate = now.replace(day=1, hour=1, minute=0, second=0, microsecond=0)
    if candidate <= now:
        candidate = (candidate + timedelta(days=32)).replace(day=1)
    return candidate


def run_generation_daily(apps, schema_editor):
    # The task now runs every day and only generates on the configured day of the month
    Schedule = apps.get_model("django_q", "Schedule")
    Schedule.objects.filter(name=MONTHLY_GENERATION).update(
        func=SCHEDULED_GENERATION,
        schedule_type="D",
        cron=None,
        next_run=next_daily_run(timezone.localtime()),
    )


def run_generation_monthly(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    Schedule.objects.filter(name=MONTHLY_GENERATION).update(
        func=MONTHLY_FUNCTION,
        schedule_type="M",
        next_run=next_monthly_run(timezone.localtime()),
    )


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0037_configuracion_cuotas_actualizadas"),
        ("django_q", "0019_alter_task_options_alter_ormq_key_alter_ormq_lock_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracionfinanciera",
            name="dia_generacion",
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.RunPython(run_generation_daily, run_generation_monthly),
    ]
