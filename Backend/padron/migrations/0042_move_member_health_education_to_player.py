from django.db import migrations, models


EDUCATION_CHOICES = [
    ("primario_en_proceso", "Primario en proceso"),
    ("primario_incompleto", "Primario incompleto"),
    ("primario_completo", "Primario completo"),
    ("secundario_en_proceso", "Secundario en proceso"),
    ("secundario_incompleto", "Secundario incompleto"),
    ("secundario_completo", "Secundario completo"),
    ("universitario_en_proceso", "Universitario en proceso"),
    ("universitario_incompleto", "Universitario incompleto"),
    ("universitario_completo", "Universitario completo"),
]


def move_member_data_to_player(apps, schema_editor):
    Socio = apps.get_model("padron", "Socio")
    Jugador = apps.get_model("padron", "Jugador")
    database = schema_editor.connection.alias

    for socio in Socio.objects.using(database).filter(jugador__isnull=False).iterator():
        Jugador.objects.using(database).filter(socio_id=socio.pk).update(
            esquema_vacunacion=socio.esquema_vacunacion,
            nivel_educacion=socio.nivel_educacion,
        )


def move_player_data_to_member(apps, schema_editor):
    Socio = apps.get_model("padron", "Socio")
    Jugador = apps.get_model("padron", "Jugador")
    database = schema_editor.connection.alias

    for jugador in Jugador.objects.using(database).iterator():
        Socio.objects.using(database).filter(pk=jugador.socio_id).update(
            esquema_vacunacion=jugador.esquema_vacunacion,
            nivel_educacion=jugador.nivel_educacion,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("padron", "0041_socio_nivel_educacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="jugador",
            name="esquema_vacunacion",
            field=models.BooleanField(blank=True, default=None, null=True),
        ),
        migrations.AddField(
            model_name="jugador",
            name="nivel_educacion",
            field=models.CharField(
                blank=True,
                choices=EDUCATION_CHOICES,
                default=None,
                max_length=32,
                null=True,
            ),
        ),
        migrations.RunPython(move_member_data_to_player, move_player_data_to_member),
        migrations.RemoveField(
            model_name="socio",
            name="esquema_vacunacion",
        ),
        migrations.RemoveField(
            model_name="socio",
            name="nivel_educacion",
        ),
    ]
