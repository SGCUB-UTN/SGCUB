from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("documental", "0008_plantilla_documento"),
    ]

    operations = [
        migrations.AddField(
            model_name="plantilladocumento",
            name="mostrar_categoria",
            field=models.BooleanField(default=True),
        ),
    ]
