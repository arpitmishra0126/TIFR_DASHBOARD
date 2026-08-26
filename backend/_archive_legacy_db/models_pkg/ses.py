"""Demographics & SES module.

Field provenance:
  REDCap source -> udai_pareek_score, udai_pareek_category, bg_prasad_category,
                   per_capita_income, household_size
  Normalized    -> numeric fields parsed from REDCap text values
  Dashboard-derived -> none (all fields are directly sourced or already
                        computed upstream in REDCap, e.g. per-capita income)
"""
from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class SESProfile(TimestampMixin, Base):
    __tablename__ = "ses_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), unique=True, nullable=False)

    # REDCap source field: "22. SES Score based on Udai Pareek Scale"
    udai_pareek_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # REDCap source field: "Category (Udai Pareek)"
    udai_pareek_category: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "Category (BG Prasad)"
    bg_prasad_category: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "Per Capita Income" (household income / household members)
    per_capita_income: Mapped[float | None] = mapped_column(Float, nullable=True)

    # REDCap source field: "P9. How many family members live in your household?"
    household_size: Mapped[int | None] = mapped_column(Integer, nullable=True)

    child: Mapped["Child"] = relationship(back_populates="ses_profile")
