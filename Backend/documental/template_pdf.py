from io import BytesIO
from xml.sax.saxutils import escape

from django.utils.text import slugify
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from configuracion.services import club_name
from finanzas.receipts import FAINT, MUTED, crop_below_content, format_dni, get_club_logo_flowable, text_style

from .markdown import ORDERED, PARAGRAPH, inline_markdown, parse_markdown
from .services import PERFIL_JUGADOR

FULL = "completo"
STUB = "talon"
SCOPES = (FULL, STUB)

PAGE_WIDTH, _ = A4
MARGIN = 18 * mm
FRAME_PADDING = 6
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN - 2 * FRAME_PADDING
LABEL_WIDTH = 48 * mm
SIGNATURE_WIDTH = 70 * mm
SIGNATURE_GAP = 16 * mm
SIGNATURE_SPACE = 16 * mm
BLANK = " "
DATE_BLANK = "____ / ____ / ________"
FIELD_LINE = colors.HexColor("#c4c9ce")
CUT_HINT ="Recortar por la línea punteada y entregar el talón firmado al club"

STYLES = {
    "club": text_style("PlantillaClub", 10, "Helvetica-Bold", MUTED, TA_CENTER),
    "title": text_style("PlantillaTitulo", 16, "Helvetica-Bold", alignment=TA_CENTER, leading=20),
    "body": text_style("PlantillaCuerpo", 10, leading=14.5),
    "hint": text_style("PlantillaCorte", 7.5, "Helvetica-Oblique", FAINT, TA_CENTER),
    "stub_club": text_style("TalonClub", 8.5, "Helvetica-Bold", MUTED),
    "stub_title": text_style("TalonTitulo", 11, "Helvetica-Bold", leading=14),
    "section": text_style("TalonSeccion", 8.5, "Helvetica-Bold", MUTED),
    "label": text_style("TalonEtiqueta", 9, color=MUTED),
    "value": text_style("TalonValor", 10, "Helvetica-Bold"),
    "legend": text_style("TalonLeyenda", 9.5, leading=13.5),
    "signature": text_style("TalonFirma", 8, color=MUTED, alignment=TA_CENTER),
}


def template_filename(plantilla, subject, scope):
    suffix = "-talon" if scope == STUB else ""
    return f"{slugify(plantilla.titulo) or 'documento'}-{subject['persona'].dni}{suffix}.pdf"


def header_flowables(plantilla):
    logo = get_club_logo_flowable(max_width=40 * mm, max_height=24 * mm)
    if logo:
        logo.hAlign = "CENTER"
        top = [logo]
    else:
        top = [Paragraph(escape(club_name()), STYLES["club"])]
    return [*top, Spacer(1, 6 * mm), Paragraph(escape(plantilla.titulo), STYLES["title"]), Spacer(1, 7 * mm)]


def body_flowables(markdown):
    flowables = []
    for block in parse_markdown(markdown):
        if block["type"] == PARAGRAPH:
            flowables.append(Paragraph(block["text"], STYLES["body"]))
        else:
            ordered = block["type"] == ORDERED
            flowables.append(ListFlowable(
                [ListItem(Paragraph(item, STYLES["body"])) for item in block["items"]],
                bulletType="1" if ordered else "bullet",
                start=block["start"] if ordered else "•",
                bulletFormat="%s." if ordered else None,
                bulletFontName="Helvetica",
                bulletFontSize=10,
                leftIndent=7 * mm,
            ))
        flowables.append(Spacer(1, 3 * mm))
    return flowables


def cut_line():
    line = Table([[Paragraph(CUT_HINT, STYLES["hint"])]], colWidths=[CONTENT_WIDTH])
    line.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.8, FAINT, None, (4, 3)),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return line


def fields_table(rows):
    content = Table(
        [[Paragraph(escape(label), STYLES["label"]), Paragraph(escape(value), STYLES["value"])] for label, value in rows],
        colWidths=[LABEL_WIDTH, CONTENT_WIDTH - LABEL_WIDTH],
    )
    content.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("LINEBELOW", (1, 0), (1, -1), 0.5, FIELD_LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return content


def signatures_table(labels):
    widths = []
    captions = []
    for index, label in enumerate(labels):
        if index:
            widths.append(SIGNATURE_GAP)
            captions.append("")
        widths.append(SIGNATURE_WIDTH)
        captions.append(Paragraph(escape(label), STYLES["signature"]))
    signature_columns = range(0, len(widths), 2)
    content = Table([[""] * len(widths), captions], colWidths=widths, rowHeights=[SIGNATURE_SPACE, None])
    content.setStyle(TableStyle([
        *[("LINEABOVE", (column, 1), (column, 1), 0.8, MUTED) for column in signature_columns],
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 3),
    ]))
    content.hAlign = "CENTER"
    return content


def person_rows(plantilla, subject):
    persona = subject["persona"]
    rows = [("Nombre y apellido", f"{persona.nombre} {persona.apellido}"), ("DNI", format_dni(persona.dni))]
    if plantilla.mostrar_categoria and subject["categoria"]:
        rows.append(("Categoría a la que ingresa", subject["categoria"]))
    return rows


def guardian_rows(guardian):
    if guardian is None:
        return [("Nombre y apellido", BLANK), ("DNI", BLANK), ("Vínculo", BLANK)]
    persona = guardian.persona
    return [
        ("Nombre y apellido", f"{persona.nombre} {persona.apellido}"),
        ("DNI", format_dni(persona.dni)),
        ("Vínculo", guardian.relacion or BLANK),
    ]


def stub_flowables(plantilla, subject):
    flowables = [
        Paragraph(escape(club_name()), STYLES["stub_club"]),
        Paragraph(f"Talón de conformidad · {escape(plantilla.titulo)}", STYLES["stub_title"]),
        Spacer(1, 3 * mm),
        fields_table(person_rows(plantilla, subject)),
    ]
    if subject["menor"]:
        flowables += [
            Spacer(1, 4 * mm),
            Paragraph("RESPONSABLE LEGAL", STYLES["section"]),
            fields_table(guardian_rows(subject["responsable"])),
        ]
    flowables += [
        Spacer(1, 4 * mm),
        Paragraph(inline_markdown(plantilla.talon_leyenda), STYLES["legend"]),
        Spacer(1, 2 * mm),
        fields_table([("Fecha", DATE_BLANK)]),
    ]

    signatures = []
    if not subject["menor"] or plantilla.firma_jugador_menor:
        signatures.append("Firma del jugador" if subject["perfil"] == PERFIL_JUGADOR else "Firma del docente")
    if subject["menor"]:
        signatures.append("Firma del responsable legal")
    flowables.append(signatures_table(signatures))
    return [KeepTogether(flowables)]


def render_template_pdf(plantilla, subject, scope=FULL):
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title=plantilla.titulo,
    )
    story = stub_flowables(plantilla, subject)
    if scope == FULL:
        story = [
            *header_flowables(plantilla),
            *body_flowables(plantilla.cuerpo),
            Spacer(1, 6 * mm),
            cut_line(),
            Spacer(1, 6 * mm),
            *story,
        ]
    document.build(story)
    return buffer.getvalue()


def pdf_pages_to_png(pdf_bytes, scale=2):
    import pypdfium2 as pdfium
    from PIL import Image as PILImage

    pages = [page.render(scale=scale).to_pil() for page in pdfium.PdfDocument(pdf_bytes)]
    pages[-1] = crop_below_content(pages[-1])
    padding = round(MARGIN / 2 * scale)
    image = PILImage.new("RGB", (max(page.width for page in pages), sum(page.height for page in pages) + padding), "white")
    top = 0
    for page in pages:
        image.paste(page, (0, top))
        top += page.height
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
