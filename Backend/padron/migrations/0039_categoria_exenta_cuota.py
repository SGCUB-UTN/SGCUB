from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("padron", "0038_seed_personas_catalog"),
    ]

    operations = [
        migrations.AddField(
            model_name="categoria",
            name="exenta_cuota",
            field=models.BooleanField(default=False),
        ),
    ]
