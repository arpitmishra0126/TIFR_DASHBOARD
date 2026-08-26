"""Assessment Progress / Funnel routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import AssessmentProgressRead
from app.services import dashboard_service

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=list[AssessmentProgressRead])
def get_progress(db: Session = Depends(get_db)) -> list[AssessmentProgressRead]:
    return list(dashboard_service.list_assessment_progress(db))
