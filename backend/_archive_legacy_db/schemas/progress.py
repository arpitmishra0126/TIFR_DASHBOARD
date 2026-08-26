"""Assessment Progress / Funnel schemas."""
from pydantic import BaseModel, ConfigDict


class AssessmentProgressRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    child_id: int
    registration_complete: bool
    ses_complete: bool
    screen_time_complete: bool
    health_screening_complete: bool
    physical_activity_complete: bool
    nutrition_complete: bool
    parent_report_complete: bool
    child_report_complete: bool
    teacher_report_complete: bool
    overall_status: str
