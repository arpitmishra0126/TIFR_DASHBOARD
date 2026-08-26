"""Demographics & SES schemas."""
from pydantic import BaseModel, ConfigDict


class SESProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    child_id: int
    udai_pareek_score: float | None
    udai_pareek_category: str | None
    bg_prasad_category: str | None
    per_capita_income: float | None
    household_size: int | None
