from decimal import Decimal

from django.db import migrations, models

CREDITED = "Acreditado"


def backfill_pending_balance(apps, schema_editor):
    Imputacion = apps.get_model("finanzas", "Imputacion")

    credited = set(
        Imputacion.objects.filter(movimiento_origen__pago__estado_pago=CREDITED).values_list("pk", flat=True)
    )
    applied_by_charge = {}
    imputations = Imputacion.objects.select_related("movimiento_destino").order_by("fecha", "pk")
    for imputation in imputations:
        charge = imputation.movimiento_destino
        applied = applied_by_charge.get(charge.pk, Decimal("0.00")) + imputation.monto_aplicado
        imputation.saldo_pendiente = max(Decimal("0.00"), charge.monto - applied)
        imputation.save(update_fields=["saldo_pendiente"])
        if imputation.pk in credited:
            applied_by_charge[charge.pk] = applied


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0050_item_cuota_fecha_creacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="imputacion",
            name="saldo_pendiente",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.RunPython(backfill_pending_balance, migrations.RunPython.noop),
    ]
