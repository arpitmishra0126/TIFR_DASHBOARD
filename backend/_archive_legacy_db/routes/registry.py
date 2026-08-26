"""Study Overview / Registry routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import ChildRead, ChildSummary
from app.services import dashboard_service

router = APIRouter(prefix="/registry", tags=["registry"])


@router.get("/children", response_model=list[ChildRead])
def get_children(db: Session = Depends(get_db)) -> list[ChildRead]:
    return list(dashboard_service.list_children(db))


@router.get("/summary", response_model=ChildSummary)
def get_summary(db: Session = Depends(get_db)) -> ChildSummary:
    return ChildSummary(total_registered=dashboard_service.count_registered(db))
