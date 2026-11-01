from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from configuracion.services import club_name

from .pdf_utils import format_amount, table

PAGE_SIZE = A4
MARGIN = 15 * mm
FULL_SHARE = Decimal("100.0")
MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def financial_summary_filename(period_str):
    return f"resumen-financiero-{period_str}.pdf"


def period_label(period):
    year, month = period.split("-")
    return f"{MONTHS[int(month) - 1].capitalize()} {year}"


def format_percentage(value):
    return "—" if value is None else f"{value}%".replace(".", ",")


def kpi_table(pairs, width):
    """Labels on top, values below."""
    return table([[label for label, _ in pairs], [value for _, value in pairs]], [width / len(pairs)] * len(pairs))


def detail_table(headers, rows, shares, width, total=None, empty_text=""):
    if not rows:
        return Paragraph(empty_text, getSampleStyleSheet()["Normal"])
    body = [headers, *rows]
    if total is not None:
        body.append(total)
    return table(body, [width * share for share in shares], total_row=total is not None, right_aligned_from=-1)


def render_financial_summary_pdf(summary):
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Titulo", parent=styles["Title"], alignment=0, spaceAfter=2)
    subtitle_style = ParagraphStyle("Subtitulo", parent=styles["Normal"], textColor=colors.HexColor("#5f6368"))
    section_style = ParagraphStyle("Seccion", parent=styles["Heading3"], spaceBefore=8, spaceAfter=3)
    width = PAGE_SIZE[0] - 2 * MARGIN
    label = period_label(summary["periodo"])
    sub_row_style = ParagraphStyle("Subfila", parent=styles["Normal"], leftIndent=4 * mm, textColor=colors.HexColor("#5f6368"))
    income = summary["ingresos"]
    cuotas = summary["cuotas"]
    refunds = summary["devoluciones"]

    def cell(text, style=styles["Normal"]):
        return Paragraph(escape(text or "—"), style)

    def share_row(label, share):
        return [cell(label), format_percentage(share["porcentaje"]), format_amount(share["monto"])]

    def concept_row(row, style=styles["Normal"]):
        return [cell(row["nombre"], style), format_percentage(row["porcentaje"]), format_amount(row["monto"])]

    story = [
        Paragraph(escape(club_name()), subtitle_style),
        Paragraph("Resumen financiero", title_style),
        Paragraph(f"Período: {label} · Generado el {timezone.localtime():%d/%m/%Y %H:%M}", subtitle_style),
        Spacer(1, 4 * mm),
        Paragraph("Origen de los ingresos", section_style),
        detail_table(
            ["Origen", "Porcentaje", "Monto"],
            [[row["nombre"], format_percentage(row["porcentaje"]), format_amount(row["monto"])] for row in income["origen"]],
            (0.5, 0.2, 0.3),
            width,
            ["Total ingresado", "", format_amount(income["total"])],
        ),
        Paragraph(f"Análisis de cuotas del período {label}", section_style),
        kpi_table([
            ("Facturado esperado", format_amount(cuotas["esperado"])),
            ("Cobranza real", format_amount(cuotas["cobrado"])),
            ("En deuda", format_amount(cuotas["en_deuda"])),
        ], width),
        Spacer(1, 2 * mm),
        kpi_table([
            ("Efectividad", format_percentage(cuotas["efectividad"])),
            ("Volumen (pagas / generadas)", f"{cuotas['pagas']} / {cuotas['generadas']}"),
            ("Recargos aplicados", format_amount(cuotas["recargos"])),
        ], width),
        Paragraph("Otros ingresos", section_style),
        detail_table(
            ["Concepto", "Porcentaje", "Monto"],
            [concept_row(row) for row in summary["ingresos_extra"]["conceptos"]],
            (0.5, 0.2, 0.3),
            width,
            ["Total", format_percentage(FULL_SHARE), format_amount(summary["ingresos_extra"]["total"])],
            "No hubo otros ingresos en el período.",
        ),
        Paragraph("Ingresos por medio de pago", section_style),
        detail_table(
            ["Medio", "Porcentaje", "Monto"],
            [
                [row["nombre"], format_percentage(row["porcentaje"]), format_amount(row["monto"])]
                for row in summary["medios_de_pago"]["medios"]
            ],
            (0.5, 0.2, 0.3),
            width,
            ["Total ingresado", "", format_amount(summary["medios_de_pago"]["total"])],
        ),
        Paragraph("Devoluciones (no restan de los ingresos)", section_style),
        detail_table(
            ["Tipo", "Porcentaje", "Monto"],
            [
                share_row("Notas de crédito", refunds["notas_credito"]),
                share_row("Devoluciones manuales", refunds["manuales"]),
                *[concept_row(row, sub_row_style) for row in refunds["manuales"]["conceptos"]],
            ] if refunds["total"] else [],
            (0.5, 0.2, 0.3),
            width,
            ["Total", format_percentage(FULL_SHARE), format_amount(refunds["total"])],
            "No hubo devoluciones en el período.",
        ),
        Paragraph("Evolución anual de cobranza (cuotas)", section_style),
        detail_table(
            ["Período", "Facturado", "Cobrado", "Efectividad"],
            [
                [period_label(row["periodo"]), format_amount(row["facturado"]), format_amount(row["cobrado"]), format_percentage(row["efectividad"])]
                for row in summary["evolucion"]
            ],
            (0.31, 0.25, 0.25, 0.19),
            width,
        ),
    ]

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=PAGE_SIZE,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title=f"Resumen financiero {label}",
        author=club_name(),
        pageCompression=0,
    ).build(story)
    return buffer.getvalue()
