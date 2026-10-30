import logging
from decimal import Decimal

from .models import RegistroAuditoria

logger = logging.getLogger("finanzas.audit")


def json_safe(value):
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def acting_user(user):
    return user if getattr(user, "is_authenticated", False) else None


def record_transaction(action, description, user=None, responsable="", socio=None, amount=None, reference="", detail=None):
    """Audit entry of a financial transaction. It is written inside the caller's transaction, so only
    operations that commit leave a trace. `user` is the logged-in user; `responsable` the person chosen by hand."""
    user = acting_user(user)
    entry = RegistroAuditoria.objects.create(
        accion=action,
        descripcion=description[:300],
        usuario=user,
        responsable=(responsable or "")[:120],
        socio=socio,
        monto=amount,
        referencia=reference[:60],
        detalle=json_safe(detail or {}),
    )
    logger.info(
        "%s | %s | usuario=%s | responsable=%s | socio=%s | monto=%s | ref=%s",
        action,
        entry.descripcion,
        user.get_username() if user else "Sistema",
        entry.responsable or "-",
        getattr(socio, "pk", None) or "-",
        amount if amount is not None else "-",
        reference or "-",
    )
    return entry
