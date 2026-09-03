"""In-memory normalization + aggregation layer between the live REDCap
record export and the dashboard-facing schemas.

REDCap -> RedCapClient -> LiveRedCapRepository (cache) -> this service
(normalize + aggregate) -> Pydantic schemas -> API routes -> React UI.

No database. No persistence. No writes back to REDCap. Every function here
is deterministic given its inputs, so the whole module is unit-testable
against fixture metadata/records without a live connection.

Data source: REDCap project PID 196 ("ICMR Neurodevelopment Study"). See
app.ingestion.live_field_map for the confirmed field/instrument mapping and
CORE_BATTERY_COMPLETE_FIELDS for the six instruments making up the "Core
Assessment Battery" pipeline stage.
"""
from collections import Counter
from statistics import mean

from app.ingestion.choice_maps import ChoiceMap, build_calc_category_maps, build_choice_maps
from app.ingestion.live_field_map import (
    ALL_INSTRUMENTS,
    CORE_BATTERY_COMPLETE_FIELDS,
    CORE_BATTERY_DESCRIPTION,
    CORE_BATTERY_INSTRUMENTS,
    REGISTRATION_COMPLETE_FIELD,
    SSRS_CHILD_COMPLETE_FIELD,
    SSRS_CHILD_FREQ_FIELDS,
    SSRS_CHILD_IMP_FIELDS,
    SSRS_PARENT_COMPLETE_FIELD,
    SSRS_PARENT_FREQ_FIELDS,
    SSRS_PARENT_IMP_FIELDS,
    SSRS_TEACHER_COMPLETE_FIELD,
    SSRS_TEACHER_FREQ_FIELDS,
    SSRS_TEACHER_IMP_FIELDS,
)
from app.ingestion.normalize import capitalize_label, compute_age_years, parse_complete_flag, parse_date, parse_float, parse_int
from app.redcap.live_repository import LiveRedCapRepository
from app.services.export_service import build_active_cases_csv, build_active_cases_workbook
from app.services.module_analytics import (
    build_dietary_analysis,
    build_health_screening_analysis,
    build_neurodevelopment_analysis,
    build_physical_activity_analysis,
    build_screen_time_analysis,
    coverage_tier,
)
from app.schemas.dashboard import (
    AgeBucket,
    CategoryCount,
    ConditionIndicator,
    DemographicsResponse,
    DietaryFoodItem,
    DietaryIntakeResponse,
    HealthScreeningResponse,
    InstrumentCompletion,
    InstrumentCoverage,
    NeurodevelopmentResponse,
    NumericSummary,
    OverviewResponse,
    PhysicalActivityResponse,
    ProgressResponse,
    ProgressStage,
    RegistryChild,
    RegistryResponse,
    ScoreSummary,
    ScreenTimeResponse,
    SexDistribution,
    SSRSInstrumentSummary,
)

# Study-specific age groups (replacing the previous broad 0-4/5-9/10-14/15+
# bands) — the cohort's target ages per the study team's 2026-09-03 request.
# "Other" is only shown when a registered child's computed age genuinely
# falls outside 8-10 (data-integrity visibility, not an expected bucket).
_STUDY_AGE_BUCKETS = [("8 years", 8), ("9 years", 9), ("10 years", 10)]

# Reference date used for age = (reference - child_dob) in whole years.
# The audit found no REDCap field/metadata establishing a different
# convention, so the dashboard's existing "as of today" behavior is
# preserved unchanged here (see app.ingestion.normalize.compute_age_years,
# which already accepts an explicit `as_of` and defaults to date.today()).
# If the study team later confirms a different reference (e.g. each child's
# `visit_date`), change this single constant rather than the bucket logic.
_AGE_REFERENCE_DATE = None


def _resolve_or_raw(field_name: str, raw_value: str | None, choice_maps: dict[str, ChoiceMap]) -> str | None:
    """Resolve a coded (radio/dropdown) value to its label, or pass a plain
    text field's value through unchanged. Field type is determined by
    whether it appears in the choice-map set built from live metadata —
    this way the same normalization code works whether a given field is
    coded or free text, without hard-coding that assumption per field.
    """
    if raw_value is None or raw_value.strip() == "":
        return None
    field_choices = choice_maps.get(field_name)
    if field_choices is not None:
        return field_choices.get(raw_value)
    return raw_value.strip()


def _child_id(record: dict) -> str:
    return (record.get("child_id") or "").strip()


def _normalize_child(record: dict, choice_maps: dict[str, ChoiceMap]) -> RegistryChild | None:
    child_id = _child_id(record)
    if not child_id:
        return None

    dob = parse_date(record.get("child_dob"))
    visit_date = parse_date(record.get("visit_date"))
    return RegistryChild(
        redcap_child_id=child_id,
        sex=capitalize_label(_resolve_or_raw("baby_gender", record.get("baby_gender"), choice_maps)),
        dob=dob.isoformat() if dob else None,
        age_years=compute_age_years(dob, as_of=_AGE_REFERENCE_DATE),
        village=_resolve_or_raw("village_name", record.get("village_name"), choice_maps),
        child_status=_resolve_or_raw("baby_status", record.get("baby_status"), choice_maps),
        visit_date=visit_date.isoformat() if visit_date else None,
        registration_complete=parse_complete_flag(record.get(REGISTRATION_COMPLETE_FIELD)),
    )


def _sex_distribution(children: list[RegistryChild]) -> SexDistribution:
    counts = Counter((c.sex or "").strip().lower() for c in children)
    return SexDistribution(
        male=counts.get("male", 0),
        female=counts.get("female", 0),
        unknown=sum(v for k, v in counts.items() if k not in ("male", "female")),
    )


def _age_distribution(children: list[RegistryChild]) -> list[AgeBucket]:
    buckets = {label: 0 for label, _ in _STUDY_AGE_BUCKETS}
    other = 0
    unknown = 0
    for child in children:
        if child.age_years is None:
            unknown += 1
            continue
        matched = False
        for label, year in _STUDY_AGE_BUCKETS:
            if child.age_years == year:
                buckets[label] += 1
                matched = True
                break
        if not matched:
            other += 1
    result = [AgeBucket(label=label, count=buckets[label]) for label, _ in _STUDY_AGE_BUCKETS]
    if other:
        result.append(AgeBucket(label="Other (outside 8-10 years)", count=other))
    if unknown:
        result.append(AgeBucket(label="Unknown", count=unknown))
    return result


def _category_distribution(values: list[str | None]) -> list[CategoryCount]:
    counts = Counter(v for v in values if v)
    return [CategoryCount(code=code, count=count) for code, count in sorted(counts.items())]


def _ordered_labeled_category_distribution(
    raw_values: list[str | None], field_name: str, choice_maps: dict[str, ChoiceMap],
) -> list[CategoryCount]:
    """Category distribution for a numerically-coded field (e.g. an SES
    category), ordered by the underlying numeric code (preserving logical
    category ordering) and displayed using the field's resolved label — via
    the same choice_maps mechanism used everywhere else, so a calc field's
    documented field_note labels (see build_calc_category_maps) are used
    when available, and the raw code is shown unchanged otherwise (never an
    invented label)."""
    counts = Counter(v for v in raw_values if v)
    field_choices = choice_maps.get(field_name, {})
    ordered_codes = sorted(counts.keys(), key=lambda c: (parse_float(c) if parse_float(c) is not None else 0.0, c))
    return [CategoryCount(code=field_choices.get(code, code), count=counts[code]) for code in ordered_codes]


def _numeric_summary(values: list[float]) -> NumericSummary | None:
    if not values:
        return None
    return NumericSummary(count=len(values), mean=round(mean(values), 2), minimum=min(values), maximum=max(values))


def _percent(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 2)


def _unique_ids_with_complete_field(records: list[dict], field: str) -> set[str]:
    return {_child_id(r) for r in records if _child_id(r) and parse_complete_flag(r.get(field))}


def _instrument_coverage(records: list[dict], total_registered: int) -> list[InstrumentCoverage]:
    """Live completion count + percentage for each of the six core-battery
    instruments individually (not the all-six intersection — see
    core_assessment_count for that)."""
    coverage = []
    for key, field, label in CORE_BATTERY_INSTRUMENTS:
        completed = len(_unique_ids_with_complete_field(records, field))
        coverage.append(
            InstrumentCoverage(
                key=key,
                label=label,
                completed_count=completed,
                percent_of_registered=_percent(completed, total_registered),
                coverage_tier=coverage_tier(completed, total_registered),
            )
        )
    return coverage


def _all_instrument_coverage(records: list[dict], total_registered: int) -> list[InstrumentCoverage]:
    """Live completion count + percentage for each of the nine live REDCap
    instruments individually (Registration + all eight assessment
    instruments), each calculated independently from its own completion
    field — never derived from another instrument's count. For the
    Overview 'Assessment Instrument Coverage' panel."""
    coverage = []
    for key, field, label in ALL_INSTRUMENTS:
        completed = len(_unique_ids_with_complete_field(records, field))
        coverage.append(
            InstrumentCoverage(
                key=key,
                label=label,
                completed_count=completed,
                percent_of_registered=_percent(completed, total_registered),
                coverage_tier=coverage_tier(completed, total_registered),
            )
        )
    return coverage


def _core_battery_ids(records: list[dict]) -> set[str]:
    """Unique child_ids where ALL six core-battery instruments are complete."""
    per_field_ids = [_unique_ids_with_complete_field(records, field) for field in CORE_BATTERY_COMPLETE_FIELDS]
    if not per_field_ids:
        return set()
    result = per_field_ids[0]
    for ids in per_field_ids[1:]:
        result = result & ids
    return result


class LiveDashboardService:
    def __init__(self, repository: LiveRedCapRepository) -> None:
        self._repository = repository

    async def _load(self, force: bool = False) -> tuple[list[dict], dict[str, ChoiceMap]]:
        metadata = await self._repository.get_metadata(force=force)
        records = await self._repository.get_records(force=force)
        choice_maps = build_choice_maps(metadata)
        choice_maps.update(build_calc_category_maps(metadata))
        return records, choice_maps

    def _normalize_children(self, records: list[dict], choice_maps: dict[str, ChoiceMap]) -> list[RegistryChild]:
        return [c for r in records if (c := _normalize_child(r, choice_maps)) is not None]

    async def get_active_cases_export(self, force: bool = False) -> bytes:
        """Build the Active Cases newsletter workbook (.xlsx bytes) from live data."""
        records, choice_maps = await self._load(force=force)
        children = self._normalize_children(records, choice_maps)
        return build_active_cases_workbook(children, records, choice_maps)

    async def get_active_cases_csv_export(self, force: bool = False) -> str:
        """Build the Active Cases CSV export from live data."""
        records, choice_maps = await self._load(force=force)
        children = self._normalize_children(records, choice_maps)
        return build_active_cases_csv(children, records)

    async def get_registry(
        self,
        search: str | None = None,
        sex: str | None = None,
        village: str | None = None,
        limit: int = 50,
        offset: int = 0,
        force: bool = False,
    ) -> RegistryResponse:
        records, choice_maps = await self._load(force=force)
        children = self._normalize_children(records, choice_maps)

        if search:
            needle = search.strip().lower()
            children = [c for c in children if needle in c.redcap_child_id.lower()]
        if sex:
            children = [c for c in children if (c.sex or "").strip().lower() == sex.strip().lower()]
        if village:
            children = [c for c in children if (c.village or "").strip().lower() == village.strip().lower()]

        total = len(children)
        page = children[offset : offset + limit]

        return RegistryResponse(
            total=total,
            limit=limit,
            offset=offset,
            children=page,
            unavailable_fields=[],
        )

    async def get_demographics(self, force: bool = False) -> DemographicsResponse:
        records, choice_maps = await self._load(force=force)
        children = self._normalize_children(records, choice_maps)

        udai_categories = [r.get("scr_pareek_category") or None for r in records]
        bg_categories = [r.get("scr_prasad_category") or None for r in records]
        per_capita_incomes = [v for r in records if (v := parse_float(r.get("scr_pci"))) is not None]
        household_sizes = [
            float(v) for r in records if (v := parse_int(r.get("scr_bg_members"))) is not None
        ]
        ses_profile_count = sum(1 for r in records if (r.get("scr_pareek_total") or "").strip() != "")

        return DemographicsResponse(
            sex_distribution=_sex_distribution(children),
            age_distribution=_age_distribution(children),
            udai_pareek_category_distribution=_ordered_labeled_category_distribution(
                udai_categories, "scr_pareek_category", choice_maps
            ),
            bg_prasad_category_distribution=_ordered_labeled_category_distribution(
                bg_categories, "scr_prasad_category", choice_maps
            ),
            per_capita_income_summary=_numeric_summary(per_capita_incomes),
            household_size_summary=_numeric_summary(household_sizes),
            ses_profile_count=ses_profile_count,
            total_registered=len(children),
            notes={
                "udai_pareek_category": "Category labels (Upper/Upper-middle/Middle/Lower-middle/Lower) "
                "are parsed from the REDCap calc field's own documented field_note text.",
                "bg_prasad_category": "Category labels parsed the same way from the REDCap calc field's "
                "field_note text.",
                "ses_coverage": f"The SES questionnaire is complete for {ses_profile_count} of "
                f"{len(children)} registered children.",
            },
        )

    async def get_overview(self, force: bool = False) -> OverviewResponse:
        records, choice_maps = await self._load(force=force)
        children = self._normalize_children(records, choice_maps)
        total_registered = len(children)

        core_ids = _core_battery_ids(records)
        # SSRS Parent is computed independently from ssrs_parent_complete —
        # NOT derived from core_ids — even though SSRS Parent is also one of
        # the six instruments required for the Completed Assessment Set.
        ssrs_parent_ids = _unique_ids_with_complete_field(records, SSRS_PARENT_COMPLETE_FIELD)
        ssrs_child_ids = core_ids & _unique_ids_with_complete_field(records, SSRS_CHILD_COMPLETE_FIELD)
        ssrs_teacher_ids = ssrs_child_ids & _unique_ids_with_complete_field(records, SSRS_TEACHER_COMPLETE_FIELD)

        udai_categories = [r.get("scr_pareek_category") or None for r in records]
        registration_complete_count = sum(1 for c in children if c.registration_complete)

        chh_analysis = build_health_screening_analysis(records, choice_maps)
        dseq_analysis = build_screen_time_analysis(records, choice_maps)

        return OverviewResponse(
            total_registered=total_registered,
            registration_complete_count=registration_complete_count,
            registration_complete_percent=_percent(registration_complete_count, total_registered),
            core_assessment_count=len(core_ids),
            core_assessment_percent=_percent(len(core_ids), total_registered),
            ssrs_parent_count=len(ssrs_parent_ids),
            ssrs_parent_percent=_percent(len(ssrs_parent_ids), total_registered),
            ssrs_child_count=len(ssrs_child_ids),
            ssrs_child_percent=_percent(len(ssrs_child_ids), total_registered),
            ssrs_teacher_count=len(ssrs_teacher_ids),
            ssrs_teacher_percent=_percent(len(ssrs_teacher_ids), total_registered),
            instrument_coverage=_instrument_coverage(records, total_registered),
            all_instrument_coverage=_all_instrument_coverage(records, total_registered),
            sex_distribution=_sex_distribution(children),
            age_distribution=_age_distribution(children),
            udai_pareek_category_distribution=_ordered_labeled_category_distribution(
                udai_categories, "scr_pareek_category", choice_maps
            ),
            chh_completion=InstrumentCompletion(**chh_analysis["completion"]),
            chh_named_conditions=[ConditionIndicator(**c) for c in chh_analysis["named_conditions"]],
            chh_general_flags=[ConditionIndicator(**c) for c in chh_analysis["general_flags"]],
            dseq_completion=InstrumentCompletion(**dseq_analysis["completion"]),
            dseq_screen_time_distribution=[
                CategoryCount(code=label, count=count) for label, count in dseq_analysis["total_screen_time_distribution"]
            ],
            modules_pending_integration=[],
            notes={},
        )

    async def get_progress(self, force: bool = False) -> ProgressResponse:
        records, _ = await self._load(force=force)
        total_registered = len({_child_id(r) for r in records if _child_id(r)})

        core_ids = _core_battery_ids(records)
        ssrs_child_ids = core_ids & _unique_ids_with_complete_field(records, SSRS_CHILD_COMPLETE_FIELD)
        ssrs_teacher_ids = ssrs_child_ids & _unique_ids_with_complete_field(records, SSRS_TEACHER_COMPLETE_FIELD)

        registered_count = total_registered
        core_count = len(core_ids)
        ssrs_child_count = len(ssrs_child_ids)
        ssrs_teacher_count = len(ssrs_teacher_ids)

        stages = [
            ProgressStage(
                key="registered",
                label="Registered",
                description="Children with a registration record in REDCap.",
                count=registered_count,
                percent_of_registered=_percent(registered_count, total_registered),
                percent_of_previous_stage=None,
            ),
            ProgressStage(
                key="core_assessment_battery",
                # This grouping IS the genuine six-instrument intersection
                # (CORE_BATTERY_COMPLETE_FIELDS) used as the gate for the
                # SSRS Child/Teacher stages below, so "Core REDCap
                # Instruments Completed" honestly names what it measures —
                # unlike the earlier placeholder "Completed Assessment Set"
                # wording, it doesn't imply a validated clinical milestone.
                label="Core REDCap Instruments Completed",
                description=CORE_BATTERY_DESCRIPTION,
                count=core_count,
                percent_of_registered=_percent(core_count, total_registered),
                percent_of_previous_stage=_percent(core_count, registered_count),
            ),
            ProgressStage(
                key="ssrs_child",
                label="SSRS Child",
                description="Social Skills Rating System (Child self-report) completed, "
                "among children who also completed the core REDCap instruments.",
                count=ssrs_child_count,
                percent_of_registered=_percent(ssrs_child_count, total_registered),
                percent_of_previous_stage=_percent(ssrs_child_count, core_count),
            ),
            ProgressStage(
                key="ssrs_teacher",
                label="SSRS Teacher",
                description="Social Skills Rating System (Teacher report) completed, "
                "among children who also completed SSRS Child.",
                count=ssrs_teacher_count,
                percent_of_registered=_percent(ssrs_teacher_count, total_registered),
                percent_of_previous_stage=_percent(ssrs_teacher_count, ssrs_child_count),
            ),
        ]

        return ProgressResponse(total_registered=total_registered, stages=stages)

    async def get_health_screening(self, force: bool = False) -> HealthScreeningResponse:
        records, choice_maps = await self._load(force=force)
        analysis = build_health_screening_analysis(records, choice_maps)
        return HealthScreeningResponse(
            instrument=analysis["instrument"],
            completion=InstrumentCompletion(**analysis["completion"]),
            named_conditions=[ConditionIndicator(**c) for c in analysis["named_conditions"]],
            general_flags=[ConditionIndicator(**c) for c in analysis["general_flags"]],
            notes={
                "scope": "Named conditions and general flags approved 2026-08-26; item-level Child Illness "
                "History fields not in this list (e.g. health rating, fit-for-assessment) are exported in the "
                "Active Cases Excel sheet but not part of the approved dashboard analysis.",
            },
        )

    async def get_physical_activity(self, force: bool = False) -> PhysicalActivityResponse:
        records, choice_maps = await self._load(force=force)
        analysis = build_physical_activity_analysis(records, choice_maps)
        return PhysicalActivityResponse(
            instrument=analysis["instrument"],
            completion=InstrumentCompletion(**analysis["completion"]),
            item1_summary=ScoreSummary(**analysis["item1_summary"]),
            item8_summary=ScoreSummary(**analysis["item8_summary"]),
            total_summary=ScoreSummary(**analysis["total_summary"]),
            total_score_distribution=[CategoryCount(code=label, count=count) for label, count in analysis["total_score_distribution"]],
            notes={
                "scores": "Item 1, Item 8 and Total scores are REDCap-calculated fields (paq_item1_score, "
                "paq_item8_score, paq_total_score), not derived by this dashboard.",
            },
        )

    async def get_screen_time(self, force: bool = False) -> ScreenTimeResponse:
        records, choice_maps = await self._load(force=force)
        analysis = build_screen_time_analysis(records, choice_maps)
        return ScreenTimeResponse(
            instrument=analysis["instrument"],
            completion=InstrumentCompletion(**analysis["completion"]),
            total_screen_time_distribution=[CategoryCount(code=label, count=count) for label, count in analysis["total_screen_time_distribution"]],
            yes_no_items=[CategoryCount(code=label, count=count) for label, count in analysis["yes_no_items"]],
            notes={
                "scope": "Q10 total daily screen time distribution and 3 Yes/No items (Q9, Q14, Q15) approved "
                "2026-08-26; per-item TV/phone/laptop frequency breakdowns are exported in the Active Cases "
                "Excel sheet but not part of the approved dashboard analysis.",
            },
        )

    async def get_dietary_intake(self, force: bool = False) -> DietaryIntakeResponse:
        records, choice_maps = await self._load(force=force)
        analysis = build_dietary_analysis(records, choice_maps)
        return DietaryIntakeResponse(
            instrument=analysis["instrument"],
            completion=InstrumentCompletion(**analysis["completion"]),
            items=[
                DietaryFoodItem(
                    field_label=item["field_label"],
                    distribution=[CategoryCount(code=label, count=count) for label, count in item["distribution"]],
                    valid_n=item["valid_n"],
                    missing_n=item["missing_n"],
                    percent_valid=item["percent_valid"],
                )
                for item in analysis["items"]
            ],
            notes={
                "scope": "10 food-group frequency items from the Dietary Intake instrument, each shown as "
                "its own 8-point frequency distribution. Portion-size free-text fields are excluded.",
            },
        )

    async def get_neurodevelopment(self, force: bool = False) -> NeurodevelopmentResponse:
        records, choice_maps = await self._load(force=force)
        analysis = build_neurodevelopment_analysis(
            records, choice_maps,
            SSRS_PARENT_FREQ_FIELDS, SSRS_PARENT_IMP_FIELDS,
            SSRS_CHILD_FREQ_FIELDS, SSRS_CHILD_IMP_FIELDS,
            SSRS_TEACHER_FREQ_FIELDS, SSRS_TEACHER_IMP_FIELDS,
        )
        def _instrument_summary(data: dict) -> SSRSInstrumentSummary:
            return SSRSInstrumentSummary(
                instrument=data["instrument"],
                children_with_any_data=data["children_with_any_data"],
                total_registered=data["total_registered"],
                percent=data["percent"],
                completed_count=data["completed_count"],
                avg_frequency_summary=ScoreSummary(**data["avg_frequency_summary"]),
                avg_importance_summary=ScoreSummary(**data["avg_importance_summary"]),
            )

        return NeurodevelopmentResponse(
            parent=_instrument_summary(analysis["parent"]),
            child=_instrument_summary(analysis["child"]),
            teacher=_instrument_summary(analysis["teacher"]),
            notes={
                "scope": "Items-answered counts and mean frequency/importance ratings, computed from the raw "
                "SSRS rating items — the same calculation used in the Active Cases Excel export. Not a "
                "validated SSRS composite score. Individual SSRS Teacher item ratings (t43-t51) are not part "
                "of the approved analytical specification.",
                "ssrs_teacher": "0 live Teacher assessments are complete — Teacher's counts/summaries will "
                "populate automatically once real data exists; no value has been invented here.",
            },
        )
