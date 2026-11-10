import os
from io import BytesIO
from xml.sax.saxutils import escape

from django.conf import settings
from django.db.models import Max
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from configuracion.services import club_name
from documental.models import Documento
from finanzas.pdf_utils import format_phone
from finanzas.receipts import format_dni, get_club_logo_flowable
from padron.models import VinculoFamiliar

PAGE_WIDTH, PAGE_HEIGHT = A4
PAGE_GUTTER = 12 * mm
INNER_WIDTH = PAGE_WIDTH - 2 * PAGE_GUTTER

ON_SURFACE = colors.HexColor("#0b1c30")
MUTED = colors.HexColor("#3e4850")
FAINT = colors.HexColor("#787f85")
PRIMARY = colors.HexColor("#006493")
BORDER = colors.HexColor("#eceff2")
DIVIDER = colors.HexColor("#f2f4f6")
HEADER_BACKGROUND = colors.HexColor("#f9fbff")
SECTION_BACKGROUND = colors.HexColor("#eff4ff")

HEADER, PLAIN, SECTION, ITEM, FOOTER, FILL = "header", "plain", "section", "item", "footer", "fill"
ROW_PADDING = {
    HEADER: (4 * mm, 4 * mm),
    PLAIN: (8, 8),
    SECTION: (5, 6),
    ITEM: (5, 5),
    FOOTER: (8, 6 * mm),
    FILL: (0, 0),
}
ROW_BACKGROUNDS = {
    HEADER: HEADER_BACKGROUND,
    SECTION: SECTION_BACKGROUND,
    FOOTER: HEADER_BACKGROUND,
}


def text_style(name, size=9, font="Helvetica", color=ON_SURFACE, alignment=0, leading=None):
    return ParagraphStyle(
        name,
        fontName=font,
        fontSize=size,
        leading=leading or round(size * 1.35, 1),
        textColor=color,
        alignment=alignment,
    )


STYLES = {
    "title": text_style("Titulo", 12, "Helvetica-Bold", PRIMARY, alignment=0, leading=15),
    "subtitle": text_style("Subtitulo", 8.5, "Helvetica-Bold", ON_SURFACE, alignment=0, leading=11),
    "date": text_style("Fecha", 7.5, color=MUTED, alignment=0, leading=10),
    "section": text_style("Seccion", 9.5, "Helvetica-Bold"),
    "caption": text_style("Rotulo", 7.5, "Helvetica-Bold", MUTED),
    "label": text_style("Etiqueta", 7, color=MUTED),
    "value": text_style("Valor", 8.5, "Helvetica-Bold"),
    "text": text_style("Texto", 8.5, color=MUTED),
    "strong": text_style("Destacado", 8.5, "Helvetica-Bold"),
    "empty": text_style("Vacio", 8, "Helvetica-Oblique", FAINT),
    "footer": text_style("Pie", 7.5, color=MUTED, alignment=TA_CENTER),
}


def _format_fecha(fecha):
    if not fecha:
        return "—"
    if hasattr(fecha, "strftime"):
        return fecha.strftime("%d/%m/%Y")
    try:
        parts = str(fecha).split("-")
        if len(parts) == 3:
            return f"{parts[2]}/{parts[1]}/{parts[0]}"
    except Exception:
        pass
    return str(fecha)


def _domicilio_texto(domicilio):
    if not domicilio:
        return "—"
    partes = [f"{domicilio.calle} {domicilio.numero}".strip()]
    if domicilio.piso or domicilio.departamento:
        extra = []
        if domicilio.piso:
            extra.append(f"Piso {domicilio.piso}")
        if domicilio.departamento:
            extra.append(f"Dpto {domicilio.departamento}")
        partes.append(", ".join(extra))
    if domicilio.barrio:
        partes.append(f"B° {domicilio.barrio.nombre}")
    if domicilio.localidad:
        partes.append(domicilio.localidad.nombre)
    return ", ".join(p for p in partes if p)


def paragraph(text, style):
    return Paragraph(escape(str(text)), STYLES[style])


def grid(rows, widths, extra_style=()):
    content = Table(rows, colWidths=widths)
    content.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        *extra_style,
    ]))
    return content


def field_cell(label, value):
    val_str = str(value).strip() if value not in (None, "") else "—"
    return [
        paragraph(label, "label"),
        Spacer(1, 2),
        paragraph(val_str, "value"),
    ]


def photo_carnet(persona, width=24 * mm, height=30 * mm):
    if persona and persona.foto:
        try:
            if hasattr(persona.foto, "path") and os.path.exists(persona.foto.path):
                return Image(persona.foto.path, width=width, height=height)
        except Exception:
            pass

    ph_style = text_style("FotoPlaceholder", 7, alignment=TA_CENTER, color=FAINT)
    ph_p = Paragraph("Foto<br/>Carnet", ph_style)
    t = Table([[ph_p]], colWidths=[width], rowHeights=[height])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), HEADER_BACKGROUND),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def header_block(jugador):
    persona = jugador.socio.persona
    logo = get_club_logo_flowable(max_width=26 * mm, max_height=20 * mm)
    foto = photo_carnet(persona, width=24 * mm, height=30 * mm)

    title_block = [
        paragraph("PLANILLA DE DATOS DEL JUGADOR", "title"),
        Spacer(1, 2),
        paragraph("FICHA PARA COMET / LIGA", "subtitle"),
        Spacer(1, 2),
        paragraph(f"Emisión: {timezone.localtime():%d/%m/%Y %H:%M}", "date"),
    ]

    photo_col_width = 28 * mm
    alignments = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (-1, 0), (-1, 0), "RIGHT"),
    ]

    if logo is None:
        return grid(
            [[title_block, foto]],
            [INNER_WIDTH - photo_col_width, photo_col_width],
            alignments,
        )

    logo_width = logo.drawWidth + 8
    return grid(
        [[logo, title_block, foto]],
        [logo_width, INNER_WIDTH - logo_width - photo_col_width, photo_col_width],
        alignments,
    )


def personal_data_block(jugador):
    persona = jugador.socio.persona
    genero_str = persona.genero.nombre if persona.genero else (persona.genero_otro or "—")
    nac_edad = f"{_format_fecha(persona.fecha_nacimiento)}"
    if persona.edad is not None:
        nac_edad += f" ({persona.edad} años)"

    fields = [
        [
            field_cell("Apellido", persona.apellido),
            field_cell("Nombre", persona.nombre),
            field_cell("DNI", format_dni(persona.dni)),
        ],
        [
            field_cell("Fecha de nacimiento", nac_edad),
            field_cell("Género", genero_str),
            field_cell("Nivel de educación", jugador.get_nivel_educacion_display() or "—"),
        ],
        [
            field_cell("Teléfono", format_phone(persona.telefono) if persona.telefono else "—"),
            field_cell("Correo electrónico", persona.email or "—"),
            field_cell("Domicilio", _domicilio_texto(persona.domicilio)),
        ],
    ]

    col_w = INNER_WIDTH / 3.0
    t = Table(fields, colWidths=[col_w, col_w, col_w])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def deportivos_block(jugador):
    cat_ppal = jugador.categoria.nombre if jugador.categoria else "—"
    cat_sec = jugador.categoria_secundaria.nombre if jugador.categoria_secundaria else "Ninguna"

    fields = [
        [
            field_cell("Club", club_name()),
            field_cell("N° de socio", str(jugador.socio.numero_socio or "—")),
            field_cell("Obra social", jugador.obra_social or "—"),
        ],
        [
            field_cell("Categoría principal", cat_ppal),
            field_cell("Categoría secundaria", cat_sec),
            field_cell("Talle indumentaria", jugador.tallaIndumentaria or "—"),
        ],
    ]

    col_w = INNER_WIDTH / 3.0
    t = Table(fields, colWidths=[col_w, col_w, col_w])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def vinculos_rows(jugador):
    vinculos = list(VinculoFamiliar.objects.filter(jugador=jugador).select_related("persona"))
    col_widths = [INNER_WIDTH * 0.22, INNER_WIDTH * 0.38, INNER_WIDTH * 0.18, INNER_WIDTH * 0.22]

    if not vinculos:
        empty_content = grid([[paragraph("No se registran vínculos familiares o contactos cargados en el legajo.", "empty")]], [INNER_WIDTH])
        return [(empty_content, ITEM)]

    header_cells = [
        paragraph("VÍNCULO", "caption"),
        paragraph("NOMBRE Y APELLIDO", "caption"),
        paragraph("DNI", "caption"),
        paragraph("TELÉFONO", "caption"),
    ]
    header_grid = grid([header_cells], col_widths, [("BOTTOMPADDING", (0, 0), (-1, -1), 2)])

    rows = [(header_grid, ITEM)]
    for v in vinculos:
        nombre_v = f"{v.persona.nombre} {v.persona.apellido}".strip() or "—"
        rel = f"{v.relacion}{' (Resp. Legal)' if v.responsable_legal else ''}"
        tel_fmt = format_phone(v.persona.telefono) if v.persona.telefono else "—"
        dni_fmt = format_dni(v.persona.dni) if v.persona.dni else "—"

        cells = [
            paragraph(rel or "Tutor", "strong"),
            paragraph(nombre_v, "value"),
            paragraph(dni_fmt, "text"),
            paragraph(tel_fmt, "text"),
        ]
        rows.append((
            grid([cells], col_widths, [("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]),
            ITEM,
        ))
    return rows


def documentacion_rows(jugador):
    persona = jugador.socio.persona
    latest_ids = (
        Documento.objects.filter(persona=persona)
        .values("tipo_documento")
        .annotate(latest=Max("id_documento"))
        .values("latest")
    )
    docs = list(
        Documento.objects.filter(id_documento__in=latest_ids, estado_documento__nombre="Vigente")
        .select_related("tipo_documento", "estado_documento")
        .order_by("tipo_documento__nombre")
    )
    col_widths = [INNER_WIDTH * 0.34, INNER_WIDTH * 0.22, INNER_WIDTH * 0.22, INNER_WIDTH * 0.22]

    if not docs:
        empty_content = grid([[paragraph("No se registra documentación vigente cargada en el legajo.", "empty")]], [INNER_WIDTH])
        return [(empty_content, ITEM)]

    header_cells = [
        paragraph("DOCUMENTO", "caption"),
        paragraph("ESTADO", "caption"),
        paragraph("FECHA EMISIÓN", "caption"),
        paragraph("FECHA VENCIMIENTO", "caption"),
    ]
    header_grid = grid([header_cells], col_widths, [("BOTTOMPADDING", (0, 0), (-1, -1), 2)])

    rows = [(header_grid, ITEM)]
    for d in docs:
        doc_nombre = d.tipo_documento.nombre if d.tipo_documento else (d.nombre or "Documento")
        estado_nombre = d.estado_documento.nombre if d.estado_documento else "—"
        emision_str = _format_fecha(d.fecha_emision)
        venc_str = _format_fecha(d.fecha_vencimiento) if d.fecha_vencimiento else "Sin vencimiento"

        cells = [
            paragraph(doc_nombre, "strong"),
            paragraph(estado_nombre, "value" if estado_nombre.lower() == "vigente" else "text"),
            paragraph(emision_str, "text"),
            paragraph(venc_str, "text"),
        ]
        rows.append((
            grid([cells], col_widths, [("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]),
            ITEM,
        ))
    return rows


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


def build_player_rows(jugador):
    return [
        (header_block(jugador), HEADER),
        (paragraph("1. DATOS PERSONALES", "section"), SECTION),
        (personal_data_block(jugador), PLAIN),
        (paragraph("2. DATOS DEPORTIVOS Y DEL CLUB", "section"), SECTION),
        (deportivos_block(jugador), PLAIN),
        (paragraph("3. VÍNCULOS FAMILIARES Y CONTACTOS DE EMERGENCIA", "section"), SECTION),
        *vinculos_rows(jugador),
        (paragraph("4. DOCUMENTACIÓN", "section"), SECTION),
        *documentacion_rows(jugador),
        (paragraph(f"Planilla de datos para uso administrativo · {club_name()}", "footer"), FOOTER),
    ]


def generar_planilla_jugador_pdf(jugador) -> bytes:
    buffer = BytesIO()
    rows = build_player_rows(jugador)
    document = BaseDocTemplate(
        buffer,
        pagesize=A4,
        title=f"Planilla COMET - {jugador.socio.persona.apellido}, {jugador.socio.persona.nombre}",
        author=club_name(),
        pageCompression=0,
    )
    document.addPageTemplates([PageTemplate(frames=[Frame(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 0, 0, 0, 0)])])
    document.build([page_frame(rows)])
    return buffer.getvalue()


def generar_planillas_categoria_pdf(jugadores) -> bytes:
    buffer = BytesIO()
    document = BaseDocTemplate(
        buffer,
        pagesize=A4,
        title="Planillas COMET - Categoría",
        author=club_name(),
        pageCompression=0,
    )
    document.addPageTemplates([PageTemplate(frames=[Frame(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 0, 0, 0, 0)])])
    story = []
    for idx, jugador in enumerate(jugadores):
        if idx > 0:
            story.append(PageBreak())
        story.append(page_frame(build_player_rows(jugador)))
    document.build(story)
    return buffer.getvalue()
