"""Physical Activity schemas."""
from pydantic import BaseModel, ConfigDict


class PhysicalActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    child_id: int
    item1_composite_score: float | None
    item8_composite_score: float | None
    paqa_final_score: float | None
