from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from configuracion.services import club_details, club_name

from .models import EstadoComprobanteChoices, MedioPago
from .pdf_utils import format_amount, table
from .services import receipt_detail


def format_receipt_number(receipt_type, number):
    return f"{receipt_type} {number:08d}"


def receipt_filename(receipt):
    return f"comprobante-{receipt_detail(receipt)['tipo']}-{receipt.numero:08d}.pdf"


def render_period_label(period_str):
    try:
        y, m = period_str.split("-")
        months = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        return f"{months[int(m)]} de {y}"
    except Exception:
        return period_str

def build_periodos_rows(periodos):
    rows = []
    for p in periodos:
        rows.append([Paragraph(f"<b>{render_period_label(p['periodo'])}</b>"), format_amount(p["monto_aplicado"])])
        for line in p.get("detalle", []):
            rows.append([f"      • {line['concepto_nombre']}", format_amount(line["monto"])])
    return rows


def render_receipt_pdf(receipt):
    detail = receipt_detail(receipt)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Titulo", parent=styles["Title"], alignment=0, spaceAfter=2)
    subtitle = ParagraphStyle("Subtitulo", parent=styles["Normal"], textColor=colors.HexColor("#5f6368"))
    section = ParagraphStyle("Seccion", parent=styles["Heading3"], spaceBefore=10, spaceAfter=4)
    cancelled = ParagraphStyle("Anulado", parent=styles["Heading2"], textColor=colors.HexColor("#b3261e"))

    socio = detail["socio"] or {}
    width = A4[0] - 40 * mm
    story = [
        Paragraph(escape(club_name()), subtitle),
        *([Paragraph(escape(details), subtitle)] if (details := club_details()) else []),
        Paragraph(f"RECIBO {detail['tipo']}", title),
        Paragraph("Documento no válido como factura", subtitle),
        Spacer(1, 6 * mm),
        table(
            [
                ["Comprobante N°", "Fecha de emisión"],
                [
                    format_receipt_number(detail["tipo"], detail["numero"]),
                    detail["fecha_emision"].strftime("%d/%m/%Y"),
                ],
            ],
            [width / 2, width / 2],
        ),
    ]

    if detail["estado"] == EstadoComprobanteChoices.ANULADO:
        replacement = receipt.reemplazado_por
        note = "ANULADO"
        if replacement is not None:
            note += f" - Reemplazado por el comprobante {format_receipt_number(detail['tipo'], replacement.numero)}"
        story += [Spacer(1, 4 * mm), Paragraph(note, cancelled)]

    story += [
        Paragraph("Socio", section),
        table(
            [
                ["Apellido y nombre", "DNI", "N° de socio"],
                [
                    f"{socio.get('apellido', '')}, {socio.get('nombre', '')}",
                    socio.get("dni", ""),
                    str(socio.get("numero_socio", "")),
                ],
            ],
            [width * 0.5, width * 0.25, width * 0.25],
        ),
        Paragraph("Períodos abonados", section),
        table(
            [["Período / Concepto", "Importe"]]
            + build_periodos_rows(detail["periodos"])
            + [["Total abonado", format_amount(detail["monto_total"])]],
            [width * 0.6, width * 0.4],
            total_row=True,
        ),
        Paragraph("Medios de pago", section),
        table(
            [["Medio", "Monto"]]
            + [
                [MedioPago.label(method["medio_de_pago"]), format_amount(method["monto"])]
                for method in detail["medios"]
            ],
            [width * 0.6, width * 0.4],
        ),
        Spacer(1, 10 * mm),
        Paragraph("Recibo de uso interno. Asociación civil exenta.", subtitle),
    ]

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Recibo {format_receipt_number(detail['tipo'], detail['numero'])}",
        author=club_name(),
        pageCompression=0,
    ).build(story)
    return buffer.getvalue()
