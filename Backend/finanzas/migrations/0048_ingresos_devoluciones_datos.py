from django.core.management.color import no_style
from django.db import migrations
from django.utils import timezone

RECEIPT, CREDIT_NOTE, MANUAL_REFUND = "Recibo", "NotaCredito", "DevolucionManual"
MIGRATION_RESPONSABLE = "Migración"
EXPENSE_CONCEPTS = ("Reintegro de gastos", "Compra de insumos / Materiales")


def seed_sequences(apps, schema_editor):
    """Leaves one sequence per receipt type. Existing receipts keep counting from the highest number
    issued; that row was created with an explicit pk, so the database id sequence never moved and is
    reset before adding the new rows."""
    SecuenciaComprobante = apps.get_model("finanzas", "SecuenciaComprobante")
    rows = list(SecuenciaComprobante.objects.order_by("-ultimo_numero", "pk"))
    if rows:
        SecuenciaComprobante.objects.exclude(pk=rows[0].pk).delete()
        SecuenciaComprobante.objects.filter(pk=rows[0].pk).update(tipo=RECEIPT)
    for sql in schema_editor.connection.ops.sequence_reset_sql(no_style(), [SecuenciaComprobante]):
        schema_editor.execute(sql)
    for kind in (RECEIPT, CREDIT_NOTE, MANUAL_REFUND):
        SecuenciaComprobante.objects.get_or_create(tipo=kind)


def next_number(apps, kind):
    sequence, _ = apps.get_model("finanzas", "SecuenciaComprobante").objects.get_or_create(tipo=kind)
    sequence.ultimo_numero += 1
    sequence.save(update_fields=["ultimo_numero"])
    return sequence.ultimo_numero


def payment_method(apps, *codes):
    MedioPago = apps.get_model("finanzas", "MedioPago")
    for code in codes:
        if code and MedioPago.objects.filter(codigo=code).exists():
            return code
    return MedioPago.objects.filter(activo=True).values_list("codigo", flat=True).first() or "Efectivo"


def responsable_for(movement):
    user = movement.usuario
    if user is None:
        return MIGRATION_RESPONSABLE
    return (f"{user.first_name} {user.last_name}".strip() or user.username)[:120]


def create_refund(apps, kind, movement, method, receipt=None):
    apps.get_model("finanzas", "Devolucion").objects.create(
        tipo="NotaCredito" if kind == CREDIT_NOTE else "Manual",
        numero=next_number(apps, kind),
        cuenta_corriente_id=movement.cuenta_corriente_id,
        comprobante_anulado=receipt,
        concepto=(movement.concepto or "Devolución")[:200],
        monto=movement.monto,
        medio_de_pago=method,
        fecha=movement.fecha,
        responsable=responsable_for(movement),
        usuario_id=movement.usuario_id,
    )


def income_to_receipt(apps, income):
    """A manual income becomes a credited payment with its receipt; if it was reverted by credit
    notes, the receipt is annulled and each credit note becomes a refund of it."""
    Pago = apps.get_model("finanzas", "Pago")
    Comprobante = apps.get_model("finanzas", "Comprobante")
    method = payment_method(apps, income.medio_de_pago)
    payment = Pago.objects.create(usuario_id=income.usuario_id, estado_pago="Acreditado", fecha=income.fecha)
    apps.get_model("finanzas", "ItemPago").objects.create(pago=payment, medio_de_pago=method, monto=income.monto)
    number = income.numero_comprobante
    if number is None or Comprobante.objects.filter(numero=number).exists():
        number = next_number(apps, RECEIPT)
    receipt = Comprobante.objects.create(
        pago=payment,
        fecha_emision=timezone.localtime(income.fecha).date(),
        numero=number,
        monto_total=income.monto,
    )
    income.pago = payment
    income.tipo_movimiento = "Ingreso"
    income.save(update_fields=["pago", "tipo_movimiento"])

    credit_notes = list(income.reversiones.filter(origen_manual="NotaCredito").order_by("pk"))
    if credit_notes:
        payment.estado_pago = "Anulado"
        payment.motivo_anulacion = "Revertido por nota de crédito"
        payment.fecha_anulacion = credit_notes[0].fecha
        payment.responsable_anulacion = responsable_for(credit_notes[0])
        payment.save()
        receipt.estado = "Anulado"
        receipt.save(update_fields=["estado"])
        for credit_note in credit_notes:
            create_refund(apps, CREDIT_NOTE, credit_note, payment_method(apps, credit_note.medio_de_pago, method), receipt)


def migrate_manual_movements(apps, schema_editor):
    MovimientoCuenta = apps.get_model("finanzas", "MovimientoCuenta")
    for income in MovimientoCuenta.objects.filter(origen_manual="IngresoManual").order_by("pk"):
        income_to_receipt(apps, income)
    for refund in MovimientoCuenta.objects.filter(origen_manual="Egreso").order_by("pk"):
        create_refund(apps, MANUAL_REFUND, refund, payment_method(apps, refund.medio_de_pago))

    # Credit notes, refunds and the reversals of corrected payments now live elsewhere. Reversals of
    # reversals go first: the link between them is protected.
    obsolete = MovimientoCuenta.objects.filter(cuota__isnull=True, pago__isnull=True)
    while obsolete.exists():
        obsolete.exclude(reversion__isnull=False).delete()


def migrate_concepts(apps, schema_editor):
    ConceptoMovimiento = apps.get_model("finanzas", "ConceptoMovimiento")
    Devolucion = apps.get_model("finanzas", "Devolucion")
    ConceptoMovimiento.objects.filter(origen="NotaCredito").delete()
    ConceptoMovimiento.objects.filter(origen="IngresoManual").update(origen="Ingreso")
    for name in EXPENSE_CONCEPTS:
        if not Devolucion.objects.filter(tipo="Manual", concepto__iexact=name).exists():
            ConceptoMovimiento.objects.filter(origen="Egreso", nombre=name).delete()
    ConceptoMovimiento.objects.filter(origen="Egreso", nombre="Otro egreso").update(nombre="Otra devolución")
    ConceptoMovimiento.objects.filter(origen="Egreso").update(origen="DevolucionManual")
    ConceptoMovimiento.objects.get_or_create(origen="DevolucionManual", nombre="Otra devolución")
    ConceptoMovimiento.objects.get_or_create(origen="Ingreso", nombre="Otro ingreso")


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0047_ingresos_devoluciones_esquema"),
    ]

    operations = [
        migrations.RunPython(seed_sequences, migrations.RunPython.noop),
        migrations.RunPython(migrate_manual_movements, migrations.RunPython.noop),
        migrations.RunPython(migrate_concepts, migrations.RunPython.noop),
    ]
