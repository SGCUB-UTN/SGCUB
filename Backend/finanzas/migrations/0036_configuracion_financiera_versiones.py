import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0035_tarea_finalizacion_becas"),
    ]

    operations = [
        migrations.RenameField(
            model_name="configuracionfinanciera",
            old_name="fecha_actualizacion",
            new_name="fecha_creacion",
        ),
        migrations.AlterField(
            model_name="configuracionfinanciera",
            name="fecha_creacion",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.RenameField(
            model_name="configuracionfinanciera",
            old_name="usuario_actualizacion",
            new_name="usuario_creacion",
        ),
        # The existing single record becomes the initial version, in force since always
        migrations.AddField(
            model_name="configuracionfinanciera",
            name="periodo_vigencia",
            field=models.CharField(default="2000-01", max_length=7),
        ),
        migrations.AlterModelOptions(
            name="configuracionfinanciera",
            options={"ordering": ["-periodo_vigencia", "-pk"]},
        ),
    ]
