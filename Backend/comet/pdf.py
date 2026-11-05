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

from configuracion.models import ConfiguracionGeneral
from configuracion.services import address_text, club_name
from finanzas.pdf_utils import format_phone
from finanzas.receipts import format_dni, get_club_logo_flowable
from padron.models import VinculoFamiliar
from .eligibility import apto_fisico_vencimiento

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
BULLET_HEX = "#dee3e8"
FAINT_HEX = "#787f85"

HEADER, PLAIN, SECTION, ITEM, FOOTER, FILL = "header", "plain", "section", "item", "footer", "fill"
ROW_PADDING = {
    HEADER: (8 * mm, 12),
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
    "club": text_style("Club", 12, "Helvetica-Bold", leading=15),
    "club_detail": text_style("ClubDetalle", 7.5, color=MUTED),
    "title": text_style("Titulo", 12, "Helvetica-Bold", PRIMARY, TA_RIGHT, leading=15),
    "subtitle": text_style("Subtitulo", 8, "Helvetica-Bold", ON_SURFACE, TA_RIGHT),
    "date": text_style("Fecha", 7.5, color=MUTED, alignment=TA_RIGHT),
    "disclaimer": text_style("Aclaracion", 7, "Helvetica-Oblique", FAINT, TA_RIGHT),
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


def labeled(label, value):
    return f'<font color="{FAINT_HEX}">{escape(label)}</font> {escape(value)}'


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


def club_block(config):
    lines = [paragraph(config.club_nombre or "Club Universitario de Berisso", "club")]
    if config.club_cuit:
        lines.append(Paragraph(labeled("CUIT:", config.club_cuit), STYLES["club_detail"]))
    if (address := address_text(config.club_domicilio)):
        lines.append(Paragraph(labeled("Dirección:", address), STYLES["club_detail"]))
    contact = []
    if config.club_telefono:
        contact.append(labeled("Tel:", format_phone(config.club_telefono)))
    if config.club_email:
        contact.append(escape(config.club_email))
    if contact:
        lines.append(Paragraph(f' <font color="{BULLET_HEX}">·</font> '.join(contact), STYLES["club_detail"]))
    return lines


def header_block():
    config = ConfiguracionGeneral.load()
    logo = get_club_logo_flowable(max_width=26 * mm, max_height=14 * mm)
    club = club_block(config)
    title_block = [
        paragraph("PLANILLA DE DATOS DEL JUGADOR", "title"),
        Spacer(1, 2),
        paragraph("FICHA PARA COMET / LIGA", "subtitle"),
        Spacer(1, 2),
        paragraph(f"Emisión: {timezone.localtime():%d/%m/%Y %H:%M}", "date"),
        Spacer(1, 1),
        paragraph("Documento de uso interno para carga federativa", "disclaimer"),
    ]
    right_width = 80 * mm
    align_right = [("ALIGN", (-1, 0), (-1, 0), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]
    if logo is None:
        return grid([[club, title_block]], [INNER_WIDTH - right_width, right_width], align_right)
    logo_width = logo.drawWidth + 8
    return grid(
        [[logo, club, title_block]],
        [logo_width, INNER_WIDTH - logo_width - right_width, right_width],
        align_right,
    )


def photo_carnet(persona, width=26 * mm, height=32 * mm):
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


def personal_data_block(jugador):
    persona = jugador.socio.persona
    foto = photo_carnet(persona)

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
            field_cell("Nacionalidad", "Argentina"),
        ],
        [
            field_cell("Teléfono", format_phone(persona.telefono) if persona.telefono else "—"),
            field_cell("Correo electrónico", persona.email or "—"),
            field_cell("Nivel de educación", jugador.get_nivel_educacion_display() or "—"),
        ],
        [
            field_cell("Domicilio", _domicilio_texto(persona.domicilio)),
            field_cell(
                "Esquema de vacunación",
                "Completo" if jugador.esquema_vacunacion else ("Incompleto" if jugador.esquema_vacunacion is not None else "—"),
            ),
            field_cell("Categoría actual", jugador.categoria.nombre if jugador.categoria else "—"),
        ],
    ]

    photo_col_w = 28 * mm
    fields_w = INNER_WIDTH - photo_col_w
    col_w = fields_w / 3.0

    fields_table = Table(fields, colWidths=[col_w, col_w, col_w])
    fields_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    return grid([[fields_table, foto]], [fields_w, photo_col_w], [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ])


def deportivos_block(jugador):
    cat_ppal = jugador.categoria.nombre if jugador.categoria else "—"
    cat_sec = jugador.categoria_secundaria.nombre if jugador.categoria_secundaria else "Ninguna"

    fields = [
        [
            field_cell("Club", club_name()),
            field_cell("N° de socio", str(jugador.socio.numero_socio or "—")),
            field_cell("Estado deportivo", jugador.estado.nombre if jugador.estado else "Activo"),
        ],
        [
            field_cell("Categoría principal", cat_ppal),
            field_cell("Categoría secundaria", cat_sec),
            field_cell("Obra social", jugador.obra_social or "—"),
        ],
        [
            field_cell("Disciplina", "Fútbol (Aficionado)"),
            field_cell("Talle indumentaria", jugador.tallaIndumentaria or "—"),
            field_cell("Posición / Rol", "Jugador"),
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
    col_widths = [INNER_WIDTH * 0.28, INNER_WIDTH * 0.36, INNER_WIDTH * 0.36]

    if not vinculos:
        empty_content = grid([[paragraph("No se registran vínculos familiares o contactos cargados en el legajo.", "empty")]], [INNER_WIDTH])
        return [(empty_content, ITEM)]

    header_cells = [
        paragraph("VÍNCULO", "caption"),
        paragraph("NOMBRE Y APELLIDO", "caption"),
        paragraph("TELÉFONO / DNI", "caption"),
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
            paragraph(f"{tel_fmt} · DNI {dni_fmt}", "text"),
        ]
        rows.append((
            grid([cells], col_widths, [("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]),
            ITEM,
        ))
    return rows


def apto_block(jugador):
    venc_apto = apto_fisico_vencimiento(jugador)
    fields = [
        [
            field_cell("Apto Físico", "VIGENTE (Habilitado para competir)"),
            field_cell("Fecha de vencimiento", _format_fecha(venc_apto)),
            field_cell("Habilitación de planilla", "Autorizada"),
        ]
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
        (header_block(), HEADER),
        (paragraph("1. DATOS PERSONALES", "section"), SECTION),
        (personal_data_block(jugador), PLAIN),
        (paragraph("2. DATOS DEPORTIVOS Y DEL CLUB", "section"), SECTION),
        (deportivos_block(jugador), PLAIN),
        (paragraph("3. VÍNCULOS FAMILIARES Y CONTACTOS DE EMERGENCIA", "section"), SECTION),
        *vinculos_rows(jugador),
        (paragraph("4. DOCUMENTACIÓN Y APTO MÉDICO", "section"), SECTION),
        (apto_block(jugador), PLAIN),
        (
            paragraph(
                f"Planilla de datos para uso administrativo · {club_name()} · Documento no válido como carnet habilitante",
                "footer",
            ),
            FOOTER,
        ),
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
