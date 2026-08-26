"""Study Overview / Registry schemas."""
from datetime import date

from pydantic import BaseModel, ConfigDict


class ChildRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    redcap_child_id: str
    sex: str | None
    dob: date | None
    age_years: int | None
    village: str | None
    child_status: str | None
    visit_date: date | None
    registration_complete: bool


class ChildSummary(BaseModel):
    """Registry KPI summary — 'Total children registered' etc."""

    total_registered: int
