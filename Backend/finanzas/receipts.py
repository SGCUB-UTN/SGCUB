import os
from io import BytesIO
from xml.sax.saxutils import escape

from django.conf import settings
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import BaseDocTemplate, Frame, Image, PageTemplate, Paragraph, Spacer, Table, TableStyle

from configuracion.models import ConfiguracionGeneral
from configuracion.services import address_text, club_name

from .models import EstadoComprobanteChoices, MedioPago, TipoDevolucionChoices
from .pdf_utils import format_amount
from .services import receipt_code, receipt_detail, refund_code, socio_detail

PAGE_WIDTH, PAGE_HEIGHT = A4
PAGE_GUTTER = 12 * mm
INNER_WIDTH = PAGE_WIDTH - 2 * PAGE_GUTTER
AMOUNT_COLUMNS = [INNER_WIDTH * 0.7, INNER_WIDTH * 0.3]
RECEIPT_BLOCK_WIDTH = 60 * mm
DEFAULT_CLUB_NAME = "Club Universitario de Berisso"
RECEIPT_FOOTER = "Recibo de uso interno · Asociación civil sin fines de lucro exenta"
REFUND_FOOTER = "Comprobante de uso interno · Asociación civil sin fines de lucro exenta"
REFUND_TITLES = {TipoDevolucionChoices.MANUAL: "DEVOLUCIÓN X", TipoDevolucionChoices.NOTA_CREDITO: "NOTA DE CRÉDITO X"}
REFUND_FILENAMES = {TipoDevolucionChoices.MANUAL: "devolucion", TipoDevolucionChoices.NOTA_CREDITO: "nota-credito"}
MONTHS = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

ON_SURFACE = colors.HexColor("#0b1c30")
MUTED = colors.HexColor("#3e4850")
FAINT = colors.HexColor("#787f85")
PRIMARY = colors.HexColor("#006493")
ERROR = colors.HexColor("#ba1a1a")
DISCOUNT = colors.HexColor("#047857")
BORDER = colors.HexColor("#eceff2")
DIVIDER = colors.HexColor("#f2f4f6")
HEADER_BACKGROUND = colors.HexColor("#f9fbff")
SECTION_BACKGROUND = colors.HexColor("#eff4ff")
TOTAL_BACKGROUND = colors.HexColor("#f4f7ff")
NOTICE_BACKGROUND = colors.HexColor("#fff4f3")
BULLET_HEX = "#dee3e8"
FAINT_HEX = "#787f85"
WATERMARK_TEXT = "ANULADO"
WATERMARK_FONT = "Helvetica-Bold"
WATERMARK_ALPHA = 0.18

HEADER, PLAIN, SECTION, ITEM, TOTAL, NOTICE, FILL, FOOTER = "header", "plain", "section", "item", "total", "notice", "fill", "footer"
ROW_PADDING = {HEADER: (10 * mm, 16), PLAIN: (12, 12), SECTION: (5, 6), ITEM: (7, 7), TOTAL: (8, 8), NOTICE: (7, 7), FILL: (0, 0), FOOTER: (10, 8 * mm)}
ROW_BACKGROUNDS = {
    HEADER: HEADER_BACKGROUND,
    SECTION: SECTION_BACKGROUND,
    TOTAL: TOTAL_BACKGROUND,
    NOTICE: NOTICE_BACKGROUND,
    FOOTER: HEADER_BACKGROUND,
}


def text_style(name, size=9, font="Helvetica", color=ON_SURFACE, alignment=0, leading=None):
    return ParagraphStyle(name, fontName=font, fontSize=size, leading=leading or round(size * 1.35, 1), textColor=color, alignment=alignment)


STYLES = {
    "club": text_style("Club", 13, "Helvetica-Bold", leading=16),
    "club_detail": text_style("ClubDetalle", 7.5, color=MUTED),
    "title": text_style("Titulo", 13, "Helvetica-Bold", alignment=TA_RIGHT, leading=16),
    "number": text_style("Numero", 11, "Courier-Bold", alignment=TA_RIGHT, leading=14),
    "date": text_style("Fecha", 7.5, color=MUTED, alignment=TA_RIGHT),
    "disclaimer": text_style("Aclaracion", 7, "Helvetica-Oblique", FAINT, TA_RIGHT),
    "annulment": text_style("Anulacion", 7.5, "Helvetica-Bold", ERROR, TA_RIGHT),
    "caption": text_style("Rotulo", 7.5, "Helvetica-Bold", MUTED),
    "label": text_style("Etiqueta", 7.5, color=MUTED),
    "value": text_style("Valor", 9, "Helvetica-Bold"),
    "missing": text_style("Faltante", 9, "Helvetica-BoldOblique", FAINT),
    "section": text_style("Seccion", 10, "Helvetica-Bold"),
    "strong": text_style("Destacado", 9, "Helvetica-Bold"),
    "strong_right": text_style("DestacadoDerecha", 9, "Helvetica-Bold", alignment=TA_RIGHT),
    "text": text_style("Texto", 9, color=MUTED),
    "text_right": text_style("TextoDerecha", 9, color=MUTED, alignment=TA_RIGHT),
    "discount_right": text_style("DescuentoDerecha", 9, "Helvetica-Bold", DISCOUNT, TA_RIGHT),
    "body": text_style("Cuerpo", 9),
    "note": text_style("Nota", 7.5, "Helvetica-Oblique", MUTED),
    "note_right": text_style("NotaDerecha", 7.5, "Helvetica-Oblique", MUTED, TA_RIGHT),
    "total": text_style("Total", 10, "Helvetica-Bold"),
    "total_amount": text_style("TotalMonto", 13, "Helvetica-Bold", PRIMARY, TA_RIGHT, 16),
    "notice": text_style("Aviso", 8.5, "Helvetica-Bold", ERROR),
    "footer": text_style("Pie", 7.5, color=MUTED, alignment=TA_CENTER),
}


def receipt_filename(receipt):
    return f"recibo-{receipt.numero:08d}.pdf"


def refund_filename(refund):
    return f"{REFUND_FILENAMES[refund.tipo]}-{refund.numero:08d}.pdf"


def render_period_label(period_str):
    try:
        y, m = period_str.split("-")
        return f"{MONTHS[int(m)]} de {y}"
    except Exception:
        return period_str


def render_month_label(period_str):
    try:
        return MONTHS[int(period_str.split("-")[1])]
    except Exception:
        return period_str


def format_dni(dni):
    if not dni:
        return "—"
    return f"{int(dni):,}".replace(",", ".") if str(dni).isdigit() else str(dni)


def paragraph(text, style):
    return Paragraph(escape(str(text)), STYLES[style])


def grid(rows, widths, extra_style=()):
    content = Table(rows, colWidths=widths)
    content.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        *extra_style,
    ]))
    return content


def amount_row(label, amount, label_style="text", amount_style="strong_right"):
    return grid([[paragraph(label, label_style), paragraph(format_amount(amount), amount_style)]], AMOUNT_COLUMNS)


def get_club_logo_flowable(max_width=26 * mm, max_height=14 * mm):
    try:
        config = ConfiguracionGeneral.load()
        logo_path = None
        if config.club_logo:
            try:
                if hasattr(config.club_logo, "path") and os.path.exists(config.club_logo.path):
                    logo_path = config.club_logo.path
            except Exception:
                pass

        if not logo_path or not os.path.exists(logo_path):
            fixture_path = os.path.join(settings.BASE_DIR, "configuracion", "fixtures", "escudo-sin-fondo.png")
            if os.path.exists(fixture_path):
                logo_path = fixture_path

        if logo_path and os.path.exists(logo_path):
            ext = os.path.splitext(logo_path)[1].lower()
            if ext in [".png", ".jpg", ".jpeg"]:
                img = Image(logo_path)
                aspect = img.imageHeight / float(img.imageWidth)
                w = min(max_width, max_height / aspect)
                h = w * aspect
                img.drawWidth = w
                img.drawHeight = h
                return img
    except Exception:
        pass
    return None


def labeled(label, value):
    return f'<font color="{FAINT_HEX}">{escape(label)}</font> {escape(value)}'


def club_block(config):
    lines = [paragraph(config.club_nombre or DEFAULT_CLUB_NAME, "club")]
    if config.club_cuit:
        lines.append(Paragraph(labeled("CUIT:", config.club_cuit), STYLES["club_detail"]))
    if (address := address_text(config.club_domicilio)):
        lines.append(Paragraph(labeled("Dirección:", address), STYLES["club_detail"]))
    contact = []
    if config.club_telefono:
        contact.append(labeled("Tel:", config.club_telefono))
    if config.club_email:
        contact.append(escape(config.club_email))
    if contact:
        lines.append(Paragraph(f' <font color="{BULLET_HEX}">·</font> '.join(contact), STYLES["club_detail"]))
    return lines


def receipt_block(title, code, issued, annulment):
    return [
        paragraph(title, "title"),
        Spacer(1, 2),
        paragraph(f"N° {code.split()[-1]}", "number"),
        *([Spacer(1, 1), paragraph(annulment, "annulment")] if annulment else []),
        Spacer(1, 2),
        paragraph(f"Fecha: {issued:%d/%m/%Y}", "date"),
        Spacer(1, 2),
        paragraph("Documento no válido como factura", "disclaimer"),
    ]


def header_block(title, code, issued, annulment):
    config = ConfiguracionGeneral.load()
    logo = get_club_logo_flowable()
    receipt = receipt_block(title, code, issued, annulment)
    club = club_block(config)
    align_receipt = [("ALIGN", (-1, 0), (-1, 0), "RIGHT")]
    if logo is None:
        return grid([[club, receipt]], [INNER_WIDTH - RECEIPT_BLOCK_WIDTH, RECEIPT_BLOCK_WIDTH], align_receipt)
    logo_width = logo.drawWidth + 10
    return grid(
        [[logo, club, receipt]],
        [logo_width, INNER_WIDTH - logo_width - RECEIPT_BLOCK_WIDTH, RECEIPT_BLOCK_WIDTH],
        align_receipt,
    )


def socio_block(socio):
    name = ", ".join(part for part in (socio.get("apellido"), socio.get("nombre")) if part) or "—"
    number = socio.get("numero_socio")
    phone = socio.get("telefono")
    fields = [
        ("Apellido y nombre", name, "value"),
        ("DNI", format_dni(socio.get("dni")), "value"),
        ("N° de socio", "—" if number is None else number, "value"),
        ("Teléfono", phone or "No registrado", "value" if phone else "missing"),
    ]
    cells = [[paragraph(label, "label"), paragraph(value, style)] for label, value, style in fields]
    return [
        paragraph("DATOS DEL SOCIO", "caption"),
        Spacer(1, 6),
        grid([cells], [INNER_WIDTH * 0.36, INNER_WIDTH * 0.2, INNER_WIDTH * 0.2, INNER_WIDTH * 0.24], [("VALIGN", (0, 0), (-1, -1), "TOP")]),
    ]


def section(title, rows):
    return [(paragraph(title, "section"), SECTION)] + rows


def period_block(period):
    partial = period.get("es_parcial")
    label = render_period_label(period["periodo"]) + (" (Pago parcial)" if partial else "")
    rows = [[paragraph(label, "strong"), paragraph(format_amount(period["monto_aplicado"]), "strong_right")]]
    for line in period.get("detalle", []):
        bullet = f'<font color="{BULLET_HEX}">•</font>&nbsp;&nbsp;{escape(line["concepto_nombre"])}'
        rows.append([
            Paragraph(bullet, STYLES["text"]),
            paragraph(format_amount(line["monto"]), "discount_right" if line["monto"] < 0 else "text_right"),
        ])
    if partial:
        rows.append([
            paragraph(f"Saldo pendiente período {render_month_label(period['periodo'])}:", "note"),
            paragraph(format_amount(period["saldo_pendiente"]), "note_right"),
        ])
    return grid(rows, AMOUNT_COLUMNS, [
        ("TOPPADDING", (0, 1), (-1, -1), 3),
        ("LEFTPADDING", (0, 1), (0, -1), 3),
    ])


def period_rows(periods):
    if not periods:
        return [(paragraph("Sin períodos imputados.", "text"), ITEM)]
    return [(period_block(period), ITEM) for period in periods]


def concept_rows(concept, amount):
    return [(amount_row(concept or "—", amount, "strong"), ITEM)]


def method_rows(methods):
    return [(amount_row(MedioPago.label(code), amount), ITEM) for code, amount in methods]


def total_row(label, amount, color=PRIMARY):
    amount_style = ParagraphStyle("TotalMontoColor", parent=STYLES["total_amount"], textColor=color)
    return (grid([[paragraph(label, "total"), Paragraph(format_amount(amount), amount_style)]], AMOUNT_COLUMNS), TOTAL)


def info_row(label, value):
    return ([paragraph(label, "label"), Spacer(1, 2), paragraph(value, "body")], PLAIN)


def notice_rows(notes):
    return [(paragraph(note, "notice"), NOTICE) for note in notes]


def frame(rows):
    kinds = [kind for _, kind in rows]
    content = Table([[cell] for cell, _ in rows], colWidths=[PAGE_WIDTH])
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), PAGE_GUTTER),
        ("RIGHTPADDING", (0, 0), (-1, -1), PAGE_GUTTER),
    ]
    for index, kind in enumerate(kinds):
        top, bottom = ROW_PADDING[kind]
        style += [("TOPPADDING", (0, index), (0, index), top), ("BOTTOMPADDING", (0, index), (0, index), bottom)]
        if kind in ROW_BACKGROUNDS:
            style.append(("BACKGROUND", (0, index), (0, index), ROW_BACKGROUNDS[kind]))
        if index < len(kinds) - 1:
            color = DIVIDER if kind == ITEM and kinds[index + 1] == ITEM else BORDER
            style.append(("LINEBELOW", (0, index), (0, index), 0.5, color))
    content.setStyle(TableStyle(style))
    return content


def page_frame(rows):
    content = frame(rows)
    _, height = content.wrap(PAGE_WIDTH, PAGE_HEIGHT)
    if height >= PAGE_HEIGHT - 1:
        return content
    return frame([*rows[:-1], (Spacer(1, PAGE_HEIGHT - height - 1), FILL), rows[-1]])


def draw_watermark(canvas, center_y, available_height):
    unit_width = stringWidth(WATERMARK_TEXT, WATERMARK_FONT, 1)
    size = min(110, 0.8 * min(INNER_WIDTH, available_height) / (0.71 * (unit_width + 1)))
    canvas.saveState()
    canvas.setFillColor(ERROR)
    canvas.setFillAlpha(WATERMARK_ALPHA)
    canvas.setFont(WATERMARK_FONT, size)
    canvas.translate(PAGE_WIDTH / 2, center_y)
    canvas.rotate(45)
    canvas.drawCentredString(0, -size * 0.35, WATERMARK_TEXT)
    canvas.restoreState()


def watermark_callback(rows):
    _, height = frame(rows).wrap(PAGE_WIDTH, PAGE_HEIGHT)
    available = min(height, PAGE_HEIGHT)
    return lambda canvas, document: draw_watermark(canvas, PAGE_HEIGHT - available / 2, available)


def render_document(title, code, issued, socio, notes, body, footer, is_cancelled=False, annulment=None, fill_page=True):
    rows = [
        (header_block(title, code, issued, annulment), HEADER),
        *notice_rows(notes),
        (socio_block(socio or {}), PLAIN),
        *body,
        (paragraph(footer, "footer"), FOOTER),
    ]
    document_title = f"{title} - N° {code.split()[-1]}" + (" (ANULADO)" if is_cancelled else "")
    buffer = BytesIO()
    document = BaseDocTemplate(
        buffer,
        pagesize=A4,
        title=document_title,
        author=club_name(),
        pageCompression=0,
    )
    page_events = {"onPageEnd": watermark_callback(rows)} if is_cancelled else {}
    document.addPageTemplates([PageTemplate(frames=[Frame(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 0, 0, 0, 0)], **page_events)])
    document.build([page_frame(rows) if fill_page else frame(rows)])
    return buffer.getvalue()


def annulment_line(payment):
    if payment.fecha_anulacion:
        return f"Anulado el {timezone.localtime(payment.fecha_anulacion):%d/%m/%Y}"
    return "Anulado"


def receipt_notes(receipt):
    if receipt.estado != EstadoComprobanteChoices.ANULADO:
        return []
    notes = []
    for credit_note in receipt.notas_credito.order_by("pk"):
        notes.append(f"Devuelto por nota de crédito {refund_code(credit_note)} ({format_amount(credit_note.monto)})")
    return notes


def render_receipt_pdf(receipt, fill_page=True):
    detail = receipt_detail(receipt)
    is_cancelled = receipt.estado == EstadoComprobanteChoices.ANULADO
    if detail["es_ingreso"]:
        body = section("Concepto", concept_rows(detail["concepto"], detail["monto_total"]))
    else:
        body = section("Períodos abonados", period_rows(detail["periodos"]))
    methods = [(method["medio_de_pago"], method["monto"]) for method in detail["medios"]]
    body += section("Detalle del cobro", method_rows(methods) + [total_row("Total abonado", detail["monto_total"])])
    if receipt.pago.observacion:
        body.append(info_row("Observación", receipt.pago.observacion))
    return render_document(
        f"RECIBO {detail['tipo']}",
        receipt_code(receipt),
        detail["fecha_emision"],
        detail["socio"],
        receipt_notes(receipt),
        body,
        RECEIPT_FOOTER,
        is_cancelled=is_cancelled,
        annulment=annulment_line(receipt.pago) if is_cancelled else None,
        fill_page=fill_page,
    )


def render_refund_pdf(refund, fill_page=True):
    body = section("Concepto", concept_rows(refund.concepto, refund.monto))
    cancelled = refund.comprobante_anulado
    if cancelled is not None:
        label = f"Recibo {receipt_code(cancelled)} · Emitido el {cancelled.fecha_emision:%d/%m/%Y}"
        body += section("Comprobante anulado", [(amount_row(label, cancelled.monto_total), ITEM)])
    body += section("Medio de devolución", method_rows([(refund.medio_de_pago, refund.monto)]) + [total_row("Total devuelto", refund.monto, ERROR)])
    return render_document(
        REFUND_TITLES[refund.tipo],
        refund_code(refund),
        timezone.localtime(refund.fecha).date(),
        socio_detail(refund.cuenta_corriente.socio),
        [],
        body,
        REFUND_FOOTER,
        fill_page=fill_page,
    )


def crop_below_content(image):
    from PIL import Image as PILImage, ImageChops

    bbox = ImageChops.difference(image, PILImage.new(image.mode, image.size, (255, 255, 255))).getbbox()
    return image.crop((0, 0, image.width, bbox[3])) if bbox else image


def pdf_to_png(pdf_bytes, scale=2.5):
    import pypdfium2 as pdfium

    page = pdfium.PdfDocument(pdf_bytes)[0]
    buf = BytesIO()
    crop_below_content(page.render(scale=scale).to_pil()).save(buf, format="PNG")
    return buf.getvalue()


def render_receipt_image(receipt, scale=2.5):
    return pdf_to_png(render_receipt_pdf(receipt, fill_page=False), scale=scale)


def render_refund_image(refund, scale=2.5):
    return pdf_to_png(render_refund_pdf(refund, fill_page=False), scale=scale)
