"""Neurodevelopment / Assessment module.

V1 scope is limited to the six teacher-rated ordinal items approved in the
V1 spec. Parent-report and child self-report SSRS items are explicitly
excluded — the approved spec has no computed composite for either, only raw
per-item Frequency/Importance responses, so no qualifying variable exists.

Field provenance:
  REDCap source -> the six teacher-rated ordinal items (Teacher-report instrument)
  Normalized    -> none beyond text storage of ordinal categories
  Dashboard-derived -> none
"""
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class NeurodevelopmentAssessment(TimestampMixin, Base):
    __tablename__ = "neurodevelopment_assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), unique=True, nullable=False)

    # REDCap source field: "43. Overall academic performance compared with other children in the same classroom"
    teacher_academic_performance: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "44. Reading ability compared with other students"
    teacher_reading_ability: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "45. Mathematics ability compared with other students"
    teacher_math_ability: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "48. Overall motivation to succeed academically"
    teacher_academic_motivation: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "50. Overall learning ability/intellectual functioning compared with classmates"
    teacher_learning_ability: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "51. Overall classroom behaviour compared with classmates"
    teacher_classroom_behaviour: Mapped[str | None] = mapped_column(String(64), nullable=True)

    child: Mapped["Child"] = relationship(back_populates="neurodevelopment")
