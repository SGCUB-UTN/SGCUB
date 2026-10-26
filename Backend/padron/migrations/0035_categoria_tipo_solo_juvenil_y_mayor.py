from django.db import migrations, models


def fourth_division_to_youth(apps, schema_editor):
    Categoria = apps.get_model("padron", "Categoria")
    Categoria.objects.filter(tipo="cuarta").update(tipo="juvenil")


class Migration(migrations.Migration):

    dependencies = [
        ("padron", "0034_recategorizacion_motivos_cuarta_y_edad"),
    ]

    operations = [
        migrations.RunPython(fourth_division_to_youth, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="categoria",
            name="tipo",
            field=models.CharField(
                choices=[("juvenil", "Juvenil"), ("mayor", "Mayor")],
                default="juvenil",
                max_length=10,
            ),
        ),
    ]
