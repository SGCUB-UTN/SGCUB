import django.db.models.deletion
from django.db import migrations, models

OLD_NAME = "Pauta de Convivencia"
NAME = "Pautas de Convivencia"

BODY = """Al formar parte del club, cada jugador se compromete a respetar las siguientes pautas:

1. Respetar a compañeros, entrenadores, rivales, árbitros y personal del club.
2. Asistir puntualmente a los entrenamientos y partidos, y avisar con anticipación cuando no pueda concurrir.
3. Cuidar las instalaciones, el material deportivo y la indumentaria del club.
4. No consumir alcohol, tabaco ni sustancias prohibidas en el club ni durante las actividades deportivas.
5. Mantener una conducta acorde a los valores del club dentro y fuera de la cancha.

El incumplimiento de estas pautas podrá dar lugar a **sanciones** que determine la comisión directiva."""

LEGEND = (
    "Declaro haber recibido y leído las Pautas de Convivencia del club, "
    "y presto conformidad con su contenido."
)


def seed_template(apps, schema_editor):
    TipoDocumento = apps.get_model("documental", "TipoDocumento")
    PlantillaDocumento = apps.get_model("documental", "PlantillaDocumento")
    Documento = apps.get_model("documental", "Documento")

    tipo = TipoDocumento.objects.filter(nombre=OLD_NAME).first() or TipoDocumento.objects.filter(nombre=NAME).first()
    if tipo is None:
        tipo = TipoDocumento.objects.create(nombre=NAME)
    tipo.nombre = NAME
    tipo.aplica_jugador = True
    tipo.aplica_socio = False
    tipo.aplica_docente = False
    tipo.save()

    for documento in Documento.objects.filter(tipo_documento=tipo):
        documento.nombre = documento.nombre.replace(f" - {OLD_NAME} - ", f" - {NAME} - ")
        documento.save(update_fields=["nombre"])

    PlantillaDocumento.objects.get_or_create(
        tipo_documento=tipo,
        defaults={"titulo": NAME, "cuerpo": BODY, "talon_leyenda": LEGEND},
    )


class Migration(migrations.Migration):

    dependencies = [
        ("documental", "0007_tipo_documento_configuracion"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlantillaDocumento",
            fields=[
                ("id_plantilla_documento", models.AutoField(primary_key=True, serialize=False)),
                ("titulo", models.CharField(max_length=120)),
                ("cuerpo", models.TextField(blank=True)),
                ("talon_leyenda", models.TextField(max_length=500)),
                ("firma_jugador_menor", models.BooleanField(default=True)),
                (
                    "tipo_documento",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="plantilla",
                        to="documental.tipodocumento",
                    ),
                ),
            ],
            options={"db_table": "plantilla_documento"},
        ),
        migrations.RunPython(seed_template, migrations.RunPython.noop),
    ]
