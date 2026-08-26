"""Dashboard data/service layer.

Sits between the API routes and the ORM models: all read queries against the
PostgreSQL normalized/cache layer go through here, not directly in routes.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AssessmentProgress,
    Child,
    HealthScreening,
    NeurodevelopmentAssessment,
    PhysicalActivity,
    ScreenTime,
    SESProfile,
)


def list_children(db: Session) -> list[Child]:
    return list(db.execute(select(Child).order_by(Child.id)).scalars().all())


def get_child(db: Session, child_id: int) -> Child | None:
    return db.get(Child, child_id)


def count_registered(db: Session) -> int:
    return len(list_children(db))


def list_ses_profiles(db: Session) -> list[SESProfile]:
    return list(db.execute(select(SESProfile)).scalars().all())


def list_health_screenings(db: Session) -> list[HealthScreening]:
    return list(db.execute(select(HealthScreening)).scalars().all())


def list_physical_activity(db: Session) -> list[PhysicalActivity]:
    return list(db.execute(select(PhysicalActivity)).scalars().all())


def list_screen_time(db: Session) -> list[ScreenTime]:
    return list(db.execute(select(ScreenTime)).scalars().all())


def list_neurodevelopment(db: Session) -> list[NeurodevelopmentAssessment]:
    return list(db.execute(select(NeurodevelopmentAssessment)).scalars().all())


def list_assessment_progress(db: Session) -> list[AssessmentProgress]:
    return list(db.execute(select(AssessmentProgress)).scalars().all())
