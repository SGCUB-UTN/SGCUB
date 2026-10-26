import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configuracion", "0001_initial"),
        ("finanzas", "0041_configuracion_inscripcion_y_responsable"),
        ("padron", "0035_categoria_tipo_solo_juvenil_y_mayor"),
    ]

    operations = [
        migrations.RemoveField(model_name="configuraciongeneral", name="monto_inscripcion"),
        migrations.RemoveField(model_name="configuraciongeneral", name="club_direccion"),
        migrations.AddField(
            model_name="configuraciongeneral",
            name="club_logo",
            field=models.FileField(
                blank=True,
                upload_to="configuracion/logo/",
                validators=[django.core.validators.FileExtensionValidator(["png", "jpg", "jpeg", "webp", "svg"])],
            ),
        ),
        migrations.AddField(
            model_name="configuraciongeneral",
            name="club_domicilio",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="padron.domicilio",
            ),
        ),
        migrations.AddField(
            model_name="historialconfiguracion",
            name="responsable",
            field=models.CharField(blank=True, max_length=120),
        ),
    ]
