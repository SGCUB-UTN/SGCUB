from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle

BORDER = colors.HexColor("#c4c7c5")
HEADER_BACKGROUND = colors.HexColor("#eef1f4")


def format_receipt_number(receipt_type, number):
    return f"{receipt_type} {number:08d}"


def format_amount(value):
    formatted = f"{abs(value):,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"{'-' if value < 0 else ''}$ {formatted}"


def table(rows, column_widths, total_row=False, right_aligned_from=-1):
    content = Table(rows, colWidths=column_widths, hAlign="LEFT", repeatRows=1)
    style = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BACKGROUND),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ALIGN", (right_aligned_from, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if total_row:
        style += [
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("BACKGROUND", (0, -1), (-1, -1), HEADER_BACKGROUND),
        ]
    content.setStyle(TableStyle(style))
    return content
