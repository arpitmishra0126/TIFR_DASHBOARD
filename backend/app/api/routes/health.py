"""Basic health-check endpoint."""
from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "environment": settings.environment,
        "redcap_configured": settings.redcap_configured,
    }
