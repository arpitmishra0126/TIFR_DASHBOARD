"""Raw REDCap API response models.

These describe REDCap's own response shapes (export format), distinct from
this application's dashboard-facing Pydantic schemas in app.schemas. Field
names here are generic/structural — the actual per-study variable names can
only be confirmed once the REDCap Data Dictionary is available (see
app.ingestion.normalize for the known limitation).
"""
from pydantic import BaseModel, ConfigDict


class RedCapRecord(BaseModel):
    """A single REDCap record: field name -> raw value, all REDCap values are strings."""

    model_config = ConfigDict(extra="allow")


class RedCapFieldMetadata(BaseModel):
    """One row of the REDCap Data Dictionary (metadata export)."""

    field_name: str
    form_name: str
    field_type: str
    field_label: str
    select_choices_or_calculations: str | None = None
