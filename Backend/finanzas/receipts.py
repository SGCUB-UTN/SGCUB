from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from .models import EstadoComprobanteChoices, MedioDePagoChoices, TipoMovimientoOrigenChoices
from .pdf_utils import CLUB_NAME, format_amount, table
from .services import receipt_detail


MANUAL_MOVEMENT_PDF_META = {
    TipoMovimientoOrigenChoices.NOTA_CREDITO: {
        "doc_title": "NOTA DE CRÉDITO X",
        "code_prefix": "NC-X",
        "filename_prefix": "nota-credito-X",
        "total_label": "Total acreditado",
    },
    TipoMovimientoOrigenChoices.INGRESO_MANUAL: {
        "doc_title": "RECIBO X",
        "code_prefix": "X",
        "filename_prefix": "comprobante-ingreso-X",
        "total_label": "Total percibido",
    },
    TipoMovimientoOrigenChoices.EGRESO: {
        "doc_title": "COMPROBANTE DE EGRESO X",
        "code_prefix": "EGR-X",
        "filename_prefix": "comprobante-egreso-X",
        "total_label": "Total egresado",
    },
}


def format_receipt_number(receipt_type, number):
    return f"{receipt_type} {number:08d}"


def movement_number(movement):
    return movement.numero_comprobante or movement.pk


def receipt_filename(receipt):
    return f"comprobante-{receipt_detail(receipt)['tipo']}-{receipt.numero:08d}.pdf"


def manual_movement_filename(movement):
    meta = MANUAL_MOVEMENT_PDF_META.get(movement.origen_manual, {
        "filename_prefix": "comprobante-movimiento-X",
    })
    return f"{meta['filename_prefix']}-{movement_number(movement):08d}.pdf"


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
        Paragraph(CLUB_NAME, subtitle),
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
                [MedioDePagoChoices(method["medio_de_pago"]).label, format_amount(method["monto"])]
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
        author=CLUB_NAME,
        pageCompression=0,
    ).build(story)
    return buffer.getvalue()


def render_manual_movement_pdf(movement):
    meta = MANUAL_MOVEMENT_PDF_META.get(movement.origen_manual, {
        "doc_title": "COMPROBANTE DE MOVIMIENTO X",
        "code_prefix": "X",
        "total_label": "Importe total",
    })
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Titulo", parent=styles["Title"], alignment=0, spaceAfter=2)
    subtitle = ParagraphStyle("Subtitulo", parent=styles["Normal"], textColor=colors.HexColor("#5f6368"))
    section = ParagraphStyle("Seccion", parent=styles["Heading3"], spaceBefore=10, spaceAfter=4)
    cancelled = ParagraphStyle("Revertido", parent=styles["Heading2"], textColor=colors.HexColor("#b3261e"))

    socio = getattr(movement.cuenta_corriente, "socio", None)
    persona = getattr(socio, "persona", None)
    receipt_code = format_receipt_number(meta["code_prefix"], movement_number(movement))
    width = A4[0] - 40 * mm

    story = [
        Paragraph(CLUB_NAME, subtitle),
        Paragraph(meta["doc_title"], title),
        Paragraph("Documento no válido como factura", subtitle),
        Spacer(1, 6 * mm),
        table(
            [
                ["Comprobante N°", "Fecha de emisión"],
                [
                    receipt_code,
                    movement.fecha.strftime("%d/%m/%Y"),
                ],
            ],
            [width / 2, width / 2],
        ),
    ]

    try:
        reversion = movement.reversion
    except Exception:
        reversion = None

    if reversion is not None:
        note = (
            f"REVERTIDO POR NOTA DE CRÉDITO "
            f"{format_receipt_number('NC-X', movement_number(reversion))} ({format_amount(reversion.monto)})"
        )
        story += [Spacer(1, 4 * mm), Paragraph(note, cancelled)]

    story += [
        Paragraph("Socio", section),
        table(
            [
                ["Apellido y nombre", "DNI", "N° de socio"],
                [
                    f"{getattr(persona, 'apellido', '')}, {getattr(persona, 'nombre', '')}" if persona else "—",
                    getattr(persona, "dni", "") if persona else "—",
                    str(getattr(socio, "numero_socio", "")) if socio else "—",
                ],
            ],
            [width * 0.5, width * 0.25, width * 0.25],
        ),
        Paragraph("Conceptos", section),
        table(
            [
                ["Concepto / Detalle", "Importe"],
                [Paragraph(movement.concepto or "—", styles["Normal"]), format_amount(movement.monto)],
                [meta["total_label"], format_amount(movement.monto)],
            ],
            [width * 0.65, width * 0.35],
            total_row=True,
        ),
    ]

    if movement.movimiento_revertido_id and movement.movimiento_revertido is not None:
        original = movement.movimiento_revertido
        story += [
            Paragraph("Ingreso original revertido", section),
            table(
                [
                    ["Comprobante original", "Fecha original", "Concepto original", "Importe original"],
                    [
                        format_receipt_number("X", movement_number(original)),
                        original.fecha.strftime("%d/%m/%Y"),
                        Paragraph(original.concepto or "—", styles["Normal"]),
                        format_amount(original.monto),
                    ],
                ],
                [width * 0.22, width * 0.18, width * 0.38, width * 0.22],
            ),
        ]

    payment_label = (
        MedioDePagoChoices(movement.medio_de_pago).label
        if movement.medio_de_pago
        else "Ajuste en cuenta corriente"
    )
    story += [
        Paragraph("Medio de operación", section),
        table(
            [
                ["Medio", "Monto"],
                [payment_label, format_amount(movement.monto)],
            ],
            [width * 0.6, width * 0.4],
        ),
        Spacer(1, 10 * mm),
        Paragraph("Comprobante de uso interno. Asociación civil exenta.", subtitle),
    ]

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"{meta['doc_title']} {receipt_code}",
        author=CLUB_NAME,
        pageCompression=0,
    ).build(story)
    return buffer.getvalue()
