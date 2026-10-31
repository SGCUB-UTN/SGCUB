from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, TableStyle

from configuracion.services import club_name

from .pdf_utils import format_amount, table

PAGE_SIZE = landscape(A4)
MARGIN = 15 * mm
COLUMN_SHARES = (0.26, 0.10, 0.09, 0.17, 0.11, 0.13, 0.14)
HEADERS = ["Socio / Jugador", "DNI", "Tipo", "Categoría", "Cuotas adeudadas", "Recargos por mora", "Monto deuda"]


def delinquency_filename(report):
    return f"reporte-morosidad-{report['fecha']:%Y%m%d-%H%M}.pdf"


def report_rows(rows, styles):
    def cell(text):
        return Paragraph(escape(str(text or "—")), styles["Normal"])

    return [
        [
            cell(f"{row['apellido']}, {row['nombre']}"),
            row["dni"],
            row["tipo"],
            cell(row["categoria_deportiva"]) if row["tipo"] == "Jugador" else "—",
            str(row["cuotas_vencidas"]),
            format_amount(row["recargos"]),
            format_amount(row["monto_adeudado"]),
        ]
        for row in rows
    ]


def total_row(rows):
    total_debt = sum((row["monto_adeudado"] for row in rows), Decimal("0.00"))
    total_cuotas = sum(row["cuotas_vencidas"] for row in rows)
    total_fees = sum((row["recargos"] for row in rows), Decimal("0.00"))
    return [f"Total: {len(rows)} morosos", "", "", "", str(total_cuotas), format_amount(total_fees), format_amount(total_debt)]


def summary_text(report):
    monto_total = report.get("monto_total", Decimal("0.00"))
    padron = report.get("padron", len(report.get("filas", [])))
    porcentaje = report.get("porcentaje_morosidad", Decimal("0.00"))
    categorias = report.get("categorias_afectadas", [])
    parts = [
        f"Monto total adeudado: {format_amount(monto_total)}",
        f"Morosos: {len(report.get('filas', []))} de {padron}",
        f"Morosidad: {porcentaje}%".replace(".", ","),
    ]
    if categorias:
        category = categorias[0]
        parts.append(f"Categoría más afectada: {category['nombre']} ({format_amount(category['monto'])})")
    return " · ".join(parts)


def render_delinquency_pdf(report):
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Titulo", parent=styles["Title"], alignment=0, spaceAfter=2)
    subtitle = ParagraphStyle("Subtitulo", parent=styles["Normal"], textColor=colors.HexColor("#5f6368"))

    width = PAGE_SIZE[0] - 2 * MARGIN
    rows = report["filas"]
    tipo = report.get("tipo", "Todos")
    periodo = report.get("periodo", "Todos los períodos")
    story = [
        Paragraph(escape(club_name()), subtitle),
        Paragraph("Reporte de morosidad", title),
        Paragraph(escape(
            f"Generado el {report['fecha']:%d/%m/%Y %H:%M} · Alcance: {report['alcance']} · "
            f"Tipo: {tipo} · Período: {periodo}"
        ), subtitle),
        Spacer(1, 2 * mm),
        Paragraph(escape(summary_text(report)), styles["Normal"]),
        Spacer(1, 6 * mm),
    ]

    if rows:
        content = table(
            [HEADERS] + report_rows(rows, styles) + [total_row(rows)],
            [width * share for share in COLUMN_SHARES],
            total_row=True,
            right_aligned_from=4,
        )
        content.setStyle(TableStyle([("SPAN", (0, -1), (3, -1))]))
        story.append(content)
    else:
        story.append(Paragraph("No hay socios con deuda vencida para los filtros seleccionados.", styles["Normal"]))

    if report["sin_cuenta"]:
        story += [
            Spacer(1, 4 * mm),
            Paragraph(f"{report['sin_cuenta']} socio(s) del alcance no tienen cuenta corriente y no se incluyeron.", subtitle),
        ]

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=PAGE_SIZE,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title="Reporte de morosidad",
        author=club_name(),
        pageCompression=0,
    ).build(story)
    return buffer.getvalue()
