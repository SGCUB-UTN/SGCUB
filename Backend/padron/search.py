import unicodedata

from django.db.models import Value
from django.db.models.functions import Lower, Replace

ACCENT_REPLACEMENTS = {
    "a": "áàäâÁÀÄÂ",
    "e": "éèëêÉÈËÊ",
    "i": "íìïîÍÌÏÎ",
    "o": "óòöôÓÒÖÔ",
    "u": "úùüûÚÙÜÛ",
    "n": "ñÑ",
}


def normalize_text(value):
    decomposed = unicodedata.normalize("NFD", str(value or ""))
    return "".join(char for char in decomposed if not unicodedata.combining(char)).lower().strip()


def normalized_field(field):
    expression = Lower(field)
    for plain, accented_chars in ACCENT_REPLACEMENTS.items():
        for accented in accented_chars:
            expression = Replace(expression, Value(accented), Value(plain))
    return expression
