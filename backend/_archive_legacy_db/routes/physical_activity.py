"""Physical Activity routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import PhysicalActivityRead
from app.services import dashboard_service

router = APIRouter(prefix="/physical-activity", tags=["physical-activity"])


@router.get("", response_model=list[PhysicalActivityRead])
def get_physical_activity(db: Session = Depends(get_db)) -> list[PhysicalActivityRead]:
    return list(dashboard_service.list_physical_activity(db))
