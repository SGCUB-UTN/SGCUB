from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from configuracion.services import club_name
from finanzas.pdf_utils import table

from .services import (
    AL_DIA,
    FALTANTE,
    GENDER_PREFIX,
    INHABILITADA,
    NO_CATEGORY,
    PERFIL_DOCENTE,
    PERFIL_JUGADOR,
    POR_VENCER,
    VENCIDO,
    category_label,
    filter_personas,
    padron_summary,
    pending_documents,
    person_situation,
)

PAGE_SIZE = landscape(A4)
MOST_AFFECTED_LIMIT = 5
MARGIN = 15 * mm
COLUMN_SHARES = (0.22, 0.10, 0.11, 0.17, 0.11, 0.29)
HEADERS = ["Persona", "DNI", "Perfil", "Categoría", "Situación", "Documentación pendiente"]
PENDING_LABELS = {VENCIDO: "Vencido", FALTANTE: "Faltante", POR_VENCER: "Por vencer"}
SITUATION_LABELS = {INHABILITADA: "Inhabilitado", POR_VENCER: "Por vencer", AL_DIA: "Al día"}
PROFILE_LABELS = {PERFIL_JUGADOR: "Jugador activo", PERFIL_DOCENTE: "Docente"}
FILTER_SITUATION_LABELS = {None: "Todas las personas", INHABILITADA: "Inhabilitadas", POR_VENCER: "Por vencer", AL_DIA: "Al día"}
FILTER_PROFILE_LABELS = {None: "Todos", PERFIL_JUGADOR: "Jugadores activos", PERFIL_DOCENTE: "Docentes"}
FILTER_GENDER_LABELS = {"M": "Todas las masculinas", "F": "Todas las femeninas"}
SITUATION_SLUGS = {
    INHABILITADA: "inhabilitados",
    POR_VENCER: "por-vencer",
    AL_DIA: "al-dia",
}


def padron_filename(generated_at, situacion=None):
    slug = SITUATION_SLUGS.get(situacion)
    prefix = f"reporte-documental-{slug}" if slug else "reporte-documental"
    return f"{prefix}-{generated_at:%Y%m%d-%H%M}.pdf"


def format_count(count, total):
    share = f"{count * 100 / total:.1f}".replace(".", ",") if total else "0,0"
    return f"{count} ({share}%)"


def affected_detail(item):
    parts = []
    if item["inhabilitados"]:
        parts.append(f"{item['inhabilitados']} inhabilitados")
    if item["por_vencer"]:
        parts.append(f"{item['por_vencer']} por vencer")
    return f"{' y '.join(parts)} de {item['total']} personas"


def summary_lines(summary):
    total = summary["total"]
    disabled = summary["inhabilitados_por_perfil"]
    lines = [
        f"Habilitados: {format_count(summary['habilitados'], total)} de {total} personas · "
        f"Inhabilitados: {format_count(summary['inhabilitados'], total)} "
        f"({disabled[PERFIL_JUGADOR]} jugadores activos, {disabled[PERFIL_DOCENTE]} docentes)",
        f"Por vencer: {format_count(summary['por_vencer'], total)} · Al día: {format_count(summary['al_dia'], total)}",
        "Queda inhabilitado quien tiene un documento obligatorio vencido o sin presentar.",
    ]
    if summary["categorias_afectadas"]:
        lines.append("Categorías más afectadas: " + ", ".join(
            f"{item['categoria']} ({affected_detail(item)})" for item in summary["categorias_afectadas"][:MOST_AFFECTED_LIMIT]
        ))
    return lines


def category_filter_label(categoria, personas):
    if categoria == NO_CATEGORY:
        return "Sin categoría"
    if categoria.startswith(GENDER_PREFIX):
        return FILTER_GENDER_LABELS[categoria.removeprefix(GENDER_PREFIX)]
    labels = {item["categoria_id"]: category_label(item) for persona in personas for item in persona["categorias"]}
    return labels.get(int(categoria), "Sin coincidencias")


def document_type_label(tipo, personas):
    labels = {documento["tipo_documento"]: documento["tipo_documento_nombre"] for persona in personas for documento in persona["documentos"]}
    return labels.get(tipo, "Sin coincidencias")


def filter_text(filters, personas):
    parts = [
        f"Situación: {FILTER_SITUATION_LABELS[filters['situacion']]}",
        f"Perfil: {FILTER_PROFILE_LABELS[filters['perfil']]}",
    ]
    if filters["tipo"]:
        parts.append(f"Documento requerido: {document_type_label(filters['tipo'], personas)}")
    if filters["categoria"]:
        parts.append(f"Categoría: {category_filter_label(filters['categoria'], personas)}")
    if filters["q"].strip():
        parts.append(f"Búsqueda: \"{filters['q'].strip()}\"")
    return " · ".join(parts)


def pending_text(persona):
    return ", ".join(
        f"{documento['tipo_documento_nombre']} ({PENDING_LABELS[documento['estado']]})" for documento in pending_documents(persona)
    )


def report_rows(personas, styles):
    def cell(text):
        return Paragraph(escape(str(text or "—")), styles["Normal"])

    return [
        [
            cell(f"{persona['apellido']}, {persona['nombre']}"),
            persona["dni"],
            PROFILE_LABELS[persona["perfil"]],
            cell(", ".join(category_label(categoria) for categoria in persona["categorias"])),
            SITUATION_LABELS[person_situation(persona)],
            cell(pending_text(persona)),
        ]
        for persona in personas
    ]


def render_padron_pdf(personas, filters, generated_at):
    rows = filter_personas(personas, **filters)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Titulo", parent=styles["Title"], alignment=0, spaceAfter=2)
    subtitle = ParagraphStyle("Subtitulo", parent=styles["Normal"], textColor=colors.HexColor("#5f6368"))
    width = PAGE_SIZE[0] - 2 * MARGIN

    story = [
        Paragraph(escape(club_name()), subtitle),
        Paragraph("Reporte de control documental", title),
        Paragraph(escape(f"Generado el {generated_at:%d/%m/%Y %H:%M} · {filter_text(filters, personas)}"), subtitle),
        Spacer(1, 2 * mm),
        *[Paragraph(escape(line), styles["Normal"]) for line in summary_lines(padron_summary(personas))],
        Spacer(1, 6 * mm),
    ]

    if rows:
        story.append(table([HEADERS] + report_rows(rows, styles), [width * share for share in COLUMN_SHARES]))
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
        title="Reporte de control documental",
        author=club_name(),
        pageCompression=0,
    ).build(story)
    return buffer.getvalue()
