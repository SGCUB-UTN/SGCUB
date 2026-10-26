from decimal import Decimal

from django.db import migrations, models


def copy_registration_fee(apps, schema_editor):
    # The registration fee moves from the general configuration to the versioned one
    ConfiguracionGeneral = apps.get_model("configuracion", "ConfiguracionGeneral")
    ConfiguracionFinanciera = apps.get_model("finanzas", "ConfiguracionFinanciera")
    general = ConfiguracionGeneral.objects.order_by("pk").first()
    if general is not None:
        ConfiguracionFinanciera.objects.update(monto_inscripcion=general.monto_inscripcion)


def restore_registration_fee(apps, schema_editor):
    ConfiguracionGeneral = apps.get_model("configuracion", "ConfiguracionGeneral")
    ConfiguracionFinanciera = apps.get_model("finanzas", "ConfiguracionFinanciera")
    latest = ConfiguracionFinanciera.objects.order_by("-periodo_vigencia", "-pk").first()
    if latest is not None:
        ConfiguracionGeneral.objects.update(monto_inscripcion=latest.monto_inscripcion)


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0040_medio_pago"),
        ("configuracion", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracionfinanciera",
            name="monto_inscripcion",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10),
        ),
        migrations.AddField(
            model_name="configuracionfinanciera",
            name="responsable",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.RunPython(copy_registration_fee, restore_registration_fee),
    ]
