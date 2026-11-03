from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("padron", "0040_alter_socio_esquema_vacunacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="socio",
            name="nivel_educacion",
            field=models.CharField(
                blank=True,
                choices=[
                    ("primario_en_proceso", "Primario en proceso"),
                    ("primario_incompleto", "Primario incompleto"),
                    ("primario_completo", "Primario completo"),
                    ("secundario_en_proceso", "Secundario en proceso"),
                    ("secundario_incompleto", "Secundario incompleto"),
                    ("secundario_completo", "Secundario completo"),
                    ("universitario_en_proceso", "Universitario en proceso"),
                    ("universitario_incompleto", "Universitario incompleto"),
                    ("universitario_completo", "Universitario completo"),
                ],
                default=None,
                max_length=32,
                null=True,
            ),
        ),
    ]
