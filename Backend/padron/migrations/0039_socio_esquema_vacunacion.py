from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("padron", "0038_seed_personas_catalog"),
    ]

    operations = [
        migrations.AddField(
            model_name="socio",
            name="esquema_vacunacion",
            field=models.BooleanField(default=False),
        ),
    ]
