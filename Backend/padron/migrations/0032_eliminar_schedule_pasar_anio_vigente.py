from datetime import datetime
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import migrations

SCHEDULE_NAME = 'tarea_pasar_anio_vigente'
SCHEDULE_FUNC = 'padron.services.pasr_de_anio_vigente_a_categoria'


def delete_schedule(apps, schema_editor):
    Schedule = apps.get_model('django_q', 'Schedule')
    Schedule.objects.filter(func=SCHEDULE_FUNC).delete()


def restore_schedule(apps, schema_editor):
    Schedule = apps.get_model('django_q', 'Schedule')
    tz = ZoneInfo(settings.TIME_ZONE)
    Schedule.objects.update_or_create(
        name=SCHEDULE_NAME,
        defaults={
            'func': SCHEDULE_FUNC,
            'schedule_type': 'C',
            'cron': '0 6 1 1 *',
            'repeats': -1,
            'next_run': datetime(datetime.now(tz).year + 1, 1, 1, 6, 0, tzinfo=tz),
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ('padron', '0031_actualizacion_categorias_ejecucion'),
        ('django_q', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(delete_schedule, restore_schedule),
    ]
