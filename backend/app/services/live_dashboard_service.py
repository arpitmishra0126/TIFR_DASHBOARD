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

from app.ingestion.choice_maps import ChoiceMap, build_choice_maps
from app.ingestion.live_field_map import (
    CORE_BATTERY_COMPLETE_FIELDS,
    CORE_BATTERY_DESCRIPTION,
    CORE_BATTERY_INSTRUMENTS,
    HEALTH_SCREENING_STATUS,
    NEURODEVELOPMENT_STATUS,
    PHYSICAL_ACTIVITY_STATUS,
    REGISTRATION_COMPLETE_FIELD,
    SCREEN_TIME_STATUS,
    SSRS_CHILD_COMPLETE_FIELD,
    SSRS_TEACHER_COMPLETE_FIELD,
)
from app.ingestion.normalize import capitalize_label, compute_age_years, parse_complete_flag, parse_date, parse_float, parse_int
from app.redcap.live_repository import LiveRedCapRepository
from app.services.export_service import build_active_cases_csv, build_active_cases_workbook
from app.schemas.dashboard import (
    AgeBucket,
    CategoryCount,
    DemographicsResponse,
    InstrumentCoverage,
    NumericSummary,
    OverviewResponse,
    ProgressResponse,
    ProgressStage,
    RegistryChild,
    RegistryResponse,
    SexDistribution,
    UnavailableModule,
)

_AGE_BUCKETS = [
    ("0-4", 0, 4),
    ("5-9", 5, 9),
    ("10-14", 10, 14),
    ("15+", 15, 200),
]


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
        age_years=compute_age_years(dob),
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
    buckets = {label: 0 for label, _, _ in _AGE_BUCKETS}
    unknown = 0
    for child in children:
        if child.age_years is None:
            unknown += 1
            continue
        for label, low, high in _AGE_BUCKETS:
            if low <= child.age_years <= high:
                buckets[label] += 1
                break
    result = [AgeBucket(label=label, count=buckets[label]) for label, _, _ in _AGE_BUCKETS]
    if unknown:
        result.append(AgeBucket(label="Unknown", count=unknown))
    return result


def _category_distribution(values: list[str | None]) -> list[CategoryCount]:
    counts = Counter(v for v in values if v)
    return [CategoryCount(code=code, count=count) for code, count in sorted(counts.items())]


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
        return records, build_choice_maps(metadata)

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
            udai_pareek_category_distribution=_category_distribution(udai_categories),
            bg_prasad_category_distribution=_category_distribution(bg_categories),
            per_capita_income_summary=_numeric_summary(per_capita_incomes),
            household_size_summary=_numeric_summary(household_sizes),
            ses_profile_count=ses_profile_count,
            total_registered=len(children),
            notes={
                "udai_pareek_category": "Numeric category code (1-5) — REDCap does not expose text "
                "labels for calculated fields via the API.",
                "bg_prasad_category": "Numeric category code (1-5) — same API limitation.",
                "ses_coverage": f"The SES questionnaire is complete for {ses_profile_count} of "
                f"{len(children)} registered children.",
            },
        )

    async def get_overview(self, force: bool = False) -> OverviewResponse:
        records, choice_maps = await self._load(force=force)
        children = self._normalize_children(records, choice_maps)
        total_registered = len(children)

        core_ids = _core_battery_ids(records)
        ssrs_child_ids = core_ids & _unique_ids_with_complete_field(records, SSRS_CHILD_COMPLETE_FIELD)
        ssrs_teacher_ids = ssrs_child_ids & _unique_ids_with_complete_field(records, SSRS_TEACHER_COMPLETE_FIELD)

        udai_categories = [r.get("scr_pareek_category") or None for r in records]
        registration_complete_count = sum(1 for c in children if c.registration_complete)

        modules_pending = ["health_screening", "physical_activity", "screen_time", "neurodevelopment"]

        return OverviewResponse(
            total_registered=total_registered,
            registration_complete_count=registration_complete_count,
            registration_complete_percent=_percent(registration_complete_count, total_registered),
            core_assessment_count=len(core_ids),
            core_assessment_percent=_percent(len(core_ids), total_registered),
            ssrs_child_count=len(ssrs_child_ids),
            ssrs_child_percent=_percent(len(ssrs_child_ids), total_registered),
            ssrs_teacher_count=len(ssrs_teacher_ids),
            ssrs_teacher_percent=_percent(len(ssrs_teacher_ids), total_registered),
            instrument_coverage=_instrument_coverage(records, total_registered),
            sex_distribution=_sex_distribution(children),
            age_distribution=_age_distribution(children),
            udai_pareek_category_distribution=_category_distribution(udai_categories),
            modules_pending_integration=modules_pending,
            notes={
                "health_screening": "Child Illness History instrument exists but is not yet field-mapped into this dashboard.",
                "physical_activity": "PAQ-A instrument exists but is not yet field-mapped into this dashboard.",
                "screen_time": "DSEQ instrument exists but is not yet field-mapped into this dashboard.",
                "neurodevelopment": "SSRS Teacher instrument exists but is not yet field-mapped into this dashboard.",
            },
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
                label="Core Assessment Battery",
                description=CORE_BATTERY_DESCRIPTION,
                count=core_count,
                percent_of_registered=_percent(core_count, total_registered),
                percent_of_previous_stage=_percent(core_count, registered_count),
            ),
            ProgressStage(
                key="ssrs_child",
                label="SSRS Child",
                description="Social Skills Rating System (Child self-report) completed, "
                "among children who also completed the Core Assessment Battery.",
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

    @staticmethod
    def get_health_screening_status() -> UnavailableModule:
        return UnavailableModule(
            reason="The Child Illness History instrument exists in the live REDCap project "
            "(PID 196), but its field-level content has not yet been mapped into this "
            "dashboard module. Only its instrument-completion status is currently used, "
            "in the Assessment Progress pipeline.",
            unavailable_fields=[s.metric for s in HEALTH_SCREENING_STATUS],
        )

    @staticmethod
    def get_physical_activity_status() -> UnavailableModule:
        return UnavailableModule(
            reason="The PAQ-A instrument exists in the live REDCap project (PID 196), but "
            "its field-level content has not yet been mapped into this dashboard module. "
            "Only its instrument-completion status is currently used, in the Assessment "
            "Progress pipeline.",
            unavailable_fields=[s.metric for s in PHYSICAL_ACTIVITY_STATUS],
        )

    @staticmethod
    def get_screen_time_status() -> UnavailableModule:
        return UnavailableModule(
            reason="The Digital-Screen Exposure Questionnaire (DSEQ) instrument exists in "
            "the live REDCap project (PID 196), but its field-level content has not yet "
            "been mapped into this dashboard module. Only its instrument-completion status "
            "is currently used, in the Assessment Progress pipeline.",
            unavailable_fields=[s.metric for s in SCREEN_TIME_STATUS],
        )

    @staticmethod
    def get_neurodevelopment_status() -> UnavailableModule:
        return UnavailableModule(
            reason="The SSRS Teacher instrument exists in the live REDCap project (PID 196), "
            "but its field-level content has not yet been mapped into this dashboard "
            "module. Only its instrument-completion status is currently used, in the "
            "Assessment Progress pipeline.",
            unavailable_fields=[s.metric for s in NEURODEVELOPMENT_STATUS],
        )
