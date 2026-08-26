"""Dashboard-facing response schemas for the live REDCap-backed /dashboard/* API.

Every response is truthful to what the configured REDCap API scope actually
provides — see app.ingestion.live_field_map for the field-by-field
availability ledger. Modules with no live source data return an explicit
`available=False` shape rather than an empty-looking populated one.
"""
from pydantic import BaseModel


class SexDistribution(BaseModel):
    male: int
    female: int
    unknown: int


class AgeBucket(BaseModel):
    label: str
    count: int


class CategoryCount(BaseModel):
    code: str
    count: int


class NumericSummary(BaseModel):
    count: int
    mean: float
    minimum: float
    maximum: float


class UnavailableModule(BaseModel):
    """Shape returned by a module with no live data source at all."""

    available: bool = False
    reason: str
    unavailable_fields: list[str]


class InstrumentCoverage(BaseModel):
    key: str
    label: str
    completed_count: int
    percent_of_registered: float


# --- Overview ---
class OverviewResponse(BaseModel):
    total_registered: int
    registration_complete_count: int
    registration_complete_percent: float
    core_assessment_count: int
    core_assessment_percent: float
    ssrs_child_count: int
    ssrs_child_percent: float
    ssrs_teacher_count: int
    ssrs_teacher_percent: float
    instrument_coverage: list[InstrumentCoverage]
    sex_distribution: SexDistribution
    age_distribution: list[AgeBucket]
    udai_pareek_category_distribution: list[CategoryCount]
    modules_pending_integration: list[str]
    notes: dict[str, str]


# --- Registry ---
class RegistryChild(BaseModel):
    redcap_child_id: str
    sex: str | None
    dob: str | None
    age_years: int | None
    village: str | None
    child_status: str | None
    visit_date: str | None
    registration_complete: bool


class RegistryResponse(BaseModel):
    total: int
    limit: int
    offset: int
    children: list[RegistryChild]
    unavailable_fields: list[str]


# --- Demographics & SES ---
class DemographicsResponse(BaseModel):
    sex_distribution: SexDistribution
    age_distribution: list[AgeBucket]
    udai_pareek_category_distribution: list[CategoryCount]
    bg_prasad_category_distribution: list[CategoryCount]
    per_capita_income_summary: NumericSummary | None
    household_size_summary: NumericSummary | None
    ses_profile_count: int
    total_registered: int
    notes: dict[str, str]


# --- Assessment Progress pipeline ---
class ProgressStage(BaseModel):
    key: str
    label: str
    description: str
    count: int
    percent_of_registered: float
    percent_of_previous_stage: float | None


class ProgressResponse(BaseModel):
    total_registered: int
    stages: list[ProgressStage]
