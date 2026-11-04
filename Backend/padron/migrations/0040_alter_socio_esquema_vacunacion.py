from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("padron", "0039_socio_esquema_vacunacion"),
    ]

    operations = [
        migrations.AlterField(
            model_name="socio",
            name="esquema_vacunacion",
            field=models.BooleanField(blank=True, default=None, null=True),
        ),
    ]
