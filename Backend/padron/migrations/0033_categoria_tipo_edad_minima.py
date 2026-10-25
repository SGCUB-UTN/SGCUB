from django.db import migrations, models

MAYOR_PREFIXES = ("1RA", "RESERVA", "3RA", "SENIOR")
CUARTA_PREFIX = "4TA"
SENIOR_MIN_AGE = 35


def classify_existing_categories(apps, schema_editor):
    Categoria = apps.get_model("padron", "Categoria")
    for category in Categoria.objects.all():
        name = category.nombre.strip().upper()
        if name.startswith(MAYOR_PREFIXES):
            category.tipo = "mayor"
        elif name.startswith(CUARTA_PREFIX):
            category.tipo = "cuarta"
        if name.startswith("SENIOR"):
            category.edad_minima = SENIOR_MIN_AGE
        category.save(update_fields=["tipo", "edad_minima"])


class Migration(migrations.Migration):

    dependencies = [
        ("padron", "0032_eliminar_schedule_pasar_anio_vigente"),
    ]

    operations = [
        migrations.AddField(
            model_name="categoria",
            name="edad_minima",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="categoria",
            name="tipo",
            field=models.CharField(
                choices=[("juvenil", "Juvenil"), ("cuarta", "Cuarta división"), ("mayor", "Mayor")],
                default="juvenil",
                max_length=10,
            ),
        ),
        migrations.RunPython(classify_existing_categories, migrations.RunPython.noop),
    ]
