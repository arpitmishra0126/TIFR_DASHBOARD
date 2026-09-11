from collections import Counter
from statistics import mean

from app.ingestion.choice_maps import ChoiceMap, build_calc_category_maps, build_choice_maps
from app.ingestion.live_field_map import (
    ALL_INSTRUMENTS,
    CORE_BATTERY_COMPLETE_FIELDS,
    CORE_BATTERY_DESCRIPTION,
    CORE_BATTERY_INSTRUMENTS,
    REGISTRATION_COMPLETE_FIELD,
    REGISTRY_INSTRUMENT_ENTRIES,
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
    SANGIAN_ASSESSMENT_FIELDS,
    VWM_ASSESSMENT_FIELDS,
    build_assessment_tool_status_analysis,
    build_dietary_analysis,
    build_health_screening_analysis,
    build_neurodevelopment_analysis,
    build_physical_activity_analysis,
    build_screen_time_analysis,
    coverage_tier,
)
from app.schemas.dashboard import (
    AgeBucket,
    AssessmentDomainStatus,
    AssessmentPooledStatus,
    AssessmentToolItemStatus,
    AssessmentToolStatusResponse,
    CategoryCount,
    ConditionIndicator,
    DemographicsResponse,
    DeviceMinutes,
    DseqCodingScores,
    DietaryFoodItem,
    DietaryIntakeResponse,
    OtherFoodEntry,
    OtherFoodSpecifiedSummary,
    GroupedMinutesPoint,
    HealthScreeningResponse,
    InstrumentCompletion,
    InstrumentCoverage,
    MinutesSummary,
    NeurodevelopmentResponse,
    NumericSummary,
    OverviewResponse,
    PairedMinutesPoint,
    PhysicalActivityResponse,
    ProgressResponse,
    ProgressStage,
    RegistryChild,
    RegistryResponse,
    ScoredItemSummary,
    ScoreSummary,
    ScreenActivityPoint,
    ScreenTimeResponse,
    SexDistribution,
    SSRSInstrumentSummary,
    WeeklyActivityDay,
)


_STUDY_AGE_BUCKETS = [("8 years", 8), ("9 years", 9), ("10 years", 10)]


_AGE_REFERENCE_DATE = None


def _resolve_or_raw(field_name: str, raw_value: str | None, choice_maps: dict[str, ChoiceMap]) -> str | None:
    """Resolve a coded (radio/dropdown) value to its label, or pass a plain
    text field's value through unchanged. Field type is determined by
    whether it appears in the choice-map set built from live metadata - 
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


def _progression_stage(record: dict, core_battery_complete: bool) -> str:
    """Same cumulative definition as the Assessment Progress funnel:
    Registered -> Core Assessment Battery -> SSRS Child -> SSRS Teacher."""
    if not core_battery_complete:
        return "Registered"
    if not parse_complete_flag(record.get(SSRS_CHILD_COMPLETE_FIELD)):
        return "Core Assessment Battery"
    if not parse_complete_flag(record.get(SSRS_TEACHER_COMPLETE_FIELD)):
        return "SSRS Child"
    return "SSRS Teacher"


def _ats_group_status(record: dict, fields: tuple[str, ...]) -> str:
    """One of "done" / "not_done" / "not_answered" for a group of Assessment
    Tool Status fields (Done=1/Not Done=2, blank=unanswered) - "done" only
    when every field in the group is answered Done, "not_answered" only
    when none are answered at all, "not_done" for anything else (an
    explicit Not Done, or a partial mix of done/blank). No score or
    denominator is derived - a status label only."""
    resolved = [(record.get(f) or "").strip() for f in fields]
    if all(v == "" for v in resolved):
        return "not_answered"
    if all(v == "1" for v in resolved):
        return "done"
    return "not_done"


def _assessment_tool_status_detail(record: dict) -> dict[str, str]:
    sangian_fields = tuple(field for field, _ in SANGIAN_ASSESSMENT_FIELDS)
    vwm_field, dccs_field, cd_field = (field for field, _ in VWM_ASSESSMENT_FIELDS)
    return {
        "sangian": _ats_group_status(record, sangian_fields),
        "vwm": _ats_group_status(record, (vwm_field,)),
        "dccs": _ats_group_status(record, (dccs_field,)),
        "cd": _ats_group_status(record, (cd_field,)),
    }


def _normalize_child(record: dict, choice_maps: dict[str, ChoiceMap]) -> RegistryChild | None:
    child_id = _child_id(record)
    if not child_id:
        return None

    dob = parse_date(record.get("child_dob"))
    visit_date = parse_date(record.get("visit_date"))
    instrument_status = {key: parse_complete_flag(record.get(field)) for key, field, _ in REGISTRY_INSTRUMENT_ENTRIES}
    core_battery_complete = all(parse_complete_flag(record.get(f)) for f in CORE_BATTERY_COMPLETE_FIELDS)
    return RegistryChild(
        redcap_child_id=child_id,
        sex=capitalize_label(_resolve_or_raw("baby_gender", record.get("baby_gender"), choice_maps)),
        dob=dob.isoformat() if dob else None,
        age_years=compute_age_years(dob, as_of=_AGE_REFERENCE_DATE),
        village=_resolve_or_raw("village_name", record.get("village_name"), choice_maps),
        child_status=_resolve_or_raw("baby_status", record.get("baby_status"), choice_maps),
        visit_date=visit_date.isoformat() if visit_date else None,
        registration_complete=parse_complete_flag(record.get(REGISTRATION_COMPLETE_FIELD)),
        instrument_status=instrument_status,
        assessment_tool_status_detail=_assessment_tool_status_detail(record),
        core_battery_complete=core_battery_complete,
        progression_stage=_progression_stage(record, core_battery_complete),
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
    instruments individually (not the all-six intersection - see
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
    field - never derived from another instrument's count. For the
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


def _apply_registry_filters(
    children: list[RegistryChild],
    *,
    search: str | None = None,
    sex: str | None = None,
    village: str | None = None,
    missing_instrument: str | None = None,
    core_battery_complete: bool | None = None,
    progression_stage: str | None = None,
    visit_date_from: str | None = None,
    visit_date_to: str | None = None,
    data_review: bool = False,
) -> list[RegistryChild]:
    """Shared Registry filter set - used by both the paginated Registry
    listing and the Active Cases exports, so 'export the currently filtered
    result' can never diverge from what the Registry table actually shows."""
    if search:
        needle = search.strip().lower()
        children = [c for c in children if needle in c.redcap_child_id.lower()]
    if sex:
        children = [c for c in children if (c.sex or "").strip().lower() == sex.strip().lower()]
    if village:
        children = [c for c in children if (c.village or "").strip().lower() == village.strip().lower()]
    if missing_instrument:
        children = [c for c in children if not c.instrument_status.get(missing_instrument, False)]
    if core_battery_complete is not None:
        children = [c for c in children if c.core_battery_complete == core_battery_complete]
    if progression_stage:
      
        stages = {s.strip() for s in progression_stage.split(",") if s.strip()}
        children = [c for c in children if c.progression_stage in stages]
    if visit_date_from:
        children = [c for c in children if c.visit_date and c.visit_date >= visit_date_from]
    if visit_date_to:
        children = [c for c in children if c.visit_date and c.visit_date <= visit_date_to]
    if data_review:
     
        children = [c for c in children if not c.sex or not c.village or c.age_years is None]
    return children


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

    async def get_active_cases_export(
        self,
        force: bool = False,
        **filters,
    ) -> bytes:
    
        records, choice_maps = await self._load(force=force)
        children = self._normalize_children(records, choice_maps)
        if filters:
            children = _apply_registry_filters(children, **filters)
        return build_active_cases_workbook(children, records, choice_maps)

    async def get_active_cases_csv_export(
        self,
        force: bool = False,
        **filters,
    ) -> str:
      
        records, choice_maps = await self._load(force=force)
        children = self._normalize_children(records, choice_maps)
        if filters:
            children = _apply_registry_filters(children, **filters)
        return build_active_cases_csv(children, records)

    async def get_registry(
        self,
        search: str | None = None,
        sex: str | None = None,
        village: str | None = None,
        missing_instrument: str | None = None,
        core_battery_complete: bool | None = None,
        progression_stage: str | None = None,
        visit_date_from: str | None = None,
        visit_date_to: str | None = None,
        data_review: bool = False,
        limit: int = 50,
        offset: int = 0,
        force: bool = False,
    ) -> RegistryResponse:
        records, choice_maps = await self._load(force=force)
        children = self._normalize_children(records, choice_maps)
        children = _apply_registry_filters(
            children,
            search=search,
            sex=sex,
            village=village,
            missing_instrument=missing_instrument,
            core_battery_complete=core_battery_complete,
            progression_stage=progression_stage,
            visit_date_from=visit_date_from,
            visit_date_to=visit_date_to,
            data_review=data_review,
        )

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
        ssrs_parent_ids = _unique_ids_with_complete_field(records, SSRS_PARENT_COMPLETE_FIELD)
        ssrs_child_completion_ids = _unique_ids_with_complete_field(records, SSRS_CHILD_COMPLETE_FIELD)
        ssrs_teacher_ids = (
            core_ids
            & ssrs_child_completion_ids
            & _unique_ids_with_complete_field(records, SSRS_TEACHER_COMPLETE_FIELD)
        )

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
            ssrs_child_count=len(ssrs_child_completion_ids),
            ssrs_child_percent=_percent(len(ssrs_child_completion_ids), total_registered),
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
            item_scores=[ScoredItemSummary(**item) for item in analysis["item_scores"]],
            weekly_activity=[WeeklyActivityDay(**day) for day in analysis["weekly_activity"]],
            item10_exclusion=ConditionIndicator(**analysis["item10_exclusion"]),
            notes={
                "scores": "Item 1, Item 8 and Total scores are REDCap-calculated fields (paq_item1_score, "
                "paq_item8_score, paq_total_score), not derived by this dashboard. Item 9 (Monday-Sunday mean) "
                "and Item 10 (illness/exclusion) follow the approved PAQ-C scoring specification's numbering, "
                "which is one higher than REDCap's own internal field labels for these two items.",
            },
        )

    async def get_screen_time(self, force: bool = False) -> ScreenTimeResponse:
        records, choice_maps = await self._load(force=force)
        analysis = build_screen_time_analysis(records, choice_maps)
        return ScreenTimeResponse(
            instrument=analysis["instrument"],
            completion=InstrumentCompletion(**analysis["completion"]),
            missing_count=analysis["missing_count"],
            missing_percent=analysis["missing_percent"],
            coding_scores=DseqCodingScores(
                frequency=ScoreSummary(**analysis["coding_scores"]["frequency"]),
                duration=ScoreSummary(**analysis["coding_scores"]["duration"]),
                supervision=ScoreSummary(**analysis["coding_scores"]["supervision"]),
                household_rules=ScoreSummary(**analysis["coding_scores"]["household_rules"]),
            ),
            average_daily_summary=MinutesSummary(**analysis["average_daily_summary"]),
            school_day_summary=MinutesSummary(**analysis["school_day_summary"]),
            weekend_summary=MinutesSummary(**analysis["weekend_summary"]),
            difference_summary=MinutesSummary(**analysis["difference_summary"]),
            school_vs_weekend=[PairedMinutesPoint(**point) for point in analysis["school_vs_weekend"]],
            screen_time_distribution_minutes=[
                CategoryCount(code=label, count=count) for label, count in analysis["screen_time_distribution_minutes"]
            ],
            difference_distribution=[CategoryCount(code=label, count=count) for label, count in analysis["difference_distribution"]],
            by_age=[GroupedMinutesPoint(**point) for point in analysis["by_age"]],
            by_sex=[GroupedMinutesPoint(**point) for point in analysis["by_sex"]],
            by_device=[DeviceMinutes(**point) for point in analysis["by_device"]],
            purpose_distribution=[CategoryCount(code=label, count=count) for label, count in analysis["purpose_distribution"]],
            supervision_distribution=[CategoryCount(code=label, count=count) for label, count in analysis["supervision_distribution"]],
            household_rules_distribution=[
                CategoryCount(code=label, count=count) for label, count in analysis["household_rules_distribution"]
            ],
            household_rules_valid_n=analysis["household_rules_valid_n"],
            physical_activity_school_day_summary=MinutesSummary(**analysis["physical_activity_school_day_summary"]),
            physical_activity_weekend_summary=MinutesSummary(**analysis["physical_activity_weekend_summary"]),
            physical_activity_school_vs_weekend=[
                PairedMinutesPoint(**point) for point in analysis["physical_activity_school_vs_weekend"]
            ],
            screen_vs_activity_scatter=[ScreenActivityPoint(**point) for point in analysis["screen_vs_activity_scatter"]],
            total_screen_time_distribution=[CategoryCount(code=label, count=count) for label, count in analysis["total_screen_time_distribution"]],
            yes_no_items=[CategoryCount(code=label, count=count) for label, count in analysis["yes_no_items"]],
            notes={
                "scope": "Average/median/school-day/weekend screen time are derived from DSEQ's per-device "
                "duration items (q2/q3 TV, q5/q6 smartphone/tablet), each converted from its REDCap ordinal "
                "band to that band's midpoint in minutes - an estimate, not an exact measurement. "
                "Laptop/computer (q7) has no duration field in REDCap (only weekly-use frequency), so it is "
                "excluded from every minutes total. Q10 (total daily screen time) and Q9/Q14/Q15 remain as "
                "secondary, purely descriptive categorical cross-checks per the approved 2026-08-26 scope, "
                "not the primary analysis. Physical activity here is DSEQ's own Section B outdoor-play items "
                "(q11/q12) - distinct from the separate PAQ-C-based Physical Activity page.",
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
            other_food_specified=OtherFoodSpecifiedSummary(
                valid_n=analysis["other_food_specified"]["valid_n"],
                total=analysis["other_food_specified"]["total"],
                percent_valid=analysis["other_food_specified"]["percent_valid"],
                entries=[OtherFoodEntry(**entry) for entry in analysis["other_food_specified"]["entries"]],
            ),
            notes={
                "scope": "10 food-group frequency items from the Dietary Intake instrument, each shown as "
                "its own 8-point frequency distribution, plus the separate open-ended 'Other food specified' "
                "item (food name/portion/frequency, real respondent text only). Portion-size fields for the "
                "10 standard groups are free text (local unit + quantity, no REDCap choice list) and are "
                "intentionally NOT bucketed into size categories or charted as portion x frequency here - "
                "that requires a study-team-defined portion-size classification, which does not yet exist. "
                "This is a pending item, not an omission.",
            },
        )

    async def get_assessment_tool_status(self, force: bool = False) -> AssessmentToolStatusResponse:
        records, _choice_maps = await self._load(force=force)
        analysis = build_assessment_tool_status_analysis(records)
        return AssessmentToolStatusResponse(
            instrument=analysis["instrument"],
            completion=InstrumentCompletion(**analysis["completion"]),
            sangian=AssessmentDomainStatus(**analysis["sangian"]),
            vwm=AssessmentDomainStatus(**analysis["vwm"]),
            overall=AssessmentDomainStatus(**analysis["overall"]),
            overall_pooled=AssessmentPooledStatus(**analysis["overall_pooled"]),
            items=[AssessmentToolItemStatus(**item) for item in analysis["items"]],
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
                "SSRS rating items - the same calculation used in the Active Cases Excel export. Not a "
                "validated SSRS composite score. Individual SSRS Teacher item ratings (t43-t51) are not part "
                "of the approved analytical specification.",
                "ssrs_teacher": "0 live Teacher assessments are complete - Teacher's counts/summaries will "
                "populate automatically once real data exists; no value has been invented here.",
            },
        )
