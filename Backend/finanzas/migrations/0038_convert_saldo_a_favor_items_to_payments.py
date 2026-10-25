from decimal import Decimal
from django.db import migrations


def convert_saldo_a_favor_items(apps, schema_editor):
    ItemCuota = apps.get_model("finanzas", "ItemCuota")
    Pago = apps.get_model("finanzas", "Pago")
    ItemPago = apps.get_model("finanzas", "ItemPago")
    Comprobante = apps.get_model("finanzas", "Comprobante")
    MovimientoCuenta = apps.get_model("finanzas", "MovimientoCuenta")
    Imputacion = apps.get_model("finanzas", "Imputacion")
    DetalleImputacion = apps.get_model("finanzas", "DetalleImputacion")
    SecuenciaComprobante = apps.get_model("finanzas", "SecuenciaComprobante")

    def get_next_number():
        seq, _ = SecuenciaComprobante.objects.get_or_create(pk=1)
        seq.ultimo_numero += 1
        seq.save(update_fields=["ultimo_numero"])
        return seq.ultimo_numero

    items_to_convert = list(
        ItemCuota.objects.filter(
            motivo__startswith="Saldo a favor aplicado",
            es_descuento=True,
        ).select_related("cuota__movimiento__cuenta_corriente")
    )

    for item in items_to_convert:
        cuota = item.cuota
        credit = item.monto
        charge_movement = getattr(cuota, "movimiento", None)
        if charge_movement is None:
            continue
        account = charge_movement.cuenta_corriente

        # Delete the discount item
        item.delete()

        # Update cuota charge movement to actual sum of items
        amount = sum(
            (i.monto for i in cuota.items.filter(es_descuento=False)),
            Decimal("0.00"),
        ) - sum(
            (i.monto for i in cuota.items.filter(es_descuento=True)),
            Decimal("0.00"),
        )
        charge_movement.monto = max(Decimal("0.00"), amount)
        charge_movement.save(update_fields=["monto"])

        # Check if an existing payment for this cuota already exists
        already_paid = Imputacion.objects.filter(
            movimiento_destino=charge_movement,
            movimiento_origen__pago__observacion="Pago con saldo a favor",
        ).exists()

        if not already_paid:
            payment = Pago.objects.create(
                usuario=None,
                estado_pago="Acreditado",
                fecha=charge_movement.fecha,
                observacion="Pago con saldo a favor",
            )
            ItemPago.objects.create(
                pago=payment,
                medio_de_pago="Transferencia",
                monto=credit,
            )
            receipt_num = get_next_number()
            Comprobante.objects.create(
                pago=payment,
                fecha_emision=charge_movement.fecha.date(),
                numero=receipt_num,
                monto_total=credit,
            )
            pay_mov = MovimientoCuenta.objects.create(
                cuenta_corriente=account,
                pago=payment,
                tipo_movimiento="Abono",
                fecha=charge_movement.fecha,
                monto=credit,
                concepto=f"Pago cuota {cuota.periodo} con saldo a favor",
            )
            imputation = Imputacion.objects.create(
                movimiento_origen=pay_mov,
                movimiento_destino=charge_movement,
                fecha=charge_movement.fecha,
                monto_aplicado=credit,
            )
            DetalleImputacion.objects.create(
                imputacion=imputation,
                concepto="CuotaSocial",
                monto=credit,
            )

        cuota.estado_cuota = "Paga" if credit >= amount else "Emitida"
        cuota.save(update_fields=["estado_cuota"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("finanzas", "0037_movimiento_numero_comprobante"),
    ]

    operations = [
        migrations.RunPython(convert_saldo_a_favor_items, noop),
    ]

