"""Demographics & SES routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import SESProfileRead
from app.services import dashboard_service

router = APIRouter(prefix="/demographics", tags=["demographics"])


@router.get("/ses", response_model=list[SESProfileRead])
def get_ses_profiles(db: Session = Depends(get_db)) -> list[SESProfileRead]:
    return list(dashboard_service.list_ses_profiles(db))
