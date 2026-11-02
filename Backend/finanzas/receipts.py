import os
from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from configuracion.models import ConfiguracionGeneral
from configuracion.services import address_text, club_details, club_name

from .models import EstadoComprobanteChoices, MedioPago, TipoDevolucionChoices
from .pdf_utils import format_amount, table
from .services import RECEIPT_TYPE, receipt_code, receipt_detail, refund_code, socio_detail

WIDTH = A4[0] - 40 * mm
REFUND_TITLES = {TipoDevolucionChoices.MANUAL: "DEVOLUCIÓN X", TipoDevolucionChoices.NOTA_CREDITO: "NOTA DE CRÉDITO X"}
REFUND_FILENAMES = {TipoDevolucionChoices.MANUAL: "devolucion", TipoDevolucionChoices.NOTA_CREDITO: "nota-credito"}


def receipt_filename(receipt):
    return f"recibo-{receipt.numero:08d}.pdf"


def refund_filename(refund):
    return f"{REFUND_FILENAMES[refund.tipo]}-{refund.numero:08d}.pdf"


def render_period_label(period_str):
    try:
        y, m = period_str.split("-")
        months = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        return f"{months[int(m)]} de {y}"
    except Exception:
        return period_str


def build_periodos_rows(periodos, style):
    rows = []
    for p in periodos:
        rows.append([
            Paragraph(f"<b>{escape(render_period_label(p['periodo']))} ({escape(p['periodo'])})</b>", style),
            format_amount(p["monto_aplicado"]),
        ])
        for line in p.get("detalle", []):
            rows.append([
                Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;• {escape(line['concepto_nombre'])}", style),
                format_amount(line["monto"]),
            ])
    return rows


def document_styles():
    styles = getSampleStyleSheet()
    return {
        "normal": styles["Normal"],
        "title": ParagraphStyle("Titulo", parent=styles["Title"], alignment=0, spaceAfter=2),
        "subtitle": ParagraphStyle("Subtitulo", parent=styles["Normal"], textColor=colors.HexColor("#5f6368")),
        "club_name": ParagraphStyle(
            "ClubNombre",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            alignment=2,
            textColor=colors.HexColor("#5f6368"),
        ),
        "club_details": ParagraphStyle(
            "ClubDetalles",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            alignment=2,
            textColor=colors.HexColor("#5f6368"),
        ),
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


def get_club_logo_flowable(max_width=35 * mm, max_height=20 * mm):
    try:
        config = ConfiguracionGeneral.load()
        if config.club_logo and hasattr(config.club_logo, "path") and os.path.exists(config.club_logo.path):
            ext = os.path.splitext(config.club_logo.path)[1].lower()
            if ext in [".png", ".jpg", ".jpeg"]:
                img = Image(config.club_logo.path)
                aspect = img.imageHeight / float(img.imageWidth)
                w = min(max_width, max_height / aspect)
                h = w * aspect
                img.drawWidth = w
                img.drawHeight = h
                return img
    except Exception:
        pass
    return None


def get_club_header_flowable(styles):
    """Club identity: logo on the left, name & CUIT on top right, address & phone below."""
    config = ConfiguracionGeneral.load()
    logo = get_club_logo_flowable()

    name_text = escape(config.club_nombre or "Club Universitario de Berisso")
    cuit_text = f" · CUIT {escape(config.club_cuit)}" if config.club_cuit else ""
    line_1 = f"{name_text}{cuit_text}"

    addr_parts = []
    if (domicilio := address_text(config.club_domicilio)):
        addr_parts.append(domicilio)
    if config.club_telefono:
        addr_parts.append(f"Tel. {config.club_telefono}")
    if config.club_email:
        addr_parts.append(config.club_email)
    addr_line = " · ".join(escape(part) for part in addr_parts)

    info_paragraphs = [Paragraph(line_1, styles["club_name"])]
    if addr_line:
        info_paragraphs.append(Paragraph(addr_line, styles["club_details"]))

    if logo is not None:
        logo_col_width = logo.drawWidth + 6 * mm
        header_table = Table(
            [[logo, info_paragraphs]],
            colWidths=[logo_col_width, WIDTH - logo_col_width],
        )
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (0, 0), "LEFT"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        return header_table

    return info_paragraphs


def render_document(title, number, issued, socio, notes, sections, footer):
    """Common layout of every receipt: club, title and number, status notes, socio and the sections."""
    styles = document_styles()
    socio = socio or {}
    number_str = f"{number:08d}" if isinstance(number, int) else str(number)

    header = get_club_header_flowable(styles)
    story = []
    if isinstance(header, list):
        story.extend(header)
    else:
        story.append(header)

    story += [
        Spacer(1, 4 * mm),
        Paragraph(f"{title} - N° {number_str}", styles["title"]),
        Paragraph(escape(f"Documento no válido como factura · Fecha de emisión: {issued:%d/%m/%Y}"), styles["subtitle"]),
        Spacer(1, 4 * mm),
    ]
    for note in notes:
        story += [Spacer(1, 4 * mm), Paragraph(escape(note), styles["cancelled"])]

    socio_headers = ["Apellido y nombre", "DNI", "N° de socio"]
    socio_row = [f"{socio.get('apellido', '')}, {socio.get('nombre', '')}", socio.get("dni", ""), str(socio.get("numero_socio", ""))]
    col_widths = [WIDTH * 0.5, WIDTH * 0.25, WIDTH * 0.25]
    if socio.get("telefono"):
        socio_headers.append("Teléfono")
        socio_row.append(str(socio.get("telefono")))
        col_widths = [WIDTH * 0.4, WIDTH * 0.2, WIDTH * 0.2, WIDTH * 0.2]

    story += [
        Paragraph("Socio", styles["section"]),
        table(
            [socio_headers, socio_row],
            col_widths,
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
        title=f"{title} - N° {number_str}",
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
            + build_periodos_rows(detail["periodos"], styles["normal"])
            + [["Total abonado", format_amount(detail["monto_total"])]],
            [WIDTH * 0.6, WIDTH * 0.4],
            total_row=True,
        ))
    methods = [(method["medio_de_pago"], method["monto"]) for method in detail["medios"]]
    return render_document(
        f"RECIBO {detail['tipo']}",
        receipt.numero,
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
                ["Recibo X", "Fecha de emisión", "Importe"],
                [f"{cancelled.numero:08d}", cancelled.fecha_emision.strftime("%d/%m/%Y"), format_amount(cancelled.monto_total)],
            ],
            [WIDTH * 0.4, WIDTH * 0.3, WIDTH * 0.3],
        )))
    sections += [
        ("Medio de devolución", lambda styles: methods_table([(refund.medio_de_pago, refund.monto)])),
        ("Responsable", lambda styles: Paragraph(escape(refund.responsable), styles["normal"])),
    ]
    return render_document(
        REFUND_TITLES[refund.tipo],
        refund.numero,
        timezone.localtime(refund.fecha).date(),
        socio_detail(refund.cuenta_corriente.socio),
        [],
        sections,
        "Comprobante de uso interno. Asociación civil exenta.",
    )
