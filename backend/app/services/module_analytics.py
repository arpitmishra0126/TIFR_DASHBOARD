"""Shared analytical calculations for the four assessment modules (Health &
Screening, Physical Activity, Screen Time, Neurodevelopment) and the Active
Cases Excel export.

Source of truth: the Active Cases Excel workbook's "DOMAIN ANALYSIS" summary
section (app.services.export_service), approved 2026-08-26 as the official
V1 analytical specification. Both this module's dashboard-facing builder
functions and export_service.py's Summary-sheet builder call the exact same
low-level aggregation helpers and field lists defined here, so the two can
never compute different numbers for the same metric.

No REDCap field is read here that is not already declared in
app.ingestion.live_field_map.LIVE_FIELDS (i.e. already fetched by the
existing live pipeline). No new REDCap mappings are introduced.

Population: unlike the Excel export (which reports on "Active Cases" only,
for the newsletter use case), these dashboard-facing functions report on
ALL registered children — the same population convention already used by
Overview, Demographics and Assessment Progress — for consistency across the
dashboard. The underlying arithmetic (how a distribution/summary/coverage
tier is computed) is identical either way.
"""
from collections import Counter
from statistics import mean
from typing import Callable

from app.ingestion.choice_maps import ChoiceMap
from app.ingestion.normalize import parse_complete_flag, parse_float

# --- Field lists (single source of truth — approved 2026-08-26) ---

CHH_NAMED_CONDITIONS: tuple[tuple[str, str], ...] = (
    ("chh_q8_asthma", "Asthma"),
    ("chh_q8_heart", "Heart Disease"),
    ("chh_q8_tb", "TB"),
    ("chh_q8_diabetes", "Diabetes"),
    ("chh_q8_thyroid", "Thyroid"),
    ("chh_q8_anaemia", "Anaemia"),
    ("chh_q8_malnutrition", "Malnutrition"),
    ("chh_q8_kidney", "Kidney"),
    ("chh_q8_liver", "Liver"),
    ("chh_q8_infections", "Recurrent Infections"),
    ("chh_q8_other", "Other"),
)

CHH_GENERAL_FLAGS: tuple[tuple[str, str], ...] = (
    ("chh_illness_current", "Currently ill"),
    ("chh_chronic_condition", "Chronic condition"),
    ("chh_hospitalised", "Ever hospitalised"),
    ("chh_allergy", "Known allergy"),
    ("chh_vision_difficulty", "Vision difficulty"),
    ("chh_hearing_difficulty", "Hearing difficulty"),
    ("chh_seizures", "Seizures/fits"),
    ("chh_dev_diagnosis", "Developmental diagnosis"),
)

DSEQ_YES_NO_ITEMS: tuple[tuple[str, str], ...] = (
    ("q9_household_rules", "Household has screen-use rules (Q9)"),
    ("q14_school_use", "Uses screens for school/homework (Q14)"),
    ("q15_entertainment_use", "Uses screens mainly for entertainment (Q15)"),
)

DIETARY_LABELS: tuple[tuple[str, str], ...] = (
    ("die_grains_freq", "Grains / Roots / Tubers"),
    ("die_pulses_freq", "Pulses (Beans/Peas/Lentils)"),
    ("die_nuts_seeds_freq", "Nuts and Seeds"),
    ("die_dairy_freq", "Dairy (Milk/Yogurt/Cheese)"),
    ("die_flesh_freq", "Flesh Foods (Meat/Fish/Poultry)"),
    ("die_eggs_freq", "Eggs"),
    ("die_dgl_veg_freq", "Dark Green Leafy Vegetables"),
    ("die_vita_fv_freq", "Vitamin-A Rich Fruits/Vegetables"),
    ("die_other_veg_freq", "Other Vegetables"),
    ("die_other_fruits_freq", "Other Fruits"),
)

PAQA_SCORE_BUCKET_EDGES: list[float] = [2, 3, 4]
PAQA_SCORE_BUCKET_LABELS: list[str] = ["1.0-1.99 (Low)", "2.0-2.99", "3.0-3.99", "4.0-5.0 (High)"]

INCOME_BUCKET_EDGES: list[float] = [1000, 2000, 3000, 4000, 5000]
INCOME_BUCKET_LABELS: list[str] = ["< 1,000", "1,000-1,999", "2,000-2,999", "3,000-3,999", "4,000-4,999", "5,000+"]


# --- Low-level pure helpers ---


def resolve_value(field_name: str, raw_value: str | None, choice_maps: dict[str, ChoiceMap]) -> str:
    """Resolve a coded (radio/dropdown) value to its REDCap choice label, or
    pass a plain text/calc field's value through unchanged. Never invents a
    value: blank/missing input returns "", and a code with no matching
    choice label falls back to the raw code rather than guessing.
    """
    if raw_value is None or raw_value.strip() == "":
        return ""
    field_choices = choice_maps.get(field_name)
    if field_choices is not None:
        return field_choices.get(raw_value, raw_value.strip())
    return raw_value.strip()


def child_id(record: dict) -> str:
    return (record.get("child_id") or "").strip()


def registered_records(records: list[dict]) -> list[dict]:
    """Unique-by-child_id records with a non-blank child_id — the same
    population every other dashboard module (Overview/Demographics/Progress)
    already reports on."""
    seen: set[str] = set()
    result: list[dict] = []
    for record in records:
        cid = child_id(record)
        if not cid or cid in seen:
            continue
        seen.add(cid)
        result.append(record)
    return result


def category_counts(records: list[dict], field: str, choice_maps: dict[str, ChoiceMap]) -> list[tuple[str, int]]:
    counts: Counter = Counter()
    for record in records:
        value = resolve_value(field, record.get(field), choice_maps)
        if value:
            counts[value] += 1
    return sorted(counts.items(), key=lambda kv: (-kv[1], str(kv[0])))


def numeric_values(records: list[dict], field: str, parser: Callable[[str | None], float | int | None]) -> list[float]:
    values: list[float] = []
    for record in records:
        value = parser(record.get(field))
        if value is not None:
            values.append(value)
    return values


def bucket_counts(values: list[float], edges: list[float], labels: list[str]) -> list[tuple[str, int]]:
    counts = [0] * len(labels)
    for value in values:
        placed = False
        for i, edge in enumerate(edges):
            if value < edge:
                counts[i] += 1
                placed = True
                break
        if not placed:
            counts[-1] += 1
    return list(zip(labels, counts))


def yes_count(records: list[dict], field: str, choice_maps: dict[str, ChoiceMap]) -> int:
    return sum(1 for r in records if resolve_value(field, r.get(field), choice_maps).strip().lower() == "yes")


def complete_count(records: list[dict], field: str) -> int:
    return sum(1 for r in records if parse_complete_flag(r.get(field)))


def percent(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def coverage_tier(completed: int, total: int) -> str:
    """Same High/Partial/No-Data thresholds as the Excel export's DATA
    COVERAGE section (>=50% / >0% / 0%)."""
    if total <= 0:
        return "No Data"
    ratio = completed / total
    if ratio >= 0.5:
        return "High"
    if ratio > 0:
        return "Partial"
    return "No Data"


def numeric_summary(values: list[float], total: int) -> dict:
    """Valid N / missing N / percent-valid + mean/min/max. Missing is never
    treated as zero — mean/min/max are None (not 0) when there is no data."""
    valid_n = len(values)
    return {
        "valid_n": valid_n,
        "missing_n": max(total - valid_n, 0),
        "total": total,
        "percent_valid": percent(valid_n, total),
        "mean": round(mean(values), 2) if values else None,
        "minimum": min(values) if values else None,
        "maximum": max(values) if values else None,
    }


def ssrs_items_answered(records: list[dict], freq_fields: tuple[str, ...]) -> int:
    return sum(1 for r in records if any((r.get(f) or "").strip() != "" for f in freq_fields))


def ssrs_per_child_averages(
    records: list[dict], freq_fields: tuple[str, ...], imp_fields: tuple[str, ...],
) -> tuple[list[float], list[float]]:
    """Per-child mean frequency rating and per-child mean importance rating,
    one value per child who answered at least one item on that scale. This
    mirrors the Active Cases Excel export's per-child derived columns
    (`<Instrument>: Avg Frequency/Importance Rating`) exactly, aggregated
    here to cohort level (no participant identifiers) for dashboard display.
    """
    freq_avgs: list[float] = []
    imp_avgs: list[float] = []
    for record in records:
        freq_values = [v for f in freq_fields if (v := parse_float(record.get(f))) is not None]
        imp_values = [v for f in imp_fields if (v := parse_float(record.get(f))) is not None]
        if freq_values:
            freq_avgs.append(round(mean(freq_values), 2))
        if imp_values:
            imp_avgs.append(round(mean(imp_values), 2))
    return freq_avgs, imp_avgs


# --- Module-level analysis builders ---


def build_health_screening_analysis(records: list[dict], choice_maps: dict[str, ChoiceMap]) -> dict:
    reg = registered_records(records)
    total = len(reg)
    completed = complete_count(reg, "child_illness_history_complete")

    return {
        "instrument": "Child Illness History",
        "completion": {
            "instrument": "Child Illness History",
            "completed": completed,
            "total_registered": total,
            "percent": percent(completed, total),
            "coverage_tier": coverage_tier(completed, total),
        },
        "named_conditions": [(label, yes_count(reg, field, choice_maps)) for field, label in CHH_NAMED_CONDITIONS],
        "general_flags": [(label, yes_count(reg, field, choice_maps)) for field, label in CHH_GENERAL_FLAGS],
    }


def build_physical_activity_analysis(records: list[dict], choice_maps: dict[str, ChoiceMap]) -> dict:
    reg = registered_records(records)
    total = len(reg)
    completed = complete_count(reg, "paq_a_complete")

    item1 = numeric_values(reg, "paq_item1_score", parse_float)
    item8 = numeric_values(reg, "paq_item8_score", parse_float)
    total_scores = numeric_values(reg, "paq_total_score", parse_float)

    return {
        "instrument": "PAQ-A",
        "completion": {
            "instrument": "PAQ-A",
            "completed": completed,
            "total_registered": total,
            "percent": percent(completed, total),
            "coverage_tier": coverage_tier(completed, total),
        },
        "item1_summary": numeric_summary(item1, total),
        "item8_summary": numeric_summary(item8, total),
        "total_summary": numeric_summary(total_scores, total),
        "total_score_distribution": bucket_counts(total_scores, PAQA_SCORE_BUCKET_EDGES, PAQA_SCORE_BUCKET_LABELS),
    }


def build_screen_time_analysis(records: list[dict], choice_maps: dict[str, ChoiceMap]) -> dict:
    reg = registered_records(records)
    total = len(reg)
    completed = complete_count(reg, "dseq_complete")

    return {
        "instrument": "DSEQ",
        "completion": {
            "instrument": "DSEQ",
            "completed": completed,
            "total_registered": total,
            "percent": percent(completed, total),
            "coverage_tier": coverage_tier(completed, total),
        },
        "total_screen_time_distribution": category_counts(reg, "q10_total_screen_time", choice_maps),
        "yes_no_items": [(label, yes_count(reg, field, choice_maps)) for field, label in DSEQ_YES_NO_ITEMS],
    }


def _ssrs_instrument_summary(
    reg: list[dict], freq_fields: tuple[str, ...], imp_fields: tuple[str, ...], complete_field: str, label: str, total: int,
) -> dict:
    any_data = ssrs_items_answered(reg, freq_fields)
    completed = complete_count(reg, complete_field)
    freq_avgs, imp_avgs = ssrs_per_child_averages(reg, freq_fields, imp_fields)
    return {
        "instrument": label,
        "children_with_any_data": any_data,
        "total_registered": total,
        "percent": percent(any_data, total),
        "completed_count": completed,
        "avg_frequency_summary": numeric_summary(freq_avgs, total),
        "avg_importance_summary": numeric_summary(imp_avgs, total),
    }


def build_neurodevelopment_analysis(
    records: list[dict],
    choice_maps: dict[str, ChoiceMap],
    parent_freq_fields: tuple[str, ...],
    parent_imp_fields: tuple[str, ...],
    child_freq_fields: tuple[str, ...],
    child_imp_fields: tuple[str, ...],
    teacher_freq_fields: tuple[str, ...],
    teacher_imp_fields: tuple[str, ...],
) -> dict:
    reg = registered_records(records)
    total = len(reg)
    return {
        "parent": _ssrs_instrument_summary(reg, parent_freq_fields, parent_imp_fields, "ssrs_parent_complete", "SSRS Parent", total),
        "child": _ssrs_instrument_summary(reg, child_freq_fields, child_imp_fields, "ssrs_child_complete", "SSRS Child", total),
        "teacher": _ssrs_instrument_summary(reg, teacher_freq_fields, teacher_imp_fields, "ssrs_teacher_complete", "SSRS Teacher", total),
    }
