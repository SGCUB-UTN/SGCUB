from ..config import MODE_MOCK, CometConfig
from .mock import MockCometClient
from .real import RealCometClient


def get_comet_client():
    config = CometConfig.from_settings()
    if config.mode == MODE_MOCK:
        return MockCometClient(config)
    return RealCometClient(config)