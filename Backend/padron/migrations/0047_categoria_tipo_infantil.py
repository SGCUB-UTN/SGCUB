from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("padron", "0046_liga_abreviatura"),
    ]

    operations = [
        migrations.AlterField(
            model_name="categoria",
            name="tipo",
            field=models.CharField(
                choices=[("mayor", "Mayor"), ("juvenil", "Juvenil"), ("infantil", "Infantil")],
                default="juvenil",
                max_length=10,
            ),
        ),
    ]
