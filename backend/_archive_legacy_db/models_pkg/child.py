"""Registry / Study Overview module.

Field provenance:
  REDCap source   -> redcap_child_id, sex, dob, village, child_status, visit_date,
                      registration_complete (from the "Complete?" field on the
                      Registration instrument)
  Normalized      -> dob parsed to a date; registration_complete parsed to bool
  Dashboard-derived -> age_years (computed from dob at read time / on ingest)
"""
from datetime import date

from sqlalchemy import Boolean, Date, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class Child(TimestampMixin, Base):
    __tablename__ = "children"

    id: Mapped[int] = mapped_column(primary_key=True)

    # REDCap source field: "Original Cohort Child ID" — the join key across all modules.
    redcap_child_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    # REDCap source field: "sex of the child"
    sex: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # REDCap source field: "child dob"
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Dashboard-derived: computed from dob, not stored in REDCap.
    age_years: Mapped[int | None] = mapped_column(nullable=True)

    # REDCap source field: "Village name"
    village: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # REDCap source field: "child Status"
    child_status: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "Visit Date"
    visit_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Normalized from REDCap "Complete?" (Registration form): Complete/Incomplete -> bool
    registration_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    ses_profile: Mapped["SESProfile | None"] = relationship(back_populates="child", uselist=False)
    health_screening: Mapped["HealthScreening | None"] = relationship(back_populates="child", uselist=False)
    physical_activity: Mapped["PhysicalActivity | None"] = relationship(back_populates="child", uselist=False)
    screen_time: Mapped["ScreenTime | None"] = relationship(back_populates="child", uselist=False)
    neurodevelopment: Mapped["NeurodevelopmentAssessment | None"] = relationship(
        back_populates="child", uselist=False
    )
    assessment_progress: Mapped["AssessmentProgress | None"] = relationship(back_populates="child", uselist=False)
