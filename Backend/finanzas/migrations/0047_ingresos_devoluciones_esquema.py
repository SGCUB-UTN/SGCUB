import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """New structures for incomes, refunds and payment reversal. The old fields are removed in 0049,
    once 0048 moved their data."""

    dependencies = [
        ("finanzas", "0046_registro_auditoria"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Devolucion",
            fields=[
                ("devolucion_id", models.AutoField(primary_key=True, serialize=False)),
                ("tipo", models.CharField(choices=[("Manual", "Devolución manual"), ("NotaCredito", "Nota de crédito")], max_length=20)),
                ("numero", models.PositiveIntegerField()),
                ("concepto", models.CharField(max_length=200)),
                ("monto", models.DecimalField(decimal_places=2, max_digits=10)),
                ("medio_de_pago", models.CharField(max_length=40)),
                ("fecha", models.DateTimeField(default=django.utils.timezone.now)),
                ("responsable", models.CharField(max_length=120)),
                (
                    "comprobante_anulado",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="notas_credito", to="finanzas.comprobante"),
                ),
                (
                    "cuenta_corriente",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="devoluciones", to="finanzas.cuentacorriente"),
                ),
                (
                    "usuario",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="devoluciones_registradas", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "db_table": "devolucion",
                "ordering": ["-fecha", "-devolucion_id"],
                "constraints": [
                    models.UniqueConstraint(fields=("tipo", "numero"), name="devolucion_numero_unico_por_tipo"),
                    models.CheckConstraint(
                        condition=models.Q(
                            models.Q(("comprobante_anulado__isnull", False), ("tipo", "NotaCredito")),
                            models.Q(("comprobante_anulado__isnull", True), ("tipo", "Manual")),
                            _connector="OR",
                        ),
                        name="devolucion_nota_credito_con_comprobante",
                    ),
                    models.CheckConstraint(condition=models.Q(("monto__gt", 0)), name="devolucion_monto_positivo"),
                ],
            },
        ),
        migrations.AddField(
            model_name="pago",
            name="fecha_anulacion",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pago",
            name="responsable_anulacion",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="pago",
            name="usuario_anulacion",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="pagos_anulados", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="secuenciacomprobante",
            name="tipo",
            field=models.CharField(
                choices=[("Recibo", "Recibo"), ("NotaCredito", "Nota de crédito"), ("DevolucionManual", "Devolución manual")],
                default="Recibo",
                max_length=20,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="movimientocuenta",
            name="movimiento_cuenta_single_origin",
        ),
        migrations.AlterField(
            model_name="movimientocuenta",
            name="tipo_movimiento",
            field=models.CharField(choices=[("Cargo", "Cargo"), ("Abono", "Abono"), ("Ingreso", "Ingreso")], default="Abono", max_length=40),
        ),
        migrations.AlterField(
            model_name="conceptomovimiento",
            name="origen",
            field=models.CharField(
                choices=[
                    ("Ingreso", "Ingreso"),
                    ("DevolucionManual", "Devolución manual"),
                    ("IngresoManual", "Ingreso manual"),
                    ("Egreso", "Egreso"),
                    ("NotaCredito", "Nota de crédito"),
                ],
                max_length=40,
            ),
        ),
    ]
