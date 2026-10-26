from django.db import migrations, models
import django.db.models.deletion


def assign_correlative_numbers(apps, schema_editor):
    MovimientoCuenta = apps.get_model("finanzas", "MovimientoCuenta")
    SecuenciaComprobante = apps.get_model("finanzas", "SecuenciaComprobante")
    manuales = list(
        MovimientoCuenta.objects.filter(
            origen_manual__isnull=False,
            numero_comprobante__isnull=True,
        ).order_by("pk")
    )
    if not manuales:
        return
    sequence, _ = SecuenciaComprobante.objects.get_or_create(pk=1)
    for movement in manuales:
        sequence.ultimo_numero += 1
        movement.numero_comprobante = sequence.ultimo_numero
        movement.save(update_fields=["numero_comprobante"])
    sequence.save(update_fields=["ultimo_numero"])


class Migration(migrations.Migration):
    dependencies = [
        ("finanzas", "0036_movimientos_manuales"),
    ]

    operations = [
        migrations.AddField(
            model_name="movimientocuenta",
            name="numero_comprobante",
            field=models.PositiveIntegerField(blank=True, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name="movimientocuenta",
            name="movimiento_revertido",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="reversiones",
                related_query_name="reversion",
                to="finanzas.movimientocuenta",
            ),
        ),
        migrations.RunPython(assign_correlative_numbers, migrations.RunPython.noop),
    ]

