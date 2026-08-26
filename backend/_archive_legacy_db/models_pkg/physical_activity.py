"""Physical Activity (PAQ-A) module.

Field provenance:
  REDCap source -> the two composite items and the PAQ-A final score, which are
                   themselves REDCap-side calculated fields (means of raw items)
  Normalized    -> none beyond numeric parsing
  Dashboard-derived -> none
"""
from sqlalchemy import Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class PhysicalActivity(TimestampMixin, Base):
    __tablename__ = "physical_activity"

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), unique=True, nullable=False)

    # REDCap source field: "Item 1 composite score (mean of spare-time activity checklist)"
    item1_composite_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # REDCap source field: "Item 8 composite score (mean of daily activity ratings, Mon-Sun)"
    item8_composite_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # REDCap source field: "PAQ-A final activity summary score (mean of items 1-8; excludes item 9)"
    paqa_final_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    child: Mapped["Child"] = relationship(back_populates="physical_activity")
