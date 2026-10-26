from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("finanzas", "0035_tarea_finalizacion_becas"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="movimientocuenta",
            name="movimiento_cuenta_single_origin",
        ),
        migrations.AddField(
            model_name="movimientocuenta",
            name="medio_de_pago",
            field=models.CharField(blank=True, choices=[("Efectivo", "Efectivo"), ("Transferencia", "Transferencia"), ("BilleteraVirtual", "Billetera Virtual")], max_length=40, null=True),
        ),
        migrations.AddField(
            model_name="movimientocuenta",
            name="origen_manual",
            field=models.CharField(blank=True, choices=[("IngresoManual", "Ingreso manual"), ("Egreso", "Egreso"), ("NotaCredito", "Nota de crédito")], max_length=40, null=True),
        ),
        migrations.AddField(
            model_name="movimientocuenta",
            name="usuario",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="movimientos_financieros", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddConstraint(
            model_name="movimientocuenta",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(cuota__isnull=False, pago__isnull=True, movimiento_revertido__isnull=True)
                    | models.Q(cuota__isnull=True, pago__isnull=False, movimiento_revertido__isnull=True)
                    | models.Q(cuota__isnull=True, pago__isnull=True, movimiento_revertido__isnull=False)
                    | models.Q(cuota__isnull=True, pago__isnull=True, movimiento_revertido__isnull=True)
                ),
                name="movimiento_cuenta_single_origin",
            ),
        ),
    ]
