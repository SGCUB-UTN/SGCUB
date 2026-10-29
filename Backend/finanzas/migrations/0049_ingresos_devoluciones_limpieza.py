from django.db import migrations, models


class Migration(migrations.Migration):
    """Drops what incomes, refunds and reversals replaced: the account balance, the manual movement
    fields and the link between a corrected receipt and its replacement."""

    dependencies = [
        ("finanzas", "0048_ingresos_devoluciones_datos"),
    ]

    operations = [
        migrations.RemoveField(model_name="comprobante", name="reemplazado_por"),
        migrations.RemoveField(model_name="cuentacorriente", name="saldo"),
        migrations.RemoveField(model_name="movimientocuenta", name="medio_de_pago"),
        migrations.RemoveField(model_name="movimientocuenta", name="movimiento_revertido"),
        migrations.RemoveField(model_name="movimientocuenta", name="numero_comprobante"),
        migrations.RemoveField(model_name="movimientocuenta", name="origen_manual"),
        migrations.AlterField(
            model_name="conceptomovimiento",
            name="origen",
            field=models.CharField(choices=[("Ingreso", "Ingreso"), ("DevolucionManual", "Devolución manual")], max_length=40),
        ),
        migrations.AlterField(
            model_name="secuenciacomprobante",
            name="tipo",
            field=models.CharField(
                choices=[("Recibo", "Recibo"), ("NotaCredito", "Nota de crédito"), ("DevolucionManual", "Devolución manual")],
                default="Recibo",
                max_length=20,
                unique=True,
            ),
        ),
        migrations.AddConstraint(
            model_name="movimientocuenta",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(("cuota__isnull", False), ("pago__isnull", True), ("tipo_movimiento", "Cargo")),
                    models.Q(("cuota__isnull", True), ("pago__isnull", False), ("tipo_movimiento__in", ("Abono", "Ingreso"))),
                    _connector="OR",
                ),
                name="movimiento_cuenta_single_origin",
            ),
        ),
    ]
