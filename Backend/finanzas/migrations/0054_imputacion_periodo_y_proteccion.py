import django.db.models.deletion
from django.db import migrations, models


def backfill_imputacion_periodo(apps, schema_editor):
    Imputacion = apps.get_model("finanzas", "Imputacion")
    for imputation in Imputacion.objects.select_related("movimiento_destino__cuota").iterator():
        cuota = getattr(imputation.movimiento_destino, "cuota", None) if imputation.movimiento_destino_id else None
        if cuota is not None:
            imputation.periodo = cuota.periodo
            imputation.save(update_fields=["periodo"])


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0053_devolucion_cancelacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="imputacion",
            name="periodo",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AlterField(
            model_name="imputacion",
            name="movimiento_destino",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="imputaciones_destino",
                to="finanzas.movimientocuenta",
            ),
        ),
        migrations.RunPython(backfill_imputacion_periodo, migrations.RunPython.noop),
    ]
