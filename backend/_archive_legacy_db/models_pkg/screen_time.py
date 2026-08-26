"""Screen Time module.

Field provenance:
  REDCap source -> total daily screen time and per-device frequency items are
                   ordinal/categorical REDCap fields; educational/entertainment
                   use are Yes/No items
  Normalized    -> Yes/No text values parsed to bool; ordinal values kept as text
                    (categories are defined by REDCap's field metadata, not by
                    this application)
  Dashboard-derived -> none
"""
from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


class ScreenTime(TimestampMixin, Base):
    __tablename__ = "screen_time"

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), unique=True, nullable=False)

    # REDCap source field: "What is the average total screen time of the child per day across all devices?"
    total_daily_screen_time: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "How often does the child watch television in a typical week?"
    tv_frequency: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "How often does the child use a smartphone/tablet in a typical week?"
    smartphone_frequency: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "How often does the child use a laptop/computer in a typical week?"
    laptop_frequency: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # REDCap source field: "Does the child use screen devices for school-related learning or homework?"
    educational_use_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # REDCap source field: "Does the child use screen devices mainly for entertainment (games/videos/cartoons)?"
    entertainment_use_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    child: Mapped["Child"] = relationship(back_populates="screen_time")
