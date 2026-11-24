from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from rest_framework import serializers

from configuracion.services import club_name
from finanzas.pdf_utils import table

PAGE_SIZE = landscape(A4)
MARGIN = 15 * mm
MAX_COLUMNS = 12
MAX_ROWS = 5000
MAX_CELL_LENGTH = 300


class ListExportSerializer(serializers.Serializer):
    titulo = serializers.CharField(max_length=120)
    archivo = serializers.RegexField(r"^[a-z0-9-]{1,60}$")
    descripcion = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    columnas = serializers.ListField(
        child=serializers.CharField(max_length=60), min_length=1, max_length=MAX_COLUMNS
    )
    filas = serializers.ListField(
        child=serializers.ListField(child=serializers.CharField(max_length=MAX_CELL_LENGTH, allow_blank=True)),
        max_length=MAX_ROWS,
    )

    def validate(self, attrs):
        column_count = len(attrs["columnas"])
        if any(len(row) != column_count for row in attrs["filas"]):
            raise serializers.ValidationError({"filas": "Cada fila debe tener la misma cantidad de celdas que columnas."})
        return attrs


def list_filename(name, generated_at):
    return f"{name}-{generated_at:%Y-%m-%d}.pdf"


def render_list_pdf(data, generated_at):
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Titulo", parent=styles["Title"], alignment=0, spaceAfter=2)
    subtitle = ParagraphStyle("Subtitulo", parent=styles["Normal"], textColor=colors.HexColor("#5f6368"))
    cell = ParagraphStyle("Celda", parent=styles["Normal"], fontSize=9, leading=11)
    header = ParagraphStyle("Encabezado", parent=cell, fontName="Helvetica-Bold")
    width = PAGE_SIZE[0] - 2 * MARGIN
    columns = data["columnas"]

    story = [
        Paragraph(escape(club_name()), subtitle),
        Paragraph(escape(data["titulo"]), title),
        Paragraph(escape(f"Generado el {generated_at:%d/%m/%Y %H:%M} · {len(data['filas'])} registros"), subtitle),
    ]
    if data["descripcion"]:
        story.append(Paragraph(escape(data["descripcion"]), subtitle))
    story.append(Spacer(1, 4 * mm))

    if data["filas"]:
        rows = [[Paragraph(escape(name), header) for name in columns]]
        rows += [[Paragraph(escape(value), cell) for value in row] for row in data["filas"]]
        story.append(table(rows, [width / len(columns)] * len(columns)))
    else:
        story.append(Paragraph("No hay registros para los filtros seleccionados.", styles["Normal"]))

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=PAGE_SIZE,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title=data["titulo"],
        author=club_name(),
    ).build(story)
    return buffer.getvalue()
