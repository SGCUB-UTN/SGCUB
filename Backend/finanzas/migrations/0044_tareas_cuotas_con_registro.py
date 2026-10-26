from django.db import migrations

MONTHLY_GENERATION = "Finanzas - Generación mensual de cuotas"
DAILY_SURCHARGES = "Finanzas - Recargos por mora"
FUNCTIONS = {
    MONTHLY_GENERATION: ("finanzas.services.generate_scheduled_cuotas", "finanzas.tasks.generate_scheduled_cuotas"),
    DAILY_SURCHARGES: ("finanzas.services.apply_surcharges", "finanzas.tasks.apply_scheduled_surcharges"),
}


def use_logged_tasks(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    for name, (_, logged) in FUNCTIONS.items():
        Schedule.objects.filter(name=name).update(func=logged)


def use_previous_tasks(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    for name, (previous, _) in FUNCTIONS.items():
        Schedule.objects.filter(name=name).update(func=previous)


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0043_ejecucion_tarea_cuota"),
        ("django_q", "0019_alter_task_options_alter_ormq_key_alter_ormq_lock_and_more"),
    ]

    operations = [
        migrations.RunPython(use_logged_tasks, use_previous_tasks),
    ]
