import logging

from .services import apply_surcharges

logger = logging.getLogger(__name__)


def aplicar_mora_task():
    """Aplica recargos por mora a cuotas vencidas. Registrado en Django-Q Schedule."""
    try:
        resultado = apply_surcharges()
        logger.info(
            "Mora aplicada: %s cuotas revisadas, %s recargos, monto total %s",
            resultado["cuotas_revisadas"],
            resultado["recargos_primer_vencimiento"] + resultado["recargos_segundo_vencimiento"],
            resultado["monto_total"],
        )
        return resultado
    except Exception:
        logger.exception("Error al aplicar recargos por mora")
        raise