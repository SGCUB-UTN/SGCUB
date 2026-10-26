from decimal import Decimal

from django.db import transaction

from padron.models import Domicilio

from .models import ConfiguracionGeneral, HistorialConfiguracion, SeccionConfiguracionChoices

Seccion = SeccionConfiguracionChoices

# Section and label of every setting of ConfiguracionGeneral, as the history shows them
FIELD_SECTIONS = {
    "club_nombre": (Seccion.CLUB, "Nombre del club"),
    "club_cuit": (Seccion.CLUB, "CUIT"),
    "club_logo": (Seccion.CLUB, "Logo"),
    "club_domicilio": (Seccion.CLUB, "Domicilio"),
    "club_telefono": (Seccion.CLUB, "Teléfono"),
    "club_email": (Seccion.CLUB, "Email del club"),
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

ADDRESS_FIELDS = ("calle", "numero", "piso", "departamento", "entre_calle_1", "entre_calle_2", "localidad", "barrio")


def display_value(value):
    if isinstance(value, bool):
        return "Sí" if value else "No"
    if value is None:
        return ""
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    return str(value)


def record_change(section, field, before, after, user=None, responsable=""):
    return HistorialConfiguracion.objects.create(
        seccion=section,
        campo=field[:120],
        valor_anterior=display_value(before),
        valor_nuevo=display_value(after),
        usuario=user,
        responsable=responsable[:120],
    )


def record_catalog_update(section, label, before, after, field_labels, user=None):
    """One history entry per changed field of a catalog item (payment method, document type)."""
    for field, field_label in field_labels.items():
        if before.get(field) != after.get(field):
            record_change(section, f"{label} · {field_label}", before.get(field), after.get(field), user)


def address_text(address):
    if address is None:
        return ""
    floor = " ".join(part for part in (f"Piso {address.piso}" if address.piso else "", address.departamento or "") if part)
    parts = [f"{address.calle} {address.numero}".strip(), floor, address.barrio.nombre if address.barrio else "", address.localidad.nombre]
    return ", ".join(part for part in parts if part)


def merged_address(address, values):
    """Every address field: the current value overridden by `values`, with blanks as None."""
    current = {field: getattr(address, field) if address else None for field in ADDRESS_FIELDS}
    return {field: (value if value != "" else None) for field, value in {**current, **values}.items()}


def save_club_address(configuration, values):
    """Creates or updates the club address. Returns whether it changed."""
    address = configuration.club_domicilio
    before = merged_address(address, {})
    merged = merged_address(address, values)
    if merged == before:
        return False
    if address is None:
        configuration.club_domicilio = Domicilio.objects.create(**merged)
    else:
        for field, value in merged.items():
            setattr(address, field, value)
        address.save()
    return True


@transaction.atomic
def update_general_configuration(values, user=None, responsable="", remove_logo=False):
    """Applies the changed settings and records each one in the history with its responsable."""
    configuration = ConfiguracionGeneral.load()
    values = dict(values)
    address_values = values.pop("club_domicilio", None)
    logo = values.pop("club_logo", None)
    changed = []

    def record(field, before, after):
        section, label = FIELD_SECTIONS[field]
        record_change(section, label, before, after, user, responsable)

    for field, value in values.items():
        if getattr(configuration, field) != value:
            record(field, getattr(configuration, field), value)
            setattr(configuration, field, value)
            changed.append(field)

    if address_values:
        before = address_text(configuration.club_domicilio)
        if save_club_address(configuration, address_values):
            record("club_domicilio", before, address_text(configuration.club_domicilio))
            changed.append("club_domicilio")

    if logo is not None or (remove_logo and configuration.club_logo):
        had_logo = bool(configuration.club_logo)
        if had_logo:
            configuration.club_logo.delete(save=False)
        if logo is not None:
            configuration.club_logo = logo
        record("club_logo", "Cargado" if had_logo else "", "Cargado" if logo is not None else "Quitado")
        changed.append("club_logo")

    if changed:
        configuration.save(update_fields=changed)
    return configuration


def club_name():
    return ConfiguracionGeneral.load().club_nombre


def club_details():
    """'CUIT 30-12345678-9 · Calle 1 123, Berisso · Tel. 221...' with the data that was filled in."""
    configuration = ConfiguracionGeneral.load()
    parts = [
        f"CUIT {configuration.club_cuit}" if configuration.club_cuit else "",
        address_text(configuration.club_domicilio),
        f"Tel. {configuration.club_telefono}" if configuration.club_telefono else "",
        configuration.club_email,
    ]
    return " · ".join(part for part in parts if part)
