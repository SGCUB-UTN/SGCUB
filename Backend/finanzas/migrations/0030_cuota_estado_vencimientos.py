from django.db import migrations, models
from django.utils import timezone

OVERDUE = "Vencida"
FIRST_DUE_OVERDUE = "Vencida1"
SECOND_DUE_OVERDUE = "Vencida2"


def split_overdue_states(apps, schema_editor):
    Cuota = apps.get_model("finanzas", "Cuota")
    today = timezone.localdate()
    overdue = Cuota.objects.filter(estado_cuota=OVERDUE)
    overdue.filter(fecha_venc2__lt=today).update(estado_cuota=SECOND_DUE_OVERDUE)
    overdue.update(estado_cuota=FIRST_DUE_OVERDUE)


def merge_overdue_states(apps, schema_editor):
    Cuota = apps.get_model("finanzas", "Cuota")
    Cuota.objects.filter(estado_cuota__in=[FIRST_DUE_OVERDUE, SECOND_DUE_OVERDUE]).update(estado_cuota=OVERDUE)


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0029_beca_concepto_optional"),
    ]

    operations = [
        migrations.AlterField(
            model_name="cuota",
            name="estado_cuota",
            field=models.CharField(
                choices=[
                    ("EnFecha", "En Fecha"),
                    ("Vencida1", "Vencida (1° venc.)"),
                    ("Vencida2", "Vencida (2° venc.)"),
                    ("Paga", "Paga"),
                ],
                default="EnFecha",
                max_length=40,
            ),
        ),
        migrations.RunPython(split_overdue_states, merge_overdue_states),
    ]
