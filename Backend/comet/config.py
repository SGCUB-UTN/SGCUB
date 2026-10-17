from dataclasses import dataclass

from django.conf import settings

from .exceptions import CometNotConfiguredError


MODE_MOCK = "mock"
MODE_SANDBOX = "sandbox"
MODE_PRODUCTION = "production"
VALID_MODES = {MODE_MOCK, MODE_SANDBOX, MODE_PRODUCTION}


@dataclass(frozen=True)
class CometConfig:
    base_url: str
    api_key: str
    timeout: int
    mode: str

    @classmethod
    def from_settings(cls) -> "CometConfig":
        mode = (getattr(settings, "COMET_MODE", MODE_MOCK) or MODE_MOCK).strip().lower()
        if mode not in VALID_MODES:
            raise CometNotConfiguredError(
                f"COMET_MODE inválido: '{mode}'. Opciones: {sorted(VALID_MODES)}"
            )

        # En modo mock no exigimos credenciales
        if mode == MODE_MOCK:
            return cls(base_url="mock://local", api_key="mock", timeout=5, mode=mode)

        base_url = (getattr(settings, "COMET_BASE_URL", "") or "").strip()
        api_key = (getattr(settings, "COMET_API_KEY", "") or "").strip()
        timeout = int(getattr(settings, "COMET_TIMEOUT", 30))

        if not base_url:
            raise CometNotConfiguredError("Falta COMET_BASE_URL en la configuración.")
        if not api_key:
            raise CometNotConfiguredError("Falta COMET_API_KEY en la configuración.")

        return cls(base_url=base_url, api_key=api_key, timeout=timeout, mode=mode)