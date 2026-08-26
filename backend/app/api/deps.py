from functools import lru_cache

from app.config import get_settings
from app.redcap.client import RedCapClient
from app.redcap.live_repository import LiveRedCapRepository
from app.services.live_dashboard_service import LiveDashboardService

__all__ = ["get_live_dashboard_service"]


@lru_cache
def _get_repository() -> LiveRedCapRepository:
    client = RedCapClient(get_settings())
    return LiveRedCapRepository(client)


def get_live_dashboard_service() -> LiveDashboardService:
    return LiveDashboardService(_get_repository())
