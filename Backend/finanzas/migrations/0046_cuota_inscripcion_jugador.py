from decimal import Decimal

from django.db import migrations, models


def set_default_registration_fee(apps, schema_editor):
    ConfiguracionFinanciera = apps.get_model("finanzas", "ConfiguracionFinanciera")
    ConfiguracionFinanciera.objects.filter(monto_inscripcion=Decimal("0.00")).update(
        monto_inscripcion=Decimal("1000.00"),
    )


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0045_merge_20261027_0106"),
    ]

    operations = [
        migrations.RunPython(set_default_registration_fee, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="beca",
            name="concepto",
            field=models.CharField(
                blank=True,
                choices=[
                    ("CuotaSocial", "Cuota Social"),
                    ("CuotaDeportiva", "Cuota Deportiva"),
                    ("Inscripcion", "Inscripción"),
                    ("Mora", "Recargo por mora"),
                    ("CondonacionMora", "Condonación de recargo por mora"),
                    ("DescuentoUnico", "Descuento único"),
                    ("Beca", "Beca"),
                    ("Otro", "Otro"),
                ],
                max_length=40,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="detalleimputacion",
            name="concepto",
            field=models.CharField(
                choices=[
                    ("CuotaSocial", "Cuota Social"),
                    ("CuotaDeportiva", "Cuota Deportiva"),
                    ("Inscripcion", "Inscripción"),
                    ("Mora", "Recargo por mora"),
                    ("CondonacionMora", "Condonación de recargo por mora"),
                    ("DescuentoUnico", "Descuento único"),
                    ("Beca", "Beca"),
                    ("Otro", "Otro"),
                ],
                max_length=40,
            ),
        ),
        migrations.AlterField(
            model_name="itemcuota",
            name="concepto",
            field=models.CharField(
                choices=[
                    ("CuotaSocial", "Cuota Social"),
                    ("CuotaDeportiva", "Cuota Deportiva"),
                    ("Inscripcion", "Inscripción"),
                    ("Mora", "Recargo por mora"),
                    ("CondonacionMora", "Condonación de recargo por mora"),
                    ("DescuentoUnico", "Descuento único"),
                    ("Beca", "Beca"),
                    ("Otro", "Otro"),
                ],
                default="CuotaSocial",
                max_length=40,
            ),
        ),
        migrations.AlterField(
            model_name="configuracionfinanciera",
            name="monto_inscripcion",
            field=models.DecimalField(decimal_places=2, default=Decimal("1000.00"), max_digits=10),
        ),
    ]
