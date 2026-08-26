"""Normalization helpers for transforming raw REDCap values into typed,
dashboard-ready values.

Pure, deterministic, unit-testable functions — no REDCap I/O here. Used by
app.services.live_dashboard_service to transform the live record export
(see app.ingestion.live_field_map for the field-availability contract).
"""
from datetime import date, datetime

_YES_VALUES = {"yes", "y", "1", "true"}
_NO_VALUES = {"no", "n", "0", "false"}
_COMPLETE_VALUES = {"complete", "2"}


def parse_yes_no(value: str | None) -> bool | None:
    """Parse a REDCap Yes/No label into a bool. Returns None for blank/unrecognized values."""
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    if normalized in _YES_VALUES:
        return True
    if normalized in _NO_VALUES:
        return False
    return None


def parse_complete_flag(value: str | None) -> bool:
    """Parse a REDCap instrument 'Complete?' label into a bool.

    Unknown/blank values are treated as not complete, matching REDCap's own
    "Incomplete"/blank default for instruments that have not been started.
    """
    if value is None:
        return False
    return value.strip().lower() in _COMPLETE_VALUES


def parse_date(value: str | None) -> date | None:
    """Parse a REDCap date string (YYYY-MM-DD) into a date object."""
    if not value or not value.strip():
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def compute_age_years(dob: date | None, as_of: date | None = None) -> int | None:
    """Dashboard-derived age in whole years as of a reference date (default: today)."""
    if dob is None:
        return None
    reference = as_of or date.today()
    years = reference.year - dob.year
    if (reference.month, reference.day) < (dob.month, dob.day):
        years -= 1
    return years


def capitalize_label(value: str | None) -> str | None:
    """Normalize a resolved choice label's casing (e.g. REDCap 'male' -> 'Male').

    REDCap choice label text casing is set by whoever built the form and is
    not guaranteed consistent across instruments/projects; this keeps
    downstream grouping (e.g. sex distribution counts) stable regardless.
    """
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    return stripped.capitalize()


def parse_float(value: str | None) -> float | None:
    """Safely parse a REDCap text-field numeric value. Blank/non-numeric -> None."""
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    try:
        return float(stripped)
    except ValueError:
        return None


def parse_int(value: str | None) -> int | None:
    """Safely parse a REDCap text-field integer value. Blank/non-numeric -> None."""
    parsed = parse_float(value)
    if parsed is None:
        return None
    return int(parsed)
