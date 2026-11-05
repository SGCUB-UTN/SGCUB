import csv
from io import BytesIO, StringIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from configuracion.services import club_name
from finanzas.pdf_utils import table

from .models import Categoria, Genero, Localidad
from .reports import (
    ACTIVE,
    AGE_RANGE_LABELS,
    ALL,
    COVERAGE_LABELS,
    DISABLED,
    EDUCATION_LABELS,
    ENABLED,
    MEMBERS,
    PARTIAL_LEAVE,
    PLAYERS,
    TEACHER_MEMBERS,
    TEACHERS,
    VACCINATION_LABELS,
)

PAGE_SIZE = landscape(A4)
MARGIN = 15 * mm
NOT_APPLICABLE = "No aplica"
EMPTY = "—"
DISTRIBUTION_LIMIT = 10
DISTRIBUTION_COLUMNS = 3
LIST_HEADERS = ["Apellido y nombre", "DNI", "Rol", "Edad", "Localidad", "Vacunación", "Obra social", "Categorías"]
LIST_COLUMN_SHARES = (0.20, 0.09, 0.15, 0.05, 0.11, 0.11, 0.12, 0.17)
CSV_HEADERS = [
    "Apellido", "Nombre", "DNI", "Rol", "Estado", "Edad", "Género", "Localidad", "Vacunación", "Obra social",
    "Nivel educativo", "Categorías", "Estado documental", "Fecha de alta", "Fecha de baja",
]
ENTITY_LABELS = {None: "Todos", "socios": "Socios", "jugadores": "Jugadores", "docentes": "Docentes"}
STATUS_LABELS = {ACTIVE: "Activos", "inactivos": "Inactivos", ALL: "Activos e inactivos"}
DOCUMENTATION_ROW_LABELS = {ENABLED: "Habilitado", DISABLED: "Inhabilitado"}
ROLE_ROW_LABELS = {
    MEMBERS: "Socio",
    PLAYERS: "Jugador",
    PARTIAL_LEAVE: "Jugador de baja parcial",
    TEACHERS: "Docente",
    TEACHER_MEMBERS: "Docente y socio",
}
DISTRIBUTIONS = (
    ("roles", "Roles"),
    ("vaccination", "Vacunación (jugadores)"),
    ("gender", "Género"),
    ("age_ranges", "Rangos de edad"),
    ("localities", "Localidades"),
    ("education", "Nivel educativo (jugadores)"),
    ("health_insurance", "Obra social (jugadores)"),
    ("documentation", "Estado documental"),
    ("categories", "Categorías"),
)


def report_filename(generated_at, extension):
    return f"reporte-padron-{generated_at:%Y%m%d-%H%M}.{extension}"


def format_date(value):
    return f"{value:%d/%m/%Y}" if value else ""


def format_percentage(value):
    return EMPTY if value is None else f"{value:.1f}%".replace(".", ",")


def format_number(value):
    return EMPTY if value is None else f"{value:.1f}".replace(".", ",")


def labelled(value, labels):
    return NOT_APPLICABLE if value is None else labels[value]


def display_row(row):
    applies = row["coverage"] is not None
    return {
        "name": f"{row['last_name']}, {row['first_name']}",
        "role": ROLE_ROW_LABELS[row["role"]],
        "status": "Activo" if row["active"] else "Inactivo",
        "age": "" if row["age"] is None else str(row["age"]),
        "gender": row["gender"] or "",
        "locality": row["locality"] or "",
        "vaccination": labelled(row["vaccination"], VACCINATION_LABELS),
        "health_insurance": (row["health_insurance"] or "Sin obra social") if applies else NOT_APPLICABLE,
        "education": labelled(row["education"], EDUCATION_LABELS),
        "categories": ", ".join(item["name"] for item in row["categories"]),
        "documentation": labelled(row["documentation"], DOCUMENTATION_ROW_LABELS),
    }


def render_report_csv(report):
    buffer = StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(CSV_HEADERS)
    for row in report["people"]:
        display = display_row(row)
        writer.writerow([
            row["last_name"], row["first_name"], row["dni"], display["role"], display["status"], display["age"],
            display["gender"], display["locality"], display["vaccination"], display["health_insurance"],
            display["education"], display["categories"], display["documentation"],
            format_date(row["join_date"]), format_date(row["leave_date"]),
        ])
    return ("﻿" + buffer.getvalue()).encode("utf-8")


def names_of(model, ids, label=str):
    return ", ".join(sorted(label(item) for item in model.objects.filter(pk__in=ids)))


def category_name(category):
    return f"{category.nombre} ({category.get_genero_display()})" if category.genero else category.nombre


def chosen(values, labels):
    return ", ".join(labels[value] for value in labels if value in values)


def age_limits_text(low, high):
    if low is not None and high is not None:
        return f"de {low} a {high} años"
    if low is not None:
        return f"desde {low} años"
    return f"hasta {high} años"


def filter_parts(filters):
    parts = [f"Entidad: {ENTITY_LABELS[filters['entity']]}", f"Estado: {STATUS_LABELS[filters['status']]}"]
    if filters["age_range"]:
        parts.append(f"Rango de edad: {chosen(filters['age_range'], AGE_RANGE_LABELS)}")
    if filters["age_min"] is not None or filters["age_max"] is not None:
        parts.append(f"Edad: {age_limits_text(filters['age_min'], filters['age_max'])}")
    if filters["gender"]:
        parts.append(f"Género: {names_of(Genero, filters['gender'])}")
    if filters["locality"]:
        parts.append(f"Localidad: {names_of(Localidad, filters['locality'])}")
    if filters["category"]:
        parts.append(f"Categoría: {names_of(Categoria, filters['category'], category_name)}")
    if filters["education"]:
        parts.append(f"Nivel educativo: {chosen(filters['education'], EDUCATION_LABELS)}")
    if filters["coverage"]:
        parts.append(f"Cobertura: {chosen(filters['coverage'], COVERAGE_LABELS)}")
    if filters["health_insurance"]:
        parts.append(f"Obra social: {', '.join(sorted(filters['health_insurance']))}")
    if filters["vaccination"]:
        parts.append(f"Vacunación: {chosen(filters['vaccination'], VACCINATION_LABELS)}")
    if filters["documentation"]:
        parts.append(f"Estado documental: {chosen(filters['documentation'], DOCUMENTATION_ROW_LABELS)}")
    return parts


def kpi_text(kpis):
    return " · ".join([
        f"Total: {kpis['total']}",
        f"Edad promedio: {format_number(kpis['average_age'])}",
        f"Vacunación al día: {format_percentage(kpis['vaccination_up_to_date'])}",
        f"Con obra social: {format_percentage(kpis['with_health_insurance'])}",
    ])


def distribution_table(title, items, width, styles):
    total = sum(item["count"] for item in items)
    shown = [item for item in items if item["count"]][:DISTRIBUTION_LIMIT]
    rows = [[Paragraph(f"<b>{escape(title)}</b>", styles["Normal"]), "Cant.", "%"]]
    rows += [
        [Paragraph(escape(str(item["label"])), styles["Normal"]), str(item["count"]), format_percentage(item["count"] * 100 / total)]
        for item in shown
    ]
    if not shown:
        rows.append(["Sin datos", "", ""])
    return table(rows, [width * 0.62, width * 0.18, width * 0.20], right_aligned_from=1)


def distribution_grid(charts, width, styles):
    gap = 4 * mm
    cell_width = (width - gap * (DISTRIBUTION_COLUMNS - 1)) / DISTRIBUTION_COLUMNS
    cells = [distribution_table(title, charts[key], cell_width, styles) for key, title in DISTRIBUTIONS]
    rows = [cells[index:index + DISTRIBUTION_COLUMNS] for index in range(0, len(cells), DISTRIBUTION_COLUMNS)]
    grid = Table(rows, colWidths=[cell_width + gap] * (DISTRIBUTION_COLUMNS - 1) + [cell_width], hAlign="LEFT")
    grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), gap),
    ]))
    return grid


def evolution_table(monthly, width):
    header = ["", *(item["period"][5:] + "/" + item["period"][2:4] for item in monthly)]
    rows = [header, ["Altas", *(str(item["joins"]) for item in monthly)], ["Bajas", *(str(item["leaves"]) for item in monthly)]]
    first = width * 0.10
    other = (width - first) / len(monthly)
    return table(rows, [first] + [other] * len(monthly), right_aligned_from=1)


def people_table(people, width, styles):
    def cell(text):
        return Paragraph(escape(str(text or EMPTY)), styles["Normal"])

    rows = [LIST_HEADERS]
    for row in people:
        display = display_row(row)
        rows.append([
            cell(display["name"]), row["dni"], cell(display["role"]), display["age"] or EMPTY, cell(display["locality"]),
            cell(display["vaccination"]), cell(display["health_insurance"]), cell(display["categories"]),
        ])
    content = table(rows, [width * share for share in LIST_COLUMN_SHARES])
    content.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "LEFT")]))
    return content


def render_report_pdf(report, filters, generated_at):
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Titulo", parent=styles["Title"], alignment=0, spaceAfter=2)
    subtitle = ParagraphStyle("Subtitulo", parent=styles["Normal"], textColor=colors.HexColor("#5f6368"))
    heading = ParagraphStyle("Seccion", parent=styles["Heading3"], spaceBefore=4, spaceAfter=4)
    width = PAGE_SIZE[0] - 2 * MARGIN

    story = [
        Paragraph(escape(club_name()), subtitle),
        Paragraph("Reporte del padrón", title),
        Paragraph(escape(f"Generado el {generated_at:%d/%m/%Y %H:%M}"), subtitle),
        Paragraph(escape(" · ".join(filter_parts(filters))), subtitle),
        Spacer(1, 3 * mm),
        Paragraph(escape(kpi_text(report["kpis"])), styles["Normal"]),
        Spacer(1, 4 * mm),
        Paragraph("Distribución", heading),
        distribution_grid(report["charts"], width, styles),
        KeepTogether([
            Paragraph("Altas y bajas de los últimos 12 meses (activos e inactivos)", heading),
            evolution_table(report["evolution"]["monthly"], width),
        ]),
        Spacer(1, 4 * mm),
        Paragraph(f"Listado ({len(report['people'])})", heading),
    ]
    if report["people"]:
        story.append(people_table(report["people"], width, styles))
    else:
        story.append(Paragraph("No hay personas para los filtros seleccionados.", styles["Normal"]))

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=PAGE_SIZE,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title="Reporte del padrón",
        author=club_name(),
        pageCompression=0,
    ).build(story)
    return buffer.getvalue()
