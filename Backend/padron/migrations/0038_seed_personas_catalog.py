from django.db import migrations

RELATIONS = ['Madre', 'Padre', 'Tutor', 'Abuelo/a', 'Hermano/a', 'Pareja', 'Otro']

OBRAS_SOCIALES = [
    'Sin obra social',
    'IOMA',
    'PAMI',
    'OSDE',
    'Swiss Medical',
    'Galeno',
    'Medifé',
    'Sancor Salud',
    'Omint',
    'OSECAC',
    'OSPE',
]

TALLES = [
    ('XS', 'Extra chica'),
    ('S', 'Chica'),
    ('M', 'Mediana'),
    ('L', 'Grande'),
    ('XL', 'Extra grande'),
    ('XXL', 'Doble extra grande'),
]


def seed_catalogs(apps, schema_editor):
    TipoRelacionFamiliar = apps.get_model('padron', 'TipoRelacionFamiliar')
    ObraSocial = apps.get_model('padron', 'ObraSocial')
    TalleIndumentaria = apps.get_model('padron', 'TalleIndumentaria')
    VinculoFamiliar = apps.get_model('padron', 'VinculoFamiliar')
    Jugador = apps.get_model('padron', 'Jugador')

    for nombre in RELATIONS:
        TipoRelacionFamiliar.objects.get_or_create(nombre=nombre)

    # Any existing distinct relacion in VinculoFamiliar
    for val in VinculoFamiliar.objects.exclude(relacion='').values_list('relacion', flat=True).distinct():
        if val:
            TipoRelacionFamiliar.objects.get_or_create(nombre=val)

    for nombre in OBRAS_SOCIALES:
        ObraSocial.objects.get_or_create(nombre=nombre)

    # Any existing distinct obra_social in Jugador
    for val in Jugador.objects.exclude(obra_social='').values_list('obra_social', flat=True).distinct():
        if val:
            ObraSocial.objects.get_or_create(nombre=val)

    for nombre, desc in TALLES:
        TalleIndumentaria.objects.get_or_create(nombre=nombre, defaults={'descripcion': desc})

    for val in Jugador.objects.exclude(tallaIndumentaria='').values_list('tallaIndumentaria', flat=True).distinct():
        if val:
            TalleIndumentaria.objects.get_or_create(nombre=val.upper())


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('padron', '0037_obrasocial_talleindumentaria_tiporelacionfamiliar_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_catalogs, reverse_seed),
    ]

