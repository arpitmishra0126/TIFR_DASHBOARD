from datetime import date

import pytest

from app.services.live_dashboard_service import LiveDashboardService
from tests.fixtures.live_redcap import FIXTURE_METADATA, FakeRedCapRepository, build_fixture_records

AS_OF = date(2026, 8, 25)


@pytest.fixture()
def service() -> LiveDashboardService:
    records = build_fixture_records(AS_OF)
    repo = FakeRedCapRepository(FIXTURE_METADATA, records)
    return LiveDashboardService(repo)


# --- Registry ---


@pytest.mark.asyncio
async def test_registry_excludes_records_without_child_id(service: LiveDashboardService):
    result = await service.get_registry()
    ids = {c.redcap_child_id for c in result.children}
    assert ids == {"REC001", "REC002", "REC003", "REC004", "REC005", "REC006"}
    assert result.total == 6


@pytest.mark.asyncio
async def test_registry_resolves_choice_labels_and_free_text_village(service: LiveDashboardService):
    result = await service.get_registry()
    rec1 = next(c for c in result.children if c.redcap_child_id == "REC001")
    assert rec1.sex == "Male"  # capitalized from REDCap's lowercase 'male' choice label
    assert rec1.village == "Alpha Village"  # plain free-text field, not a choice code
    assert rec1.child_status == "Live"
    assert rec1.registration_complete is True


@pytest.mark.asyncio
async def test_registry_marks_visit_date_available(service: LiveDashboardService):
    result = await service.get_registry()
    assert result.unavailable_fields == []


@pytest.mark.asyncio
async def test_registry_includes_registered_child_with_incomplete_registration_form(service: LiveDashboardService):
    result = await service.get_registry()
    rec6 = next(c for c in result.children if c.redcap_child_id == "REC006")
    assert rec6.registration_complete is False


# --- Overview: core battery / SSRS progression (the actual correction) ---


@pytest.mark.asyncio
async def test_overview_registered_count_excludes_blank_child_id(service: LiveDashboardService):
    result = await service.get_overview()
    assert result.total_registered == 6


@pytest.mark.asyncio
async def test_overview_core_battery_requires_all_six_instruments(service: LiveDashboardService):
    result = await service.get_overview()
    # REC001, REC002, REC003 have all six core fields complete.
    # REC004 has 5 of 6 (missing dietary_intake) and must NOT count.
    assert result.core_assessment_count == 3


@pytest.mark.asyncio
async def test_overview_ssrs_child_counts_only_within_core_battery_cohort(service: LiveDashboardService):
    result = await service.get_overview()
    # REC001 and REC002 have ssrs_child complete AND are in the core-battery set.
    assert result.ssrs_child_count == 2


@pytest.mark.asyncio
async def test_overview_ssrs_teacher_counts_only_within_ssrs_child_cohort(service: LiveDashboardService):
    result = await service.get_overview()
    # Only REC002 has ssrs_teacher complete, and it's within the ssrs_child cohort.
    assert result.ssrs_teacher_count == 1


@pytest.mark.asyncio
async def test_overview_percentages_computed_dynamically(service: LiveDashboardService):
    result = await service.get_overview()
    assert result.core_assessment_percent == round(3 / 6 * 100, 2)
    assert result.ssrs_child_percent == round(2 / 6 * 100, 2)
    assert result.ssrs_teacher_percent == round(1 / 6 * 100, 2)


@pytest.mark.asyncio
async def test_overview_blank_child_id_excluded_even_with_all_instruments_complete(service: LiveDashboardService):
    # REC007 (blank child_id) has every instrument marked complete in the
    # fixture specifically to prove it must never be counted anywhere.
    result = await service.get_overview()
    assert result.core_assessment_count <= result.total_registered
    assert result.ssrs_teacher_count <= result.ssrs_child_count <= result.core_assessment_count


@pytest.mark.asyncio
async def test_overview_registration_completion_dynamic(service: LiveDashboardService):
    result = await service.get_overview()
    # REC006 has registration_form_complete == "0"; the other 5 registered
    # children have it complete.
    assert result.registration_complete_count == 5
    assert result.registration_complete_percent == round(5 / 6 * 100, 2)


@pytest.mark.asyncio
async def test_overview_instrument_coverage_counts_each_instrument_independently(service: LiveDashboardService):
    result = await service.get_overview()
    coverage = {c.key: c.completed_count for c in result.instrument_coverage}
    # REC001-004 have every core field complete except REC004 is missing
    # dietary_intake specifically — so dietary_intake alone should read 3,
    # not 4, even though the other five instruments all read 4.
    assert coverage == {
        "ses": 4,
        "dseq": 4,
        "child_illness_history": 4,
        "paq_a": 4,
        "dietary_intake": 3,
        "ssrs_parent": 4,
    }


@pytest.mark.asyncio
async def test_overview_instrument_coverage_percentages(service: LiveDashboardService):
    result = await service.get_overview()
    percents = {c.key: c.percent_of_registered for c in result.instrument_coverage}
    assert percents["ses"] == round(4 / 6 * 100, 2)
    assert percents["dietary_intake"] == round(3 / 6 * 100, 2)


@pytest.mark.asyncio
async def test_overview_instrument_coverage_uses_readable_labels(service: LiveDashboardService):
    result = await service.get_overview()
    labels = {c.key: c.label for c in result.instrument_coverage}
    assert labels["ses"] == "SES"
    assert labels["dseq"] == "DSEQ"
    assert labels["child_illness_history"] == "Child Illness History"
    assert labels["paq_a"] == "PAQ-A"
    assert labels["dietary_intake"] == "Dietary Intake"
    assert labels["ssrs_parent"] == "SSRS Parent"


# --- Progress pipeline (stage-by-stage) ---


@pytest.mark.asyncio
async def test_progress_stage_counts_match_overview(service: LiveDashboardService):
    result = await service.get_progress()
    by_key = {s.key: s for s in result.stages}
    assert result.total_registered == 6
    assert by_key["registered"].count == 6
    assert by_key["core_assessment_battery"].count == 3
    assert by_key["ssrs_child"].count == 2
    assert by_key["ssrs_teacher"].count == 1


@pytest.mark.asyncio
async def test_progress_stage_is_monotonically_non_increasing(service: LiveDashboardService):
    result = await service.get_progress()
    counts = [s.count for s in result.stages]
    assert counts == sorted(counts, reverse=True)


@pytest.mark.asyncio
async def test_progress_percent_of_previous_stage(service: LiveDashboardService):
    result = await service.get_progress()
    by_key = {s.key: s for s in result.stages}
    assert by_key["registered"].percent_of_previous_stage is None
    assert by_key["core_assessment_battery"].percent_of_previous_stage == round(3 / 6 * 100, 2)
    assert by_key["ssrs_child"].percent_of_previous_stage == round(2 / 3 * 100, 2)
    assert by_key["ssrs_teacher"].percent_of_previous_stage == round(1 / 2 * 100, 2)


@pytest.mark.asyncio
async def test_progress_core_battery_description_matches_required_wording(service: LiveDashboardService):
    result = await service.get_progress()
    core_stage = next(s for s in result.stages if s.key == "core_assessment_battery")
    assert core_stage.description == (
        "SES, DSEQ, Child Illness History, PAQ-A, Dietary Intake and SSRS Parent completed."
    )


# --- Demographics ---


@pytest.mark.asyncio
async def test_demographics_age_and_sex_distribution(service: LiveDashboardService):
    result = await service.get_demographics()
    assert result.sex_distribution.male == 5
    assert result.sex_distribution.female == 1
    buckets = {b.label: b.count for b in result.age_distribution}
    assert buckets["0-4"] == 1  # REC006
    assert buckets["5-9"] == 3  # REC001, REC003, REC004
    assert buckets["10-14"] == 1  # REC002
    assert buckets["Unknown"] == 1  # REC005, no dob


@pytest.mark.asyncio
async def test_demographics_numeric_summaries_exclude_blanks(service: LiveDashboardService):
    result = await service.get_demographics()
    assert result.per_capita_income_summary is not None
    assert result.per_capita_income_summary.count == 3
    assert result.ses_profile_count == 3


# --- Unavailable-module helpers ---


def test_unavailable_module_helpers_reference_pid196_instruments_not_missing_ones():
    health = LiveDashboardService.get_health_screening_status()
    assert "Child Illness History instrument exists" in health.reason

    pa = LiveDashboardService.get_physical_activity_status()
    assert "PAQ-A instrument exists" in pa.reason

    st = LiveDashboardService.get_screen_time_status()
    assert "DSEQ" in st.reason and "instrument exists" in st.reason

    nd = LiveDashboardService.get_neurodevelopment_status()
    assert "SSRS Teacher instrument exists" in nd.reason
