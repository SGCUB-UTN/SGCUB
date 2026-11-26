from django.db import migrations, models


def fill_abbreviations(apps, schema_editor):
    Liga = apps.get_model("padron", "Liga")
    used = set()
    for league in Liga.objects.order_by("pk"):
        base = "".join(word[0] for word in league.nombre.split()).upper()[:10] or f"L{league.pk}"
        abbreviation, suffix = base, 2
        while abbreviation in used:
            abbreviation = f"{base[:10 - len(str(suffix))]}{suffix}"
            suffix += 1
        used.add(abbreviation)
        league.abreviatura = abbreviation
        league.save(update_fields=["abreviatura"])


class Migration(migrations.Migration):

    dependencies = [
        ("padron", "0045_ligas"),
    ]

    operations = [
        migrations.AddField(
            model_name="liga",
            name="abreviatura",
            field=models.CharField(max_length=10, null=True),
        ),
        migrations.RunPython(fill_abbreviations, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="liga",
            name="abreviatura",
            field=models.CharField(max_length=10, unique=True),
        ),
    ]
