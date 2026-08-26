"""Health & Screening routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import HealthScreeningRead
from app.services import dashboard_service

router = APIRouter(prefix="/health-screening", tags=["health-screening"])


@router.get("", response_model=list[HealthScreeningRead])
def get_health_screenings(db: Session = Depends(get_db)) -> list[HealthScreeningRead]:
    return list(dashboard_service.list_health_screenings(db))
