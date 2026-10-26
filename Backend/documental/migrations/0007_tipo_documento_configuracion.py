from django.db import migrations, models

# Types the documentation tab used to show only to docentes, or to everyone but docentes
DOCENTE_ONLY = ("Antecedentes Penales", "CV")
EVERYONE = ("DNI",)


def set_profiles(apps, schema_editor):
    TipoDocumento = apps.get_model("documental", "TipoDocumento")
    TipoDocumento.objects.filter(nombre__in=DOCENTE_ONLY).update(aplica_jugador=False, aplica_socio=False)
    TipoDocumento.objects.exclude(nombre__in=DOCENTE_ONLY + EVERYONE).update(aplica_docente=False)


class Migration(migrations.Migration):

    dependencies = [
        ("documental", "0006_regenerate_documento_nombre"),
    ]

    operations = [
        migrations.AddField(model_name="tipodocumento", name="activo", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="tipodocumento", name="obligatorio", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="tipodocumento", name="aplica_jugador", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="tipodocumento", name="aplica_socio", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="tipodocumento", name="aplica_docente", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="tipodocumento", name="requiere_vencimiento", field=models.BooleanField(default=False)),
        migrations.AddField(
            model_name="tipodocumento",
            name="vigencia_meses",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(set_profiles, migrations.RunPython.noop),
    ]
