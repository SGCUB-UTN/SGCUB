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
    FALTANTE,
    GENDER_PREFIX,
    NO_CATEGORY,
    PERFIL_DOCENTE,
    PERFIL_JUGADOR,
    POR_VENCER,
    VENCIDO,
    VIGENTE,
    category_label,
    filter_document_rows,
    padron_summary,
)

PAGE_SIZE = landscape(A4)
MOST_AFFECTED_LIMIT = 5
MARGIN = 15 * mm
COLUMN_SHARES = (0.24, 0.10, 0.10, 0.20, 0.16, 0.10, 0.10)
HEADERS = ["Jugador activo / Docente", "DNI", "Perfil", "Categoría", "Documento requerido", "Estado", "Vencimiento"]
STATE_LABELS = {VIGENTE: "Vigente", POR_VENCER: "Próximo a vencer", VENCIDO: "Vencido", FALTANTE: "Faltante"}
PROFILE_LABELS = {PERFIL_JUGADOR: "Jugador activo", PERFIL_DOCENTE: "Docente"}
FILTER_STATE_LABELS = {None: "Todos los documentos", VENCIDO: "Vencidos", POR_VENCER: "Próximos a vencer", FALTANTE: "Faltantes"}
FILTER_PROFILE_LABELS = {None: "Todos", PERFIL_JUGADOR: "Jugadores activos", PERFIL_DOCENTE: "Docentes"}
FILTER_GENDER_LABELS = {"M": "Todas las masculinas", "F": "Todas las femeninas"}


def padron_filename(generated_at):
    return f"reporte-documental-{generated_at:%Y%m%d-%H%M}.pdf"


def format_count(count, total):
    share = f"{count * 100 / total:.1f}".replace(".", ",") if total else "0,0"
    return f"{count} ({share}%)"


def summary_lines(summary):
    documents = summary["documentos"]
    total_documents = sum(documents.values())
    disabled = summary["inhabilitados_por_perfil"]
    lines = [
        f"Cumplimiento general: {str(summary['cumplimiento']).replace('.', ',')}% · "
        f"Habilitados: {summary['habilitados']} de {summary['total']} · Inhabilitados: {summary['inhabilitados']} "
        f"({disabled[PERFIL_JUGADOR]} jugadores activos, {disabled[PERFIL_DOCENTE]} docentes)",
        "Documentos: " + " · ".join(
            f"{STATE_LABELS[estado]}: {format_count(documents[estado], total_documents)}" for estado in STATE_LABELS
        ),
    ]
    if summary["categorias_afectadas"]:
        lines.append("Categorías más afectadas: " + ", ".join(
            f"{item['categoria']} ({item['inhabilitados']} de {item['total']})" for item in summary["categorias_afectadas"][:MOST_AFFECTED_LIMIT]
        ))
    return lines


def category_filter_label(categoria, personas):
    if categoria == NO_CATEGORY:
        return "Sin categoría"
    if categoria.startswith(GENDER_PREFIX):
        return FILTER_GENDER_LABELS[categoria.removeprefix(GENDER_PREFIX)]
    labels = {item["categoria_id"]: category_label(item) for persona in personas for item in persona["categorias"]}
    return labels.get(int(categoria), "Sin coincidencias")


def filter_text(filters, personas):
    parts = [
        f"Documentos: {FILTER_STATE_LABELS[filters['estado']]}",
        f"Perfil: {FILTER_PROFILE_LABELS[filters['perfil']]}",
    ]
    if filters["categoria"]:
        parts.append(f"Categoría: {category_filter_label(filters['categoria'], personas)}")
    if filters["q"].strip():
        parts.append(f"Búsqueda: \"{filters['q'].strip()}\"")
    return " · ".join(parts)


def report_rows(rows, styles):
    def cell(text):
        return Paragraph(escape(str(text or "—")), styles["Normal"])

    return [
        [
            cell(f"{persona['apellido']}, {persona['nombre']}"),
            persona["dni"],
            PROFILE_LABELS[persona["perfil"]],
            cell(", ".join(category_label(categoria) for categoria in persona["categorias"])),
            cell(documento["tipo_documento_nombre"]),
            STATE_LABELS[documento["estado"]],
            f"{documento['fecha_vencimiento']:%d/%m/%Y}" if documento["fecha_vencimiento"] else "—",
        ]
        for persona, documento in rows
    ]


def render_padron_pdf(personas, filters, generated_at):
    rows = filter_document_rows(personas, **filters)
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
        story.append(Paragraph("No hay documentos para los filtros seleccionados.", styles["Normal"]))

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
