from calendar import monthrange
from datetime import datetime

from django.db import migrations
from django.utils import timezone

SCHOLARSHIP_CONCEPT = "Beca"
SURCHARGE_CONCEPT = "Mora"
FINISHED = "Finalizada"
APPLIED = "Aplicada"
SURCHARGE_NUMBERS = (("primer", 1), ("segundo", 2))


def period_bounds(period):
    first_day = datetime.strptime(period, "%Y-%m").date()
    return first_day, first_day.replace(day=monthrange(first_day.year, first_day.month)[1])


def matching_scholarship(scholarships, item, first_day, last_day):
    covering = [
        scholarship for scholarship in scholarships
        if scholarship.fecha_aplicacion <= last_day
        and (scholarship.fecha_fin is None or scholarship.fecha_fin >= first_day)
    ]
    same_reason = [scholarship for scholarship in covering if scholarship.motivo[:200] == item.motivo]
    if same_reason:
        return same_reason[0]
    return covering[0] if len(covering) == 1 else None


def link_scholarship_items(apps, schema_editor):
    Beca = apps.get_model("finanzas", "Beca")
    ItemCuota = apps.get_model("finanzas", "ItemCuota")
    scholarships_by_socio = {}
    for scholarship in Beca.objects.order_by("fecha_aplicacion", "pk"):
        scholarships_by_socio.setdefault(scholarship.socio_id, []).append(scholarship)

    items = (
        ItemCuota.objects.filter(concepto=SCHOLARSHIP_CONCEPT, beca__isnull=True)
        .select_related("cuota__movimiento__cuenta_corriente")
    )
    for item in items:
        movement = getattr(item.cuota, "movimiento", None)
        if movement is None:
            continue
        try:
            first_day, last_day = period_bounds(item.cuota.periodo)
        except ValueError:
            continue
        scholarship = matching_scholarship(
            scholarships_by_socio.get(movement.cuenta_corriente.socio_id, []), item, first_day, last_day,
        )
        if scholarship:
            item.beca = scholarship
            item.save(update_fields=["beca"])


def number_surcharges(apps, schema_editor):
    ItemCuota = apps.get_model("finanzas", "ItemCuota")
    for item in ItemCuota.objects.filter(concepto=SURCHARGE_CONCEPT, vencimiento__isnull=True):
        reason = item.motivo.casefold()
        number = next((number for word, number in SURCHARGE_NUMBERS if word in reason), None)
        if number:
            item.vencimiento = number
            item.save(update_fields=["vencimiento"])


def finish_expired_scholarships(apps, schema_editor):
    Beca = apps.get_model("finanzas", "Beca")
    Beca.objects.filter(estado=APPLIED, fecha_fin__lt=timezone.localdate()).update(estado=FINISHED)


def backfill(apps, schema_editor):
    link_scholarship_items(apps, schema_editor)
    number_surcharges(apps, schema_editor)
    finish_expired_scholarships(apps, schema_editor)


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0033_beca_estados_y_anulacion_items"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
