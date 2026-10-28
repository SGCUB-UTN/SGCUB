from django.db import migrations, models


CONCEPT_CHOICES = [
    ("CuotaSocial", "Cuota Social"),
    ("CuotaDeportiva", "Cuota Deportiva"),
    ("Inscripcion", "Inscripción"),
    ("CondonacionInscripcion", "Condonación de inscripción"),
    ("Mora", "Recargo por mora"),
    ("CondonacionMora", "Condonación de recargo por mora"),
    ("DescuentoUnico", "Descuento único"),
    ("Beca", "Beca"),
    ("Otro", "Otro"),
]


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0046_cuota_inscripcion_jugador"),
    ]

    operations = [
        migrations.AlterField(
            model_name="beca",
            name="concepto",
            field=models.CharField(blank=True, choices=CONCEPT_CHOICES, max_length=40, null=True),
        ),
        migrations.AlterField(
            model_name="detalleimputacion",
            name="concepto",
            field=models.CharField(choices=CONCEPT_CHOICES, max_length=40),
        ),
        migrations.AlterField(
            model_name="itemcuota",
            name="concepto",
            field=models.CharField(choices=CONCEPT_CHOICES, default="CuotaSocial", max_length=40),
        ),
    ]
