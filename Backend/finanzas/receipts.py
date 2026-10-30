from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from configuracion.services import club_details, club_name

from .models import EstadoComprobanteChoices, MedioPago, TipoDevolucionChoices
from .pdf_utils import format_amount, table
from .services import RECEIPT_TYPE, receipt_code, receipt_detail, refund_code, socio_detail

WIDTH = A4[0] - 40 * mm
REFUND_TITLES = {TipoDevolucionChoices.MANUAL: "DEVOLUCIÓN X", TipoDevolucionChoices.NOTA_CREDITO: "NOTA DE CRÉDITO X"}
REFUND_FILENAMES = {TipoDevolucionChoices.MANUAL: "devolucion", TipoDevolucionChoices.NOTA_CREDITO: "nota-credito"}


def receipt_filename(receipt):
    return f"comprobante-{RECEIPT_TYPE}-{receipt.numero:08d}.pdf"


def refund_filename(refund):
    return f"{REFUND_FILENAMES[refund.tipo]}-{refund.numero:08d}.pdf"


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
        rows.append([Paragraph(f"<b>{render_period_label(p['periodo'])} ({p['periodo']})</b>"), format_amount(p["monto_aplicado"])])
        for line in p.get("detalle", []):
            rows.append([f"      • {line['concepto_nombre']}", format_amount(line["monto"])])
    return rows


def document_styles():
    styles = getSampleStyleSheet()
    return {
        "normal": styles["Normal"],
        "title": ParagraphStyle("Titulo", parent=styles["Title"], alignment=0, spaceAfter=2),
        "subtitle": ParagraphStyle("Subtitulo", parent=styles["Normal"], textColor=colors.HexColor("#5f6368")),
        "section": ParagraphStyle("Seccion", parent=styles["Heading3"], spaceBefore=10, spaceAfter=4),
        "cancelled": ParagraphStyle("Anulado", parent=styles["Heading2"], textColor=colors.HexColor("#b3261e")),
    }


def concept_table(concept, amount, total_label, style):
    return table(
        [
            ["Concepto", "Importe"],
            [Paragraph(escape(concept or "—"), style), format_amount(amount)],
            [total_label, format_amount(amount)],
        ],
        [WIDTH * 0.6, WIDTH * 0.4],
        total_row=True,
    )


def methods_table(methods):
    return table(
        [["Medio", "Monto"]] + [[MedioPago.label(code), format_amount(amount)] for code, amount in methods],
        [WIDTH * 0.6, WIDTH * 0.4],
    )


def render_document(title, code, issued, socio, notes, sections, footer):
    """Common layout of every receipt: club, title and number, status notes, socio and the sections."""
    styles = document_styles()
    socio = socio or {}
    story = [
        Paragraph(escape(club_name()), styles["subtitle"]),
        *([Paragraph(escape(details), styles["subtitle"])] if (details := club_details()) else []),
        Paragraph(title, styles["title"]),
        Paragraph("Documento no válido como factura", styles["subtitle"]),
        Spacer(1, 6 * mm),
        table([["Comprobante N°", "Fecha de emisión"], [code, issued.strftime("%d/%m/%Y")]], [WIDTH / 2, WIDTH / 2]),
    ]
    for note in notes:
        story += [Spacer(1, 4 * mm), Paragraph(escape(note), styles["cancelled"])]
    story += [
        Paragraph("Socio", styles["section"]),
        table(
            [
                ["Apellido y nombre", "DNI", "N° de socio"],
                [f"{socio.get('apellido', '')}, {socio.get('nombre', '')}", socio.get("dni", ""), str(socio.get("numero_socio", ""))],
            ],
            [WIDTH * 0.5, WIDTH * 0.25, WIDTH * 0.25],
        ),
    ]
    for heading, content in sections:
        story += [Paragraph(heading, styles["section"]), content(styles)]
    story += [Spacer(1, 10 * mm), Paragraph(footer, styles["subtitle"])]

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"{title} {code}",
        author=club_name(),
        pageCompression=0,
    ).build(story)
    return buffer.getvalue()


def receipt_notes(receipt):
    if receipt.estado != EstadoComprobanteChoices.ANULADO:
        return []
    notes = ["ANULADO"]
    for credit_note in receipt.notas_credito.order_by("pk"):
        notes.append(f"Devuelto por nota de crédito {refund_code(credit_note)} ({format_amount(credit_note.monto)})")
    return notes


def render_receipt_pdf(receipt):
    detail = receipt_detail(receipt)
    if detail["es_ingreso"]:
        content = ("Concepto", lambda styles: concept_table(detail["concepto"], detail["monto_total"], "Total abonado", styles["normal"]))
    else:
        content = ("Períodos abonados", lambda styles: table(
            [["Período / Concepto", "Importe"]]
            + build_periodos_rows(detail["periodos"])
            + [["Total abonado", format_amount(detail["monto_total"])]],
            [WIDTH * 0.6, WIDTH * 0.4],
            total_row=True,
        ))
    methods = [(method["medio_de_pago"], method["monto"]) for method in detail["medios"]]
    return render_document(
        f"RECIBO {detail['tipo']}",
        receipt_code(receipt),
        detail["fecha_emision"],
        detail["socio"],
        receipt_notes(receipt),
        [content, ("Medios de pago", lambda styles: methods_table(methods))],
        "Recibo de uso interno. Asociación civil exenta.",
    )


def render_refund_pdf(refund):
    sections = [("Concepto", lambda styles: concept_table(refund.concepto, refund.monto, "Total devuelto", styles["normal"]))]
    cancelled = refund.comprobante_anulado
    if cancelled is not None:
        sections.append(("Comprobante anulado", lambda styles: table(
            [
                ["Comprobante", "Fecha de emisión", "Importe"],
                [receipt_code(cancelled), cancelled.fecha_emision.strftime("%d/%m/%Y"), format_amount(cancelled.monto_total)],
            ],
            [WIDTH * 0.4, WIDTH * 0.3, WIDTH * 0.3],
        )))
    sections += [
        ("Medio de devolución", lambda styles: methods_table([(refund.medio_de_pago, refund.monto)])),
        ("Responsable", lambda styles: Paragraph(escape(refund.responsable), styles["normal"])),
    ]
    return render_document(
        REFUND_TITLES[refund.tipo],
        refund_code(refund),
        timezone.localtime(refund.fecha).date(),
        socio_detail(refund.cuenta_corriente.socio),
        [],
        sections,
        "Comprobante de uso interno. Asociación civil exenta.",
    )
