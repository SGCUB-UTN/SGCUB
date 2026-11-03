import os
from django.core.files import File
from django.db import migrations


def seed_datos_club(apps, schema_editor):
    ConfiguracionGeneral = apps.get_model("configuracion", "ConfiguracionGeneral")
    Domicilio = apps.get_model("padron", "Domicilio")
    Localidad = apps.get_model("padron", "Localidad")

    config = ConfiguracionGeneral.objects.order_by("pk").first()
    if not config:
        config = ConfiguracionGeneral.objects.create()

    if not config.club_nombre:
        config.club_nombre = "Club Universitario de Berisso"

    if not config.club_cuit:
        config.club_cuit = "30-70168909-3"

    if not config.club_telefono:
        config.club_telefono = "+5492216755822"

    localidad_berisso = Localidad.objects.filter(nombre__icontains="Berisso").first() or Localidad.objects.first()

    if not config.club_domicilio:
        if localidad_berisso:
            domicilio = Domicilio.objects.create(
                calle="Calle 126",
                numero="1299",
                localidad=localidad_berisso,
            )
            config.club_domicilio = domicilio
    elif not config.club_domicilio.calle and localidad_berisso:
        dom = config.club_domicilio
        dom.calle = "Calle 126"
        dom.numero = "1299"
        dom.localidad = localidad_berisso
        dom.save()

    if not config.club_logo:
        fixture_path = os.path.join(os.path.dirname(__file__), "..", "fixtures", "escudo-sin-fondo.png")
        if os.path.exists(fixture_path):
            with open(fixture_path, "rb") as f:
                config.club_logo.save("escudo-sin-fondo.png", File(f), save=False)

    config.save()


def unseed_datos_club(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("configuracion", "0003_alter_historialconfiguracion_seccion"),
        ("padron", "0015_seed_demographics"),
    ]

    operations = [
        migrations.RunPython(seed_datos_club, unseed_datos_club),
    ]

