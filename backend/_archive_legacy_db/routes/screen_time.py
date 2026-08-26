"""Screen Time routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import ScreenTimeRead
from app.services import dashboard_service

router = APIRouter(prefix="/screen-time", tags=["screen-time"])


@router.get("", response_model=list[ScreenTimeRead])
def get_screen_time(db: Session = Depends(get_db)) -> list[ScreenTimeRead]:
    return list(dashboard_service.list_screen_time(db))
