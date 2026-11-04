import re

from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle

BORDER = colors.HexColor("#c4c7c5")
HEADER_BACKGROUND = colors.HexColor("#eef1f4")


def format_receipt_number(receipt_type, number):
    return f"{receipt_type} {number:08d}"


def format_amount(value):
    formatted = f"{abs(value):,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"{'-' if value < 0 else ''}$ {formatted}"


def format_phone(phone):
    """'+54 9 2216 75-5822', the same as formatReceiptPhone in the frontend.
    Foreign or unrecognized numbers are returned as stored."""
    text = str(phone or "").strip()
    digits = re.sub(r"\D", "", text)
    mobile = False
    if text.startswith("+"):
        if not digits.startswith("54"):
            return text
        digits = digits[2:]
        mobile = digits.startswith("9")
        digits = digits[1:] if mobile else digits
    digits = digits.removeprefix("0")
    if len(digits) != 10:
        return text
    return f"+54 {'9 ' if mobile else ''}{digits[:4]} {digits[4:6]}-{digits[6:]}"


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
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    if total_row:
        style += [
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("BACKGROUND", (0, -1), (-1, -1), HEADER_BACKGROUND),
        ]
    content.setStyle(TableStyle(style))
    return content
