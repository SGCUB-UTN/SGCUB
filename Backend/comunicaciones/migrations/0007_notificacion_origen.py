from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comunicaciones', '0006_remove_envionotificacion_persona_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='notificacion',
            name='origen',
            field=models.CharField(
                choices=[('MANUAL', 'Manual'), ('AUTOMATICA', 'Automática')],
                default='MANUAL',
                max_length=20,
            ),
        ),
    ]
