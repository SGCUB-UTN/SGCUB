import logging
from collections import defaultdict
from decimal import Decimal

from django.utils import timezone

from padron.models import ESTADO_ADMINISTRATIVO_ACTIVO, Socio
from padron.services import format_datetime, format_dni

from .generators import PERIOD_FORMAT
from .models import (
    ConfiguracionFinanciera,
    Cuota,
    EjecucionTareaCuota,
    MovimientoCuenta,
    OrigenEjecucionChoices,
    TipoTareaCuotaChoices,
)
from .pdf_utils import format_amount
from .services import apply_surcharges, due_date, generar_cuotas_mensuales, parse_period, pending_amounts, user_name

logger = logging.getLogger(__name__)

MEMBERS = "socios"
PLAYERS = "jugadores"
PARTIAL_LEAVE = "baja_parcial"
MEMBER_GROUPS = (MEMBERS, PLAYERS, PARTIAL_LEAVE)
GROUP_LABELS = {MEMBERS: "Socios", PLAYERS: "Jugadores", PARTIAL_LEAVE: "Jugadores de baja parcial"}
SURCHARGE_TASKS = {1: TipoTareaCuotaChoices.RECARGO_1, 2: TipoTareaCuotaChoices.RECARGO_2}
DUE_ORDINALS = {1: "primer", 2: "segundo"}


def member_group(socio):
    player = getattr(socio, "jugador", None)
    if player is None:
        return MEMBERS
    return PLAYERS if player.is_active else PARTIAL_LEAVE


def count_label(count, one, many):
    return f"{count} {one if count == 1 else many}"


def socio_label(socio):
    person = socio.persona
    return f"N° {socio.numero_socio or '—'} · {person.apellido}, {person.nombre} (DNI {format_dni(person.dni)})"


def acting_user(user):
    return user if getattr(user, "is_authenticated", False) else None


def new_run(task_type, period, origin, user, started=None):
    return EjecucionTareaCuota(
        tipo=task_type,
        periodo=period,
        fecha_inicio=started or timezone.now(),
        origen=origin,
        usuario=acting_user(user),
    )


def log_header(run):
    origin = f"Origen: {run.get_origen_display()}"
    if run.usuario_id:
        origin += f" · Usuario: {user_name(run.usuario)}"
    return [
        f"{run.get_tipo_display()} · período {run.periodo}",
        f"Inicio: {format_datetime(run.fecha_inicio)} · {origin}",
    ]


def finish_run(run, lines):
    run.fecha_fin = timezone.now()
    seconds = max(0, round((run.fecha_fin - run.fecha_inicio).total_seconds()))
    run.registro = "\n".join([*log_header(run), "", *lines, "", f"Fin: {format_datetime(run.fecha_fin)} · Duración: {seconds} s"]) + "\n"
    run.save()
    return run


def record_failure(run, error):
    logger.exception("Falló la tarea %s del período %s", run.tipo, run.periodo)
    run.exitosa = False
    run.resumen = f"La ejecución falló: {error}"[:300]
    finish_run(run, [f"La ejecución falló: {error}"])


def active_socios():
    return list(
        Socio.objects.filter(estado_administrativo__nombre__iexact=ESTADO_ADMINISTRATIVO_ACTIVO)
        .select_related("persona", "jugador__estado")
        .order_by("persona__apellido", "persona__nombre", "pk")
    )


def verify_generation(period):
    socios = active_socios()
    with_cuota = set(
        Cuota.objects.filter(periodo=period, movimiento__cuenta_corriente__socio__in=[socio.pk for socio in socios])
        .values_list("movimiento__cuenta_corriente__socio_id", flat=True)
    )
    counts = dict.fromkeys(MEMBER_GROUPS, 0)
    missing = []
    for socio in socios:
        counts[member_group(socio)] += 1
        if socio.pk not in with_cuota:
            missing.append(socio)
    return counts, missing


def generation_summary(counts, missing):
    population = (
        f"En el sistema existen {count_label(counts[MEMBERS], 'socio', 'socios')}, "
        f"{count_label(counts[PLAYERS], 'jugador', 'jugadores')} y "
        f"{count_label(counts[PARTIAL_LEAVE], 'jugador de baja parcial', 'jugadores de baja parcial')}."
    )
    if not missing:
        return f"{population} Todos con la cuota correctamente generada."
    return f"{population} {count_label(len(missing), 'socio no tiene', 'socios no tienen')} la cuota generada; revisá el registro."


def generation_log(run, result, created, counts, missing):
    amounts = dict(
        MovimientoCuenta.objects.filter(cuota__in=[cuota.pk for _, _, cuota in created]).values_list("cuota_id", "monto")
    )
    created_by_period = defaultdict(list)
    for period, socio, cuota in created:
        created_by_period[period].append((socio, cuota))

    lines = [f"Períodos procesados: {', '.join(result['periodos'])}", ""]
    for period in result["periodos"]:
        rows = created_by_period[period]
        lines.append(f"Período {period}: {count_label(len(rows), 'cuota creada', 'cuotas creadas')}.")
        for socio, cuota in sorted(rows, key=lambda row: (row[0].persona.apellido, row[0].persona.nombre)):
            lines.append(f"  + {socio_label(socio)} — {format_amount(amounts.get(cuota.pk, Decimal('0.00')))}")
    lines += [
        f"Cuotas que ya existían: {result['cuotas_existentes']}",
        "",
        f"Verificación del período {run.periodo}",
        *(f"  {GROUP_LABELS[group]}: {counts[group]}" for group in MEMBER_GROUPS),
    ]
    if missing:
        lines.append(f"  Sin cuota generada ({len(missing)}):")
        lines += [f"    - {socio_label(socio)}" for socio in missing]
    else:
        lines.append("  Resultado: todos los socios activos tienen la cuota del período.")
    return lines


def run_cuota_generation(today=None, origin=OrigenEjecucionChoices.AUTOMATICA, user=None):
    today = today or timezone.localdate()
    run = new_run(TipoTareaCuotaChoices.GENERACION, today.strftime(PERIOD_FORMAT), origin, user)
    created = []
    try:
        result = generar_cuotas_mensuales(today, today=today, created=created, user=acting_user(user))
    except Exception as error:
        record_failure(run, error)
        raise

    counts, missing = verify_generation(run.periodo)
    run.exitosa = not missing
    run.resumen = generation_summary(counts, missing)
    run.metricas = {
        **counts,
        "periodos": result["periodos"],
        "cuotas_creadas": result["cuotas_creadas"],
        "cuotas_existentes": result["cuotas_existentes"],
        "sin_cuota": len(missing),
    }
    finish_run(run, generation_log(run, result, created, counts, missing))

    try:
        from configuracion.models import ConfiguracionGeneral
        from comunicaciones.services import crear_y_despachar_notificacion

        config = ConfiguracionGeneral.load()
        if config.notificar_generacion_cuota and created:
            amounts = dict(
                MovimientoCuenta.objects.filter(cuota__in=[cuota.pk for _, _, cuota in created]).values_list("cuota_id", "monto")
            )
            socio_cuotas = defaultdict(list)
            for _, socio, cuota in created:
                socio_cuotas[socio].append(cuota)

            club = config.club_nombre
            for socio, lista_cuotas in socio_cuotas.items():
                periodos_str = ", ".join(c.periodo for c in lista_cuotas)
                total_monto = sum((amounts.get(c.pk, Decimal("0.00")) for c in lista_cuotas), Decimal("0.00"))
                venc1 = lista_cuotas[0].fecha_venc1.strftime("%d/%m/%Y") if lista_cuotas[0].fecha_venc1 else "—"
                venc2 = lista_cuotas[0].fecha_venc2.strftime("%d/%m/%Y") if lista_cuotas[0].fecha_venc2 else "—"
                titulo = f"Nueva cuota emitida: {periodos_str}"
                asunto = f"Emisión de cuota social período {periodos_str} - {club}"
                contenido = (
                    f"Estimado/a {socio.persona.nombre},\n\n"
                    f"Te informamos que ya se encuentra generada tu cuota del período {periodos_str} "
                    f"por un importe total de ${format_amount(total_monto)}.\n\n"
                    f"Fechas de vencimiento:\n"
                    f"  • Primer vencimiento: {venc1}\n"
                    f"  • Segundo vencimiento: {venc2}\n\n"
                    f"Podés abonarla mediante los canales habilitados del club.\n"
                    f"¡Muchas gracias!"
                )
                crear_y_despachar_notificacion(
                    titulo=titulo,
                    asunto=asunto,
                    contenido=contenido,
                    socios=[socio],
                )
    except Exception:
        logger.exception("Error al enviar notificaciones automáticas de generación de cuota")

    return result


def generate_scheduled_cuotas(today=None):
    """Runs every day: generates the month's cuotas only on the day set in the configuration in force."""
    today = today or timezone.localdate()
    generation_day = ConfiguracionFinanciera.load(today).dia_generacion
    if today.day != generation_day:
        return {"periodo": today.strftime(PERIOD_FORMAT), "cuotas_creadas": 0, "dia_generacion": generation_day}
    return run_cuota_generation(today)


def period_due_dates(period):
    first_day = parse_period(period)
    configuration = ConfiguracionFinanciera.load(period)
    return {
        1: due_date(first_day, configuration.dia_vencimiento_1),
        2: due_date(first_day, configuration.dia_vencimiento_2),
    }


def recorded_surcharges(period):
    return set(
        EjecucionTareaCuota.objects.filter(periodo=period, tipo__in=SURCHARGE_TASKS.values(), exitosa=True)
        .values_list("tipo", flat=True)
    )


def due_surcharges(period, today):
    return [number for number, due in period_due_dates(period).items() if today > due]


def unpaid_after_due(period, number, today):
    due_field = "fecha_venc1__lt" if number == 1 else "fecha_venc2__lt"
    cuotas = list(
        Cuota.objects.filter(periodo=period, movimiento__isnull=False, **{due_field: today})
        .select_related("movimiento__cuenta_corriente__socio__persona")
    )
    pending = pending_amounts(cuotas)
    return [cuota for cuota in cuotas if pending[cuota.pk] > 0]


def surcharge_summary(number, unpaid, missing):
    ordinal = DUE_ORDINALS[number]
    if not unpaid:
        return f"En este mes no hay cuotas impagas al {ordinal} vencimiento; no correspondió aplicar recargos."
    message = (
        f"En este mes, {'existe' if len(unpaid) == 1 else 'existen'} "
        f"{count_label(len(unpaid), 'cuota impaga', 'cuotas impagas')}"
    )
    if not missing:
        return f"{message}, se le aplicó correctamente el recargo por {ordinal} vencimiento."
    return f"{message}; {count_label(len(missing), 'quedó', 'quedaron')} sin el recargo por {ordinal} vencimiento, revisá el registro."


def cuota_socio(cuota):
    return cuota.movimiento.cuenta_corriente.socio


def surcharge_log(number, due, result, items, unpaid, missing, period):
    cuotas = Cuota.objects.select_related("movimiento__cuenta_corriente__socio__persona").in_bulk(
        [item.cuota_id for item in items]
    )
    total = sum((item.monto for item in items), Decimal("0.00"))
    rows = sorted(
        ((cuotas[item.cuota_id], item) for item in items),
        key=lambda row: (row[0].periodo, cuota_socio(row[0]).persona.apellido, cuota_socio(row[0]).persona.nombre),
    )
    lines = [
        f"Vencimiento: {due:%d/%m/%Y}",
        f"Cuotas revisadas (todos los períodos): {result['cuotas_revisadas']}",
        f"Recargos aplicados: {len(items)} · Total: {format_amount(total)}",
        *(f"  + {socio_label(cuota_socio(cuota))} — cuota {cuota.periodo} — {format_amount(item.monto)}" for cuota, item in rows),
        f"Estados de cuota actualizados: {result['estados_actualizados']}",
        "",
        f"Verificación del período {period}",
        f"  Cuotas impagas al {number}° vencimiento: {len(unpaid)}",
    ]
    if missing:
        lines.append(f"  Sin recargo aplicado ({len(missing)}):")
        lines += [f"    - {socio_label(cuota_socio(cuota))}" for cuota in missing]
    else:
        lines.append("  Resultado: todas las cuotas impagas tienen el recargo aplicado.")
    return lines


def run_surcharges(today, numbers, origin=OrigenEjecucionChoices.AUTOMATICA, user=None):
    period = today.strftime(PERIOD_FORMAT)
    started = timezone.now()
    applied = []
    try:
        result = apply_surcharges(today, applied=applied, user=acting_user(user))
    except Exception as error:
        for number in numbers:
            record_failure(new_run(SURCHARGE_TASKS[number], period, origin, user, started), error)
        raise

    due_dates = period_due_dates(period)
    for number in numbers:
        run = new_run(SURCHARGE_TASKS[number], period, origin, user, started)
        items = [item for item_number, item in applied if item_number == number]
        unpaid = unpaid_after_due(period, number, today)
        missing = [cuota for cuota in unpaid if cuota.recargos_aplicados < number]
        unpaid_ids = {cuota.pk for cuota in unpaid}
        period_items = [item for item in items if item.cuota_id in unpaid_ids]
        run.exitosa = not missing
        run.resumen = surcharge_summary(number, unpaid, missing)
        run.metricas = {
            "vencimiento": due_dates[number].isoformat(),
            "cuotas_impagas": len(unpaid),
            "recargos_aplicados": len(items),
            "recargos_del_periodo": len(period_items),
            "monto_recargos": str(sum((item.monto for item in items), Decimal("0.00"))),
            "sin_recargo": len(missing),
        }
        finish_run(run, surcharge_log(number, due_dates[number], result, items, unpaid, missing, period))

    try:
        from configuracion.models import ConfiguracionGeneral
        from comunicaciones.services import crear_y_despachar_notificacion

        config = ConfiguracionGeneral.load()
        if config.notificar_cuota_vencida and applied:
            club = config.club_nombre
            cuotas_con_recargo = Cuota.objects.select_related(
                "movimiento__cuenta_corriente__socio__persona"
            ).in_bulk([item.cuota_id for _, item in applied])

            socio_recargos = defaultdict(list)
            for num, item in applied:
                cuota = cuotas_con_recargo.get(item.cuota_id)
                if cuota:
                    socio = cuota.movimiento.cuenta_corriente.socio
                    socio_recargos[socio].append((num, cuota, item))

            for socio, recs in socio_recargos.items():
                for num, cuota, item in recs:
                    ordinal = DUE_ORDINALS.get(num, f"{num}°")
                    titulo = f"Aviso de cuota vencida: período {cuota.periodo}"
                    asunto = f"Aviso de vencimiento y recargo - Cuota {cuota.periodo} - {club}"
                    contenido = (
                        f"Estimado/a {socio.persona.nombre},\n\n"
                        f"Te informamos que ha operado el {ordinal} vencimiento de tu cuota del período {cuota.periodo}.\n"
                        f"Se ha aplicado un recargo por mora de ${format_amount(item.monto)}.\n\n"
                        f"Te solicitamos regularizar tu estado de cuenta a la brevedad.\n"
                        f"¡Muchas gracias!"
                    )
                    crear_y_despachar_notificacion(
                        titulo=titulo,
                        asunto=asunto,
                        contenido=contenido,
                        socios=[socio],
                    )
    except Exception:
        logger.exception("Error al enviar notificaciones automáticas de cuota vencida")

    return result


def apply_scheduled_surcharges(today=None):
    today = today or timezone.localdate()
    period = today.strftime(PERIOD_FORMAT)
    done = recorded_surcharges(period)
    numbers = [number for number in due_surcharges(period, today) if SURCHARGE_TASKS[number] not in done]
    if not numbers:
        return {"fecha": today.isoformat(), "periodo": period, "recargos_primer_vencimiento": 0, "recargos_segundo_vencimiento": 0}
    return run_surcharges(today, numbers)


def run_manual_surcharges(today=None, user=None):
    today = today or timezone.localdate()
    period = today.strftime(PERIOD_FORMAT)
    reached = due_surcharges(period, today)
    if not reached:
        return apply_surcharges(today, user=acting_user(user))
    done = recorded_surcharges(period)
    numbers = [number for number in reached if SURCHARGE_TASKS[number] not in done] or reached[-1:]
    return run_surcharges(today, numbers, OrigenEjecucionChoices.MANUAL, user)


def enviar_comprobante_pago_email(comprobante_id):
    """
    Tarea asíncrona de Django-Q (HU-08 / HU-13 / #73):
    Envía el comprobante de pago en formato PDF al correo electrónico del socio
    (o a su contacto responsable si es menor).
    Se ejecuta fuera de la transacción principal tras confirmarse el pago.
    """
    from configuracion.models import ConfiguracionGeneral
    from comunicaciones.services import crear_y_despachar_notificacion
    from .models import Comprobante
    from .receipts import receipt_filename, render_receipt_pdf

    try:
        comprobante = Comprobante.objects.select_related(
            "pago__movimiento__cuenta_corriente__socio__persona"
        ).get(pk=comprobante_id)
    except Comprobante.DoesNotExist:
        logger.error("Comprobante %s no encontrado para envío por email", comprobante_id)
        return

    socio = comprobante.pago.movimiento.cuenta_corriente.socio
    pdf_bytes = render_receipt_pdf(comprobante)
    filename = receipt_filename(comprobante)
    club = ConfiguracionGeneral.load().club_nombre

    titulo = f"Comprobante de pago N° {comprobante.numero:08d}"
    asunto = f"Comprobante de pago N° {comprobante.numero:08d} - {club}"
    contenido = (
        f"Estimado/a {socio.persona.nombre},\n\n"
        f"Te confirmamos la recepción de tu pago por un monto total de ${format_amount(comprobante.monto_total)}.\n"
        f"Adjuntamos a este correo tu comprobante oficial en formato PDF.\n\n"
        f"¡Muchas gracias por colaborar con el club!"
    )

    return crear_y_despachar_notificacion(
        titulo=titulo,
        asunto=asunto,
        contenido=contenido,
        socios=[socio],
        adjuntos=[(filename, pdf_bytes, "application/pdf")],
    )


def send_scheduled_due_reminders(today=None):
    """
    Tarea programada diaria (Issue #122 / #140):
    Busca cuotas impagas que vencen en 'dias_recordatorio_vencimiento' días
    o que operan su 1° o 2° vencimiento en el día de hoy, y despacha
    recordatorios por correo electrónico a los socios correspondientes.
    """
    from datetime import timedelta
    from django.db.models import Q
    from configuracion.models import ConfiguracionGeneral
    from comunicaciones.services import crear_y_despachar_notificacion

    today = today or timezone.localdate()
    config = ConfiguracionGeneral.load()
    if not config.notificar_recordatorio_vencimiento:
        return {"avisos_enviados": 0, "motivo": "notificar_recordatorio_vencimiento desactivado"}

    dias = config.dias_recordatorio_vencimiento or 3
    target_date = today + timedelta(days=dias)

    # Cuotas que vencen en 'dias' días o que vencen hoy
    cuotas = list(
        Cuota.objects.filter(
            movimiento__isnull=False,
        )
        .filter(
            Q(fecha_venc1=target_date)
            | Q(fecha_venc2=target_date)
            | Q(fecha_venc1=today)
            | Q(fecha_venc2=today)
        )
        .select_related("movimiento__cuenta_corriente__socio__persona")
    )

    if not cuotas:
        return {"avisos_enviados": 0, "cuotas_revisadas": 0}

    pending = pending_amounts(cuotas)
    cuotas_impagas = [c for c in cuotas if pending.get(c.pk, Decimal("0.00")) > Decimal("0.00")]

    enviados = 0
    club = config.club_nombre
    for cuota in cuotas_impagas:
        socio = cuota.movimiento.cuenta_corriente.socio
        saldo = pending[cuota.pk]
        vencimiento = cuota.fecha_venc1 if cuota.fecha_venc1 and cuota.fecha_venc1 >= today else cuota.fecha_venc2

        if not vencimiento:
            continue

        dias_restantes = (vencimiento - today).days
        if dias_restantes == 0:
            tiempo_str = "hoy mismo"
        else:
            tiempo_str = f"en {dias_restantes} días (el {vencimiento.strftime('%d/%m/%Y')})"

        titulo = f"Recordatorio de vencimiento de cuota {cuota.periodo}"
        asunto = f"Recordatorio de vencimiento - Cuota {cuota.periodo} - {club}"
        contenido = (
            f"Estimado/a {socio.persona.nombre},\n\n"
            f"Te recordamos que tu cuota social del período {cuota.periodo} vence {tiempo_str}.\n"
            f"El saldo pendiente de pago es de ${format_amount(saldo)}.\n\n"
            f"Te recomendamos regularizarla para evitar la aplicación de recargos por mora.\n"
            f"¡Muchas gracias!"
        )

        crear_y_despachar_notificacion(
            titulo=titulo,
            asunto=asunto,
            contenido=contenido,
            socios=[socio],
        )
        enviados += 1

    return {"avisos_enviados": enviados, "cuotas_impagas": len(cuotas_impagas)}

