"""Neurodevelopment / Assessment schemas (teacher-rated items only in V1)."""
from pydantic import BaseModel, ConfigDict


class NeurodevelopmentAssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    child_id: int
    teacher_academic_performance: str | None
    teacher_reading_ability: str | None
    teacher_math_ability: str | None
    teacher_academic_motivation: str | None
    teacher_learning_ability: str | None
    teacher_classroom_behaviour: str | None
