from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from configuracion.services import club_name

from .pdf_utils import format_amount, table
from .receipts import get_club_logo_flowable

PAGE_SIZE = A4
MARGIN = 15 * mm
LOGO_COLUMN = 30 * mm
FULL_SHARE = Decimal("100.0")
MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
MUTED = colors.HexColor("#5f6368")


def financial_summary_filename(period_str):
    return f"resumen-financiero-{period_str}.pdf"


def period_label(period):
    year, month = period.split("-")
    return f"{MONTHS[int(month) - 1].capitalize()} {year}"


def format_percentage(value):
    return "—" if value is None else f"{value}%".replace(".", ",")


def share_of(amount, total):
    return None if not total else (Decimal(amount) * 100 / Decimal(total)).quantize(Decimal("0.1"))


def receipts_label(count):
    return f"{count} comprobante" if count == 1 else f"{count} comprobantes"


def kpi_table(pairs, width):
    return table([[label for label, _ in pairs], [value for _, value in pairs]], [width / len(pairs)] * len(pairs))


def detail_table(headers, rows, shares, width, total=None, empty_text=""):
    if not rows:
        return Paragraph(empty_text, getSampleStyleSheet()["Normal"])
    body = [headers, *rows]
    if total is not None:
        body.append(total)
    return table(body, [width * share for share in shares], total_row=total is not None, right_aligned_from=-1)


def header_block(label, styles, width):
    club_style = ParagraphStyle("Club", parent=styles["Normal"], textColor=MUTED)
    title_style = ParagraphStyle("Titulo", parent=styles["Title"], alignment=0, spaceBefore=0, spaceAfter=2)
    meta_style = ParagraphStyle("Meta", parent=styles["Normal"], textColor=MUTED)
    text = [
        Paragraph(escape(club_name()), club_style),
        Paragraph("Resumen financiero", title_style),
        Paragraph(f"Período: {label} · Generado el {timezone.localtime():%d/%m/%Y %H:%M}", meta_style),
    ]
    logo = get_club_logo_flowable(max_width=24 * mm, max_height=24 * mm)
    if logo is None:
        return text
    block = Table([[logo, text]], colWidths=[LOGO_COLUMN, width - LOGO_COLUMN], hAlign="LEFT")
    block.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [block]


def render_financial_summary_pdf(summary):
    styles = getSampleStyleSheet()
    section_style = ParagraphStyle("Seccion", parent=styles["Heading3"], spaceBefore=8, spaceAfter=3, keepWithNext=1)
    note_style = ParagraphStyle("Nota", parent=styles["Normal"], fontSize=9, leading=12, textColor=MUTED, spaceBefore=3)
    sub_row_style = ParagraphStyle("Subfila", parent=styles["Normal"], leftIndent=4 * mm, textColor=MUTED)
    width = PAGE_SIZE[0] - 2 * MARGIN
    label = period_label(summary["periodo"])
    income = summary["ingresos"]
    cuotas = summary["cuotas"]
    refunds = summary["devoluciones"]

    def cell(text, style=styles["Normal"]):
        return Paragraph(escape(text or "—"), style)

    def note(text):
        return Paragraph(escape(text), note_style)

    def share_row(name, share):
        return [cell(name), format_percentage(share["porcentaje"]), format_amount(share["monto"])]

    def concept_row(row, style=styles["Normal"]):
        return [cell(row["nombre"], style), format_percentage(row["porcentaje"]), format_amount(row["monto"])]

    def income_row(name, amount, count):
        return [cell(name), receipts_label(count), format_percentage(share_of(amount, income["total"])), format_amount(amount)]

    methods = [row for row in summary["medios_de_pago"]["medios"] if row["monto"]]

    story = [
        *header_block(label, styles, width),
        Spacer(1, 5 * mm),
        Paragraph(f"Ingresos de {label}", section_style),
        detail_table(
            ["Origen", "Comprobantes", "Porcentaje", "Monto"],
            [
                income_row("Cuotas", income["cuotas"], income["cantidad_cuotas"]),
                income_row("Otros ingresos", income["extra"], income["cantidad_extra"]),
            ],
            (0.4, 0.2, 0.15, 0.25),
            width,
            ["Total ingresado", receipts_label(income["cantidad_cuotas"] + income["cantidad_extra"]), "", format_amount(income["total"])],
        ),
        note(f"Comprobantes emitidos en {label} que siguen vigentes. Un ingreso anulado deja de contar."),
        Paragraph(f"Cuotas de {label}", section_style),
        kpi_table([
            ("Total a cobrar", format_amount(cuotas["esperado"])),
            ("Cobrado", format_amount(cuotas["cobrado"])),
            ("Pendiente", format_amount(cuotas["en_deuda"])),
        ], width),
        Spacer(1, 2 * mm),
        kpi_table([
            ("% cobrado", format_percentage(cuotas["efectividad"])),
            ("Cuotas pagas", f"{cuotas['pagas']} de {cuotas['generadas']}"),
            ("Recargos por mora", format_amount(cuotas["recargos"])),
        ], width),
        note(f"Son las cuotas de {label} y lo cobrado de ellas hasta hoy, aunque se hayan pagado en otro mes. Por eso puede no coincidir con las cuotas de los ingresos del mes."),
        Paragraph("Otros ingresos", section_style),
        detail_table(
            ["Concepto", "Porcentaje", "Monto"],
            [concept_row(row) for row in summary["ingresos_extra"]["conceptos"]],
            (0.5, 0.2, 0.3),
            width,
            ["Total", format_percentage(FULL_SHARE), format_amount(summary["ingresos_extra"]["total"])],
            "No hubo otros ingresos en el período.",
        ),
        Paragraph("Devoluciones", section_style),
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
        note("Las devoluciones no restan de los ingresos. Una devolución manual devuelve dinero que nunca se registró como ingreso, y una nota de crédito sale de un comprobante que ya está anulado."),
        Paragraph("Ingresos por medio de pago", section_style),
        detail_table(
            ["Medio", "Porcentaje", "Monto"],
            [[row["nombre"], format_percentage(row["porcentaje"]), format_amount(row["monto"])] for row in methods],
            (0.5, 0.2, 0.3),
            width,
            ["Total ingresado", "", format_amount(summary["medios_de_pago"]["total"])],
            "No hubo ingresos en el período.",
        ),
        Paragraph("Evolución anual de cobranza (cuotas)", section_style),
        detail_table(
            ["Período", "Total a cobrar", "Cobrado", "% cobrado"],
            [
                [period_label(row["periodo"]), format_amount(row["facturado"]), format_amount(row["cobrado"]), format_percentage(row["efectividad"])]
                for row in summary["evolucion"]
            ],
            (0.31, 0.25, 0.25, 0.19),
            width,
        ),
        note("Para cada mes: lo emitido en cuotas y lo cobrado de ellas hasta hoy."),
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
