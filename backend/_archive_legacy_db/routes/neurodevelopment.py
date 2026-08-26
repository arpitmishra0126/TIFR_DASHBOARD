"""Neurodevelopment / Assessment routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import NeurodevelopmentAssessmentRead
from app.services import dashboard_service

router = APIRouter(prefix="/neurodevelopment", tags=["neurodevelopment"])


@router.get("", response_model=list[NeurodevelopmentAssessmentRead])
def get_neurodevelopment(db: Session = Depends(get_db)) -> list[NeurodevelopmentAssessmentRead]:
    return list(dashboard_service.list_neurodevelopment(db))
