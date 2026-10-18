from django.db import migrations

def crear_schedules(apps, schema_editor):
    Schedule = apps.get_model('django_q', 'Schedule')

    # Solo necesitamos una tarea, ya que 'pasr_de_anio_vigente_a_categoria' ahora llama a recategorizar.
    schedules = [
        {
            'name': 'tarea_pasar_anio_vigente',
            'func': 'padron.services.pasr_de_anio_vigente_a_categoria',
            'schedule_type': 'C',  # Cron
            'cron': '0 0 1 1 *',   # A las 00:00 el 1 de Enero de cada año
            'repeats': -1,
        },
    ]

    for data in schedules:
        Schedule.objects.update_or_create(
            name=data['name'],
            defaults={
                'func': data['func'],
                'schedule_type': data['schedule_type'],
                'cron': data.get('cron', ''),
                'repeats': data['repeats'],
            },
        )
        
    # Eliminar la tarea vieja si existiera para que no corra doble
    Schedule.objects.filter(name='tarea_recategorizar_jugadores').delete()


def eliminar_schedules(apps, schema_editor):
    Schedule = apps.get_model('django_q', 'Schedule')
    Schedule.objects.filter(
        name__in=['tarea_recategorizar_jugadores', 'tarea_pasar_anio_vigente']
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('padron', '0016_remove_categoria_edad_minima'),
        ('django_q', '0019_alter_task_options_alter_ormq_key_alter_ormq_lock_and_more'),
    ]

    operations = [
        migrations.RunPython(crear_schedules, eliminar_schedules),
    ]
