"""Screen Time schemas."""
from pydantic import BaseModel, ConfigDict


class ScreenTimeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    child_id: int
    total_daily_screen_time: str | None
    tv_frequency: str | None
    smartphone_frequency: str | None
    laptop_frequency: str | None
    educational_use_flag: bool | None
    entertainment_use_flag: bool | None
