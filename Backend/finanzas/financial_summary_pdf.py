from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, TableStyle

from .pdf_utils import CLUB_NAME, format_amount, table

PAGE_SIZE = landscape(A4)
MARGIN = 15 * mm

TABLE_HEADERS = [
    "N° Socio",
    "Apellido y nombre",
    "DNI",
    "Deuda en fecha",
    "Vencidas 1° venc.",
    "Vencidas 2° venc.",
    "Deuda vencida",
]
COLUMN_SHARES = (0.08, 0.28, 0.12, 0.15, 0.11, 0.11, 0.15)


def financial_summary_filename(period_str):
    return f"informe-financiero-{period_str}.pdf"


def _kpi_summary_table(pairs, width):
    """Two-row summary table: header labels on top, values below."""
    col_width = width / len(pairs)
    return table(
        [[p[0] for p in pairs], [p[1] for p in pairs]],
        [col_width] * len(pairs),
    )


def _debtor_rows(debtors):
    return [
        [
            str(row["numero_socio"] or "—"),
            f"{row['apellido']}, {row['nombre']}",
            row["dni"],
            format_amount(row["deuda_en_fecha"]),
            str(row["cuotas_vencidas_1"]),
            str(row["cuotas_vencidas_2"]),
            format_amount(row["deuda_vencida"]),
        ]
        for row in debtors
    ]


def _total_row(debtors):
    total_en_fecha = sum((r["deuda_en_fecha"] for r in debtors), Decimal("0.00"))
    total_vencidas_1 = sum(r["cuotas_vencidas_1"] for r in debtors)
    total_vencidas_2 = sum(r["cuotas_vencidas_2"] for r in debtors)
    total_deuda_vencida = sum((r["deuda_vencida"] for r in debtors), Decimal("0.00"))
    return [
        f"Total: {len(debtors)} socios con deuda",
        "",
        "",
        format_amount(total_en_fecha),
        str(total_vencidas_1),
        str(total_vencidas_2),
        format_amount(total_deuda_vencida),
    ]


def render_financial_summary_pdf(report):
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Titulo", parent=styles["Title"], alignment=0, spaceAfter=2)
    subtitle_style = ParagraphStyle("Subtitulo", parent=styles["Normal"], textColor=colors.HexColor("#5f6368"))
    section_style = ParagraphStyle("Seccion", parent=styles["Heading3"], spaceBefore=8, spaceAfter=3)

    width = PAGE_SIZE[0] - 2 * MARGIN
    debtors = report["deudores"]

    story = [
        Paragraph(CLUB_NAME, subtitle_style),
        Paragraph("Informe Contable Financiero", title_style),
        Paragraph(
            f"Período: {report['periodo_label']} · Generado el {report['fecha']:%d/%m/%Y %H:%M}",
            subtitle_style,
        ),
        Spacer(1, 6 * mm),
        Paragraph(f"Resumen del período — {report['periodo_label']}", section_style),
        _kpi_summary_table([
            ("Cuotas generadas", str(report["cuotas_generadas"])),
            ("Cuotas pagas", str(report["cuotas_pagas"])),
            ("Cuotas impagas", str(report["cuotas_impagas"])),
            ("Total recaudado en el período", format_amount(report["total_recaudado_periodo"])),
        ], width),
        Spacer(1, 4 * mm),
        Paragraph("Resumen general", section_style),
        _kpi_summary_table([
            ("Socios en mora", str(report["socios_en_mora"])),
            ("Monto adeudado total", format_amount(report["monto_adeudado_total"])),
            ("Cuotas vencidas a la fecha", str(report["cuotas_vencidas"])),
            ("Vencidas en 1° vencimiento", str(report["cuotas_vencidas_1"])),
            ("Vencidas en 2° vencimiento", str(report["cuotas_vencidas_2"])),
        ], width),
        Spacer(1, 4 * mm),
        Paragraph("Recaudación por medio de cobro (acumulado histórico)", section_style),
        _kpi_summary_table([
            ("Transferencia bancaria", format_amount(report["transferencia_bancaria"])),
            ("Billetera virtual / QR", format_amount(report["billetera_virtual"])),
            ("Pago en efectivo", format_amount(report["pago_efectivo"])),
        ], width),
        Spacer(1, 6 * mm),
        Paragraph("Socios con deuda pendiente", section_style),
    ]

    if debtors:
        debtor_table = table(
            [TABLE_HEADERS] + _debtor_rows(debtors) + [_total_row(debtors)],
            [width * share for share in COLUMN_SHARES],
            total_row=True,
            right_aligned_from=3,
        )
        debtor_table.setStyle(TableStyle([("SPAN", (0, -1), (2, -1))]))
        story.append(debtor_table)
    else:
        story.append(Paragraph("No hay socios con deuda pendiente al momento de la generación.", styles["Normal"]))

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=PAGE_SIZE,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title=f"Informe Financiero {report['periodo_label']}",
        author=CLUB_NAME,
        pageCompression=0,
    ).build(story)
    return buffer.getvalue()
