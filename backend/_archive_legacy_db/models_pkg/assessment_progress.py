"""Assessment Progress / Funnel module.

Field provenance:
  REDCap source -> the nine per-instrument "Complete?" fields
  Normalized    -> Complete/Incomplete text parsed to bool
  Dashboard-derived -> overall_status, computed from the nine flags

Note: nutrition_complete tracks completion of the Nutrition (FFQ) instrument
for the funnel view only. The Nutrition *display* module itself remains
deferred in V1 per the approved spec (no dashboard-ready summary metric
exists) — this flag does not imply the Nutrition module is in scope.
"""
from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class AssessmentProgress(TimestampMixin, Base):
    __tablename__ = "assessment_progress"

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), unique=True, nullable=False)

    registration_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ses_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    screen_time_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    health_screening_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    physical_activity_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    nutrition_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    parent_report_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    child_report_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    teacher_report_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Dashboard-derived: e.g. "Not Started" / "In Progress" / "Complete"
    overall_status: Mapped[str] = mapped_column(String(32), default="Not Started", nullable=False)

    child: Mapped["Child"] = relationship(back_populates="assessment_progress")
