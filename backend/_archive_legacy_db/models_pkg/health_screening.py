"""Health & Screening module.

Field provenance:
  REDCap source -> the four Yes/No condition items and the eligibility decision item
  Normalized    -> Yes/No text values parsed to bool
  Dashboard-derived -> none
"""
from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class HealthScreening(TimestampMixin, Base):
    __tablename__ = "health_screenings"

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), unique=True, nullable=False)

    # REDCap source field: "1. Is the child currently suffering from any illness or health problem?"
    current_illness_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # REDCap source field: "7. Has the child ever been diagnosed with any long-term or recurrent medical condition?"
    chronic_condition_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # REDCap source field: "18. Has the child ever been diagnosed with a developmental, learning, neurological, or behavioural condition?"
    neurodev_condition_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # REDCap source field: "19. Has the child ever been admitted to a hospital overnight or longer?"
    hospitalisation_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # REDCap source field: "27. Based on the child's current health status, what is the decision regarding today's assessment?"
    assessment_eligibility_decision: Mapped[str | None] = mapped_column(String(64), nullable=True)

    child: Mapped["Child"] = relationship(back_populates="health_screening")
