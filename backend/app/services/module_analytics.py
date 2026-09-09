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
ALL registered children - the same population convention already used by
Overview, Demographics and Assessment Progress - for consistency across the
dashboard. The underlying arithmetic (how a distribution/summary/coverage
tier is computed) is identical either way.
"""
from collections import Counter
from statistics import mean, median
from typing import Callable

from app.ingestion.choice_maps import ChoiceMap
from app.ingestion.normalize import compute_age_years, parse_complete_flag, parse_date, parse_float

# --- Field lists (single source of truth - approved 2026-08-26) ---

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

# --- DSEQ screen-time / physical-activity minute conversion (2026-09-09
# senior DSEQ specification) ---
# DSEQ has no raw-minutes field anywhere on the instrument - every duration
# question (q2/q3/q5/q6/q10/q11/q12) is a 4-5 level ordinal REDCap `radio`
# field (confirmed live 2026-09-09 via REDCap metadata for the `dseq` form -
# every field_type returned was "radio", none "text"/"number"). To honor the
# requirement that screen time be analysed as a continuous minutes-per-day
# variable, each ordinal *code* (not the bilingual label text, which has a
# documented slash-splitting quirk elsewhere in this codebase - see
# choice_maps.py) is converted to the midpoint of its band, in minutes. This
# is a standard, transparent survey-research convention for turning banded
# categories into an analysable continuous proxy - it is not a fabricated
# per-child measurement. The open-ended top band of every field (e.g. "more
# than 2 hours") has no REDCap-defined upper bound; its minute value below
# is a documented, conservative approximation (one half-band-width past the
# band's lower bound), and every UI surface built on it must say
# "estimated" rather than presenting it as an exact duration.
_SCREEN_BAND_MINUTES: dict[str, int] = {"0": 0, "1": 15, "2": 45, "3": 90, "4": 150}
"""q2_tv_school / q3_tv_holiday / q5_phone_school / q6_phone_holiday codes:
0=Does not watch/use, 1=<30min, 2=30min-1h, 3=1-2h, 4=>2h (open-ended)."""

_TOTAL_SCREEN_BAND_MINUTES: dict[str, int] = {"1": 15, "2": 45, "3": 90, "4": 180, "5": 270}
"""q10_total_screen_time codes: 1=<30min, 2=30min-1h, 3=1-2h, 4=2-4h,
5=>4h (open-ended). Kept as a secondary/descriptive cross-check only - the
school-day/weekend combination above is the primary continuous variable,
per the "do not make screen-time categories the primary analysis" rule."""

_ACTIVITY_BAND_MINUTES: dict[str, int] = {"1": 15, "2": 45, "3": 90, "4": 150}
"""q11_outdoor_school / q12_outdoor_holiday codes: 1=<30min, 2=30min-1h,
3=1-2h, 4=>2h (open-ended)."""

_SCHOOL_DAYS_PER_WEEK = 5
_WEEKEND_DAYS_PER_WEEK = 2


def _band_minutes(record: dict, field: str, table: dict[str, int]) -> float | None:
    """Raw REDCap code -> band-midpoint minutes. Returns None (never 0) for
    a blank/unanswered/unrecognised code, so a missing response is never
    silently treated as zero screen time."""
    raw = (record.get(field) or "").strip()
    if raw not in table:
        return None
    return float(table[raw])


def _weighted_daily_minutes(school: float | None, weekend: float | None) -> float | None:
    """5 school days + 2 weekend days per week. Only computed when BOTH
    sides are valid observations - a missing school-day or weekend value is
    never imputed as 0, so this returns None rather than a partial average."""
    if school is None or weekend is None:
        return None
    return round((school * _SCHOOL_DAYS_PER_WEEK + weekend * _WEEKEND_DAYS_PER_WEEK) / 7, 1)


def minutes_summary(values: list[float], total: int) -> dict:
    """Same denominator discipline as numeric_summary(), plus median - used
    for the continuous minutes-per-day metrics. Missing is never treated as
    zero: mean/median/min/max are None when there is no valid data."""
    valid_n = len(values)
    return {
        "valid_n": valid_n,
        "missing_n": max(total - valid_n, 0),
        "total": total,
        "percent_valid": percent(valid_n, total),
        "mean": round(mean(values), 1) if values else None,
        "median": round(median(values), 1) if values else None,
        "minimum": min(values) if values else None,
        "maximum": max(values) if values else None,
    }


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
    """Unique-by-child_id records with a non-blank child_id - the same
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


def ordered_category_counts(records: list[dict], field: str, choice_maps: dict[str, ChoiceMap]) -> list[tuple[str, int]]:
    """Same as category_counts, but preserves the field's REDCap choice-code
    order (ascending numeric code) instead of sorting by descending
    frequency. Use this for ordinal fields (e.g. DSEQ Q10 total daily screen
    time) where the category order itself carries meaning. Every category
    defined in the field's choice list is included, even at zero count, so
    the full ordinal scale is always visible rather than only the categories
    that happen to have live responses."""
    field_choices = choice_maps.get(field, {})
    counts: Counter = Counter()
    for record in records:
        value = resolve_value(field, record.get(field), choice_maps)
        if value:
            counts[value] += 1
    ordered_codes = sorted(field_choices.keys(), key=lambda c: (parse_float(c) if parse_float(c) is not None else 0.0, c))
    return [(field_choices[code], counts.get(field_choices[code], 0)) for code in ordered_codes]


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


def response_breakdown(records: list[dict], field: str, choice_maps: dict[str, ChoiceMap]) -> dict:
    """Yes/No/Don't-know/unanswered counts for one coded Yes/No(/Don't know)
    field, resolved from whatever choice labels the field's own REDCap
    metadata actually defines - "don't know" is only ever counted if a
    record's resolved value textually says so; it is never inferred or
    fabricated for fields that don't offer that choice."""
    yes = no = dont_know = 0
    for record in records:
        value = resolve_value(field, record.get(field), choice_maps).strip().lower()
        if value == "yes":
            yes += 1
        elif value == "no":
            no += 1
        elif "know" in value: # e.g. "don't know" / "do not know"
            dont_know += 1
    return {"yes": yes, "no": no, "dont_know": dont_know, "valid_n": yes + no + dont_know}


def build_condition_indicator(
    records: list[dict], field: str, label: str, choice_maps: dict[str, ChoiceMap], asked_n: int,
) -> dict:
    """One coded health/history item as a fully-denominated indicator:
    Yes/No/Don't-know counts, the valid respondent count for THIS question
    (the correct percentage denominator per the audit's denominator rule),
    and missing count against `asked_n` (the number of children who
    completed the instrument this question belongs to - the instrument-level
    denominator, kept distinct from the question-level one)."""
    breakdown = response_breakdown(records, field, choice_maps)
    valid_n = breakdown["valid_n"]
    return {
        "label": label,
        "yes_count": breakdown["yes"],
        "no_count": breakdown["no"],
        "dont_know_count": breakdown["dont_know"],
        "valid_n": valid_n,
        "asked_n": asked_n,
        "missing_count": max(asked_n - valid_n, 0),
        "percent_yes": percent(breakdown["yes"], valid_n),
    }


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
    treated as zero - mean/min/max are None (not 0) when there is no data."""
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
        "named_conditions": [
            build_condition_indicator(reg, field, label, choice_maps, completed) for field, label in CHH_NAMED_CONDITIONS
        ],
        "general_flags": [
            build_condition_indicator(reg, field, label, choice_maps, completed) for field, label in CHH_GENERAL_FLAGS
        ],
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


_SCREEN_MINUTES_BUCKET_EDGES: list[float] = [30, 60, 90, 120, 180, 240]
_SCREEN_MINUTES_BUCKET_LABELS: list[str] = [
    "<30 min", "30-59 min", "60-89 min", "90-119 min", "120-179 min", "180-239 min", "240+ min",
]

_DIFF_MINUTES_BUCKET_EDGES: list[float] = [-60, -30, 0, 30, 60]
_DIFF_MINUTES_BUCKET_LABELS: list[str] = [
    "< -60 min", "-60 to -30 min", "-30 to 0 min", "0 to 30 min", "30 to 60 min", "60+ min",
]
"""Numeric-range bins for weekend-minus-school-day (minutes) - a true
continuous histogram of the derived difference, not broad hand-labelled
qualitative categories. Negative = less screen time on weekends."""

_STUDY_AGES: tuple[int, ...] = (8, 9, 10)


def _record_screen_minutes(record: dict) -> tuple[float | None, float | None, float | None, float | None]:
    """Returns (tv_school, tv_holiday, phone_school, phone_holiday) band
    midpoints for one record - None for any side that is blank/unanswered."""
    return (
        _band_minutes(record, "q2_tv_school", _SCREEN_BAND_MINUTES),
        _band_minutes(record, "q3_tv_holiday", _SCREEN_BAND_MINUTES),
        _band_minutes(record, "q5_phone_school", _SCREEN_BAND_MINUTES),
        _band_minutes(record, "q6_phone_holiday", _SCREEN_BAND_MINUTES),
    )


def build_screen_time_analysis(records: list[dict], choice_maps: dict[str, ChoiceMap]) -> dict:
    
    reg = registered_records(records)
    total = len(reg)
    completed = complete_count(reg, "dseq_complete")
    missing_count = max(total - completed, 0)

    school_values: list[float] = []
    weekend_values: list[float] = []
    weighted_values: list[float] = []
    diff_values: list[float] = []
    tv_daily_values: list[float] = []
    phone_daily_values: list[float] = []
    pa_school_values: list[float] = []
    pa_weekend_values: list[float] = []
    pa_weighted_values: list[float] = []
    scatter_points: list[tuple[float, float]] = []

    age_buckets: dict[int, list[float]] = {age: [] for age in _STUDY_AGES}
    sex_buckets: dict[str, list[float]] = {"Male": [], "Female": []}

    for record in reg:
        tv_school, tv_holiday, phone_school, phone_holiday = _record_screen_minutes(record)
        school_total = tv_school + phone_school if tv_school is not None and phone_school is not None else None
        weekend_total = tv_holiday + phone_holiday if tv_holiday is not None and phone_holiday is not None else None
        if school_total is not None:
            school_values.append(school_total)
        if weekend_total is not None:
            weekend_values.append(weekend_total)
        weighted = _weighted_daily_minutes(school_total, weekend_total)
        if weighted is not None:
            weighted_values.append(weighted)
        if school_total is not None and weekend_total is not None:
            diff_values.append(round(weekend_total - school_total, 1))

        tv_daily = _weighted_daily_minutes(tv_school, tv_holiday)
        if tv_daily is not None:
            tv_daily_values.append(tv_daily)
        phone_daily = _weighted_daily_minutes(phone_school, phone_holiday)
        if phone_daily is not None:
            phone_daily_values.append(phone_daily)

        pa_school = _band_minutes(record, "q11_outdoor_school", _ACTIVITY_BAND_MINUTES)
        pa_weekend = _band_minutes(record, "q12_outdoor_holiday", _ACTIVITY_BAND_MINUTES)
        if pa_school is not None:
            pa_school_values.append(pa_school)
        if pa_weekend is not None:
            pa_weekend_values.append(pa_weekend)
        pa_weighted = _weighted_daily_minutes(pa_school, pa_weekend)
        if pa_weighted is not None:
            pa_weighted_values.append(pa_weighted)

        if weighted is not None and pa_weighted is not None:
            scatter_points.append((weighted, pa_weighted))

        age_years = compute_age_years(parse_date(record.get("child_dob")))
        if weighted is not None and age_years in age_buckets:
            age_buckets[age_years].append(weighted)

        sex_label = resolve_value("baby_gender", record.get("baby_gender"), choice_maps).strip().title()
        if weighted is not None and sex_label in sex_buckets:
            sex_buckets[sex_label].append(weighted)

    household_rules = response_breakdown(reg, "q9_household_rules", choice_maps)

    return {
        "instrument": "DSEQ",
        "completion": {
            "instrument": "DSEQ",
            "completed": completed,
            "total_registered": total,
            "percent": percent(completed, total),
            "coverage_tier": coverage_tier(completed, total),
        },
        "missing_count": missing_count,
        "missing_percent": percent(missing_count, total),
        "average_daily_summary": minutes_summary(weighted_values, total),
        "school_day_summary": minutes_summary(school_values, total),
        "weekend_summary": minutes_summary(weekend_values, total),
        "difference_summary": minutes_summary(diff_values, total),
        "school_vs_weekend": [
            {"group": "School-Day", "mean": minutes_summary(school_values, total)["mean"],
             "median": minutes_summary(school_values, total)["median"], "valid_n": len(school_values)},
            {"group": "Weekend", "mean": minutes_summary(weekend_values, total)["mean"],
             "median": minutes_summary(weekend_values, total)["median"], "valid_n": len(weekend_values)},
        ],
        "screen_time_distribution_minutes": bucket_counts(weighted_values, _SCREEN_MINUTES_BUCKET_EDGES, _SCREEN_MINUTES_BUCKET_LABELS),
        "difference_distribution": bucket_counts(diff_values, _DIFF_MINUTES_BUCKET_EDGES, _DIFF_MINUTES_BUCKET_LABELS),
        "by_age": [
            {"group": f"{age} years", "mean": round(mean(vals), 1) if vals else None, "valid_n": len(vals)}
            for age, vals in age_buckets.items()
        ],
        "by_sex": [
            {"group": sex, "mean": round(mean(vals), 1) if vals else None, "valid_n": len(vals)}
            for sex, vals in sex_buckets.items()
        ],
        "by_device": [
            {"device": "Television", "mean_minutes": round(mean(tv_daily_values), 1) if tv_daily_values else None, "valid_n": len(tv_daily_values)},
            {"device": "Smartphone/Tablet", "mean_minutes": round(mean(phone_daily_values), 1) if phone_daily_values else None, "valid_n": len(phone_daily_values)},
            {"device": "Laptop/Computer", "mean_minutes": None, "valid_n": 0},
        ],
        "purpose_distribution": category_counts(reg, "q13_main_use", choice_maps),
        "supervision_distribution": ordered_category_counts(reg, "q8_supervision", choice_maps),
        "household_rules_distribution": [("Yes", household_rules["yes"]), ("No", household_rules["no"])],
        "household_rules_valid_n": household_rules["valid_n"],
        "physical_activity_school_day_summary": minutes_summary(pa_school_values, total),
        "physical_activity_weekend_summary": minutes_summary(pa_weekend_values, total),
        "physical_activity_school_vs_weekend": [
            {"group": "School-Day", "mean": minutes_summary(pa_school_values, total)["mean"],
             "median": minutes_summary(pa_school_values, total)["median"], "valid_n": len(pa_school_values)},
            {"group": "Weekend", "mean": minutes_summary(pa_weekend_values, total)["mean"],
             "median": minutes_summary(pa_weekend_values, total)["median"], "valid_n": len(pa_weekend_values)},
        ],
        "screen_vs_activity_scatter": [{"screen_minutes": s, "activity_minutes": a} for s, a in scatter_points],
        "total_screen_time_distribution": ordered_category_counts(reg, "q10_total_screen_time", choice_maps),
        "yes_no_items": [(label, yes_count(reg, field, choice_maps)) for field, label in DSEQ_YES_NO_ITEMS],
    }


# REDCap code for the die_*_freq "rarely/never" choice, shared by all 10
# standard food groups plus the "other" item - used only to honor REDCap's
# own skip logic (each group's *_portion field is not shown in REDCap at
# all when its *_freq is this code), never to invent a category.
_DIETARY_RARELY_NEVER_CODE = "8"


def build_other_food_specified(reg: list[dict], choice_maps: dict[str, ChoiceMap], total: int) -> dict:
    """The separate, open-ended "Other food specified" item
    (die_other_specify/die_other_portion/die_other_freq) - distinct from the
    "Other Vegetables"/"Other Fruits" standard food groups. One entry per
    child who actually specified a food (real collected text, never grouped
    or normalized - grouping free-text food names would require an
    invented matching rule the study team hasn't defined). Portion is
    reported as REDCap's own text, with a status distinguishing genuinely
    missing data from a portion REDCap itself never asked for (skip logic:
    die_other_portion only applies when die_other_freq is not "rarely/
    never")."""
    entries = []
    for record in reg:
        food_name = (record.get("die_other_specify") or "").strip()
        if not food_name:
            continue
        freq_raw = (record.get("die_other_freq") or "").strip()
        frequency = resolve_value("die_other_freq", freq_raw, choice_maps) or None
        portion_raw = (record.get("die_other_portion") or "").strip()
        if freq_raw == _DIETARY_RARELY_NEVER_CODE:
            portion, portion_status = None, "not_applicable"
        elif portion_raw:
            portion, portion_status = portion_raw, "recorded"
        else:
            portion, portion_status = None, "not_answered"
        entries.append(
            {
                "food_name": food_name,
                "portion": portion,
                "portion_status": portion_status,
                "frequency": frequency,
                "frequency_status": "recorded" if frequency else "not_answered",
            }
        )
    valid_n = len(entries)
    return {
        "valid_n": valid_n,
        "total": total,
        "percent_valid": percent(valid_n, total),
        "entries": entries,
    }


def build_dietary_analysis(records: list[dict], choice_maps: dict[str, ChoiceMap]) -> dict:
    reg = registered_records(records)
    total = len(reg)
    completed = complete_count(reg, "dietary_intake_complete")

    items = []
    for field, label in DIETARY_LABELS:
        distribution = ordered_category_counts(reg, field, choice_maps)
        valid_n = sum(count for _, count in distribution)
        items.append(
            {
                "field_label": label,
                "distribution": distribution,
                "valid_n": valid_n,
                "missing_n": max(total - valid_n, 0),
                "percent_valid": percent(valid_n, total),
            }
        )

    return {
        "instrument": "Dietary Intake",
        "completion": {
            "instrument": "Dietary Intake",
            "completed": completed,
            "total_registered": total,
            "percent": percent(completed, total),
            "coverage_tier": coverage_tier(completed, total),
        },
        "items": items,
        "other_food_specified": build_other_food_specified(reg, choice_maps, total),
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
