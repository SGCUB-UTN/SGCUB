from django.db import migrations, models

INITIAL_METHODS = (
    ("Efectivo", "Efectivo"),
    ("Transferencia", "Transferencia"),
    ("BilleteraVirtual", "Billetera Virtual"),
)


def seed_methods(apps, schema_editor):
    MedioPago = apps.get_model("finanzas", "MedioPago")
    for code, name in INITIAL_METHODS:
        MedioPago.objects.get_or_create(codigo=code, defaults={"nombre": name})


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0039_reiniciar_secuencia_configuracion"),
    ]

    operations = [
        migrations.CreateModel(
            name="MedioPago",
            fields=[
                ("medio_pago_id", models.AutoField(primary_key=True, serialize=False)),
                ("codigo", models.CharField(max_length=40, unique=True)),
                ("nombre", models.CharField(max_length=60, unique=True)),
                ("activo", models.BooleanField(default=True)),
            ],
            options={
                "db_table": "medio_pago",
                "ordering": ["nombre"],
            },
        ),
        migrations.AlterField(
            model_name="itempago",
            name="medio_de_pago",
            field=models.CharField(max_length=40),
        ),
        migrations.RunPython(seed_methods, migrations.RunPython.noop),
    ]
