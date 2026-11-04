import re
from xml.sax.saxutils import escape

PARAGRAPH = "paragraph"
ORDERED = "ordered"
BULLET = "bullet"

ORDERED_ITEM = re.compile(r"^\s*(\d+)[.)]\s+(.*)$")
BULLET_ITEM = re.compile(r"^\s*[-*]\s+(.*)$")
EMPHASIS = re.compile(r"\*\*\*(\S(?:.*?\S)?)\*\*\*|\*\*(\S(?:.*?\S)?)\*\*|\*(\S(?:.*?\S)?)\*")
ITALIC = re.compile(r"\*(\S(?:.*?\S)?)\*")


def italic_html(text):
    return ITALIC.sub(r"<i>\1</i>", escape(text))


def emphasis_html(match):
    bold_italic, bold, italic = match.groups()
    if bold_italic is not None:
        return f"<b><i>{escape(bold_italic)}</i></b>"
    if bold is not None:
        return f"<b>{italic_html(bold)}</b>"
    return f"<i>{escape(italic)}</i>"


def inline_markdown(text):
    text = text.strip()
    html = []
    last = 0
    for match in EMPHASIS.finditer(text):
        html.append(escape(text[last:match.start()]))
        html.append(emphasis_html(match))
        last = match.end()
    html.append(escape(text[last:]))
    return "".join(html)


def parse_markdown(text):
    blocks = []
    paragraph = []

    def close_paragraph():
        if paragraph:
            blocks.append({"type": PARAGRAPH, "text": "<br/>".join(inline_markdown(line) for line in paragraph)})
            paragraph.clear()

    def add_item(kind, item, start=1):
        close_paragraph()
        if blocks and blocks[-1]["type"] == kind:
            blocks[-1]["items"].append(inline_markdown(item))
        else:
            blocks.append({"type": kind, "items": [inline_markdown(item)], "start": start})

    for line in (text or "").replace("\r\n", "\n").split("\n"):
        if (match := ORDERED_ITEM.match(line)):
            add_item(ORDERED, match.group(2), int(match.group(1)))
        elif (match := BULLET_ITEM.match(line)):
            add_item(BULLET, match.group(1))
        elif line.strip():
            paragraph.append(line)
        else:
            close_paragraph()
    close_paragraph()
    return blocks
