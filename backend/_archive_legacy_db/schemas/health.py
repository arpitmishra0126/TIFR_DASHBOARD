"""Health & Screening schemas."""
from pydantic import BaseModel, ConfigDict


class HealthScreeningRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    child_id: int
    current_illness_flag: bool | None
    chronic_condition_flag: bool | None
    neurodev_condition_flag: bool | None
    hospitalisation_flag: bool | None
    assessment_eligibility_decision: str | None
