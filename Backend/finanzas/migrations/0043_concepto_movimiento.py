from django.db import migrations, models

INITIAL_CONCEPTS = (
    ("IngresoManual", "Venta de indumentaria"),
    ("IngresoManual", "Donación"),
    ("IngresoManual", "Otro ingreso"),
    ("Egreso", "Devolución por transferencia duplicada"),
    ("Egreso", "Devolución por error en monto transferido"),
    ("Egreso", "Reintegro de gastos"),
    ("Egreso", "Compra de insumos / Materiales"),
    ("Egreso", "Otro egreso"),
)


def seed_concepts(apps, schema_editor):
    ConceptoMovimiento = apps.get_model("finanzas", "ConceptoMovimiento")
    for origin, name in INITIAL_CONCEPTS:
        ConceptoMovimiento.objects.get_or_create(origen=origin, nombre=name)


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0042_merge_configuracion_y_movimientos"),
    ]

    operations = [
        migrations.CreateModel(
            name="ConceptoMovimiento",
            fields=[
                ("concepto_movimiento_id", models.AutoField(primary_key=True, serialize=False)),
                ("nombre", models.CharField(max_length=100)),
                (
                    "origen",
                    models.CharField(
                        choices=[("IngresoManual", "Ingreso manual"), ("Egreso", "Egreso"), ("NotaCredito", "Nota de crédito")],
                        max_length=40,
                    ),
                ),
            ],
            options={
                "db_table": "concepto_movimiento",
                "ordering": ["concepto_movimiento_id"],
                "constraints": [
                    models.UniqueConstraint(fields=("nombre", "origen"), name="concepto_movimiento_unico_por_origen"),
                ],
            },
        ),
        migrations.RunPython(seed_concepts, migrations.RunPython.noop),
    ]
