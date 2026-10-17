class CometError(Exception):
    """Error genérico al comunicarse con COMET."""


class CometAuthError(CometError):
    """Credenciales inválidas o ausentes."""


class CometValidationError(CometError):
    """COMET rechazó los datos enviados."""


class CometNotConfiguredError(CometError):
    """Faltan variables de entorno (base_url, api_key)."""


class CometEligibilityError(Exception):
    """El jugador no cumple los requisitos para exportarse."""