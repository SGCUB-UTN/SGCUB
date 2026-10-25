from django.core.management.color import no_style
from django.db import migrations


def reset_sequence(apps, schema_editor):
    # The single record used to be created with an explicit pk=1, which does not advance the sequence:
    # without this, the first new version would collide with it.
    ConfiguracionFinanciera = apps.get_model("finanzas", "ConfiguracionFinanciera")
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        for statement in connection.ops.sequence_reset_sql(no_style(), [ConfiguracionFinanciera]):
            cursor.execute(statement)


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0038_configuracion_dia_generacion"),
    ]

    operations = [
        migrations.RunPython(reset_sequence, migrations.RunPython.noop),
    ]
