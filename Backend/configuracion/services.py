from decimal import Decimal

from .models import ConfiguracionGeneral, HistorialConfiguracion, SeccionConfiguracionChoices

Seccion = SeccionConfiguracionChoices

# Section and label of every setting of ConfiguracionGeneral, as the history shows them
FIELD_SECTIONS = {
    "club_nombre": (Seccion.CLUB, "Nombre del club"),
    "club_cuit": (Seccion.CLUB, "CUIT"),
    "club_direccion": (Seccion.CLUB, "Dirección"),
    "club_telefono": (Seccion.CLUB, "Teléfono"),
    "club_email": (Seccion.CLUB, "Email del club"),
    "monto_inscripcion": (Seccion.FINANZAS, "Monto de inscripción"),
    "cuotas_vencidas_morosidad": (Seccion.FINANZAS, "Cuotas vencidas para considerar moroso"),
    "dias_alerta_documentos": (Seccion.DOCUMENTACION, "Días de aviso antes del vencimiento"),
    "notificar_generacion_cuota": (Seccion.COMUNICACIONES, "Notificar al generar la cuota"),
    "notificar_recordatorio_vencimiento": (Seccion.COMUNICACIONES, "Recordatorio antes del vencimiento"),
    "notificar_cuota_vencida": (Seccion.COMUNICACIONES, "Notificar al vencer la cuota"),
    "notificar_modificacion_cuota": (Seccion.COMUNICACIONES, "Notificar modificaciones de la cuota"),
    "notificar_comprobante_pago": (Seccion.COMUNICACIONES, "Enviar comprobantes de pago"),
    "dias_recordatorio_vencimiento": (Seccion.COMUNICACIONES, "Días de anticipación del recordatorio"),
    "email_nombre_remitente": (Seccion.COMUNICACIONES, "Nombre del remitente"),
    "email_firma": (Seccion.COMUNICACIONES, "Firma de los emails"),
}


def display_value(value):
    if isinstance(value, bool):
        return "Sí" if value else "No"
    if value is None:
        return ""
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    return str(value)


def record_change(section, field, before, after, user=None):
    return HistorialConfiguracion.objects.create(
        seccion=section,
        campo=field[:120],
        valor_anterior=display_value(before),
        valor_nuevo=display_value(after),
        usuario=user,
    )


def record_catalog_update(section, label, before, after, field_labels, user=None):
    """One history entry per changed field of a catalog item (payment method, document type)."""
    for field, field_label in field_labels.items():
        if before.get(field) != after.get(field):
            record_change(section, f"{label} · {field_label}", before.get(field), after.get(field), user)


def update_general_configuration(values, user=None):
    configuration = ConfiguracionGeneral.load()
    changed = [field for field, value in values.items() if getattr(configuration, field) != value]
    for field in changed:
        section, label = FIELD_SECTIONS[field]
        record_change(section, label, getattr(configuration, field), values[field], user)
        setattr(configuration, field, values[field])
    if changed:
        configuration.save(update_fields=changed)
    return configuration


def club_name():
    return ConfiguracionGeneral.load().club_nombre


def club_details():
    """'CUIT 30-12345678-9 · Calle 1 · Tel. 221...' with the data that was filled in."""
    configuration = ConfiguracionGeneral.load()
    parts = [
        f"CUIT {configuration.club_cuit}" if configuration.club_cuit else "",
        configuration.club_direccion,
        f"Tel. {configuration.club_telefono}" if configuration.club_telefono else "",
        configuration.club_email,
    ]
    return " · ".join(part for part in parts if part)
