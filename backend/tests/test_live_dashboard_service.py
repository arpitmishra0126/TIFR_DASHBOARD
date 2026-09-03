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
async def test_overview_ssrs_parent_counted_independently_of_core_battery(service: LiveDashboardService):
    result = await service.get_overview()
    # REC001, REC002, REC003 (in the core-battery set) AND REC004 (which has
    # ssrs_parent_complete == "2" but is NOT in the core-battery set, since
    # its dietary_intake is incomplete) must all count toward SSRS Parent.
    # This proves ssrs_parent_count is derived from ssrs_parent_complete
    # directly, not from the core_assessment_count intersection.
    assert result.ssrs_parent_count == 4
    assert result.core_assessment_count == 3
    assert result.ssrs_parent_count != result.core_assessment_count


@pytest.mark.asyncio
async def test_overview_ssrs_parent_percentage_computed_dynamically(service: LiveDashboardService):
    result = await service.get_overview()
    assert result.ssrs_parent_percent == round(4 / 6 * 100, 2)


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


# --- Overview: all-nine-instrument coverage panel (Assessment Instrument Coverage) ---


@pytest.mark.asyncio
async def test_overview_all_instrument_coverage_includes_all_nine_instruments(service: LiveDashboardService):
    result = await service.get_overview()
    keys = {c.key for c in result.all_instrument_coverage}
    assert keys == {
        "registration",
        "ses",
        "dseq",
        "child_illness_history",
        "paq_a",
        "dietary_intake",
        "ssrs_parent",
        "ssrs_child",
        "ssrs_teacher",
    }
    assert len(result.all_instrument_coverage) == 9


@pytest.mark.asyncio
async def test_overview_all_instrument_coverage_counts_are_independent(service: LiveDashboardService):
    result = await service.get_overview()
    counts = {c.key: c.completed_count for c in result.all_instrument_coverage}
    # Registration: 5 of 6 (REC006 has registration_form_complete == "0").
    # ses/dseq/child_illness_history/paq_a/ssrs_parent: 4 each (REC001-004).
    # dietary_intake: 3 (REC004 is deliberately missing this one field alone).
    # ssrs_child: 2 (REC001, REC002 only — NOT gated by core-battery completion here).
    # ssrs_teacher: 1 (REC002 only).
    assert counts == {
        "registration": 5,
        "ses": 4,
        "dseq": 4,
        "child_illness_history": 4,
        "paq_a": 4,
        "dietary_intake": 3,
        "ssrs_parent": 4,
        "ssrs_child": 2,
        "ssrs_teacher": 1,
    }
    # SSRS Child/Teacher here are raw independent completion counts, distinct
    # from the cumulative (gated) ssrs_child_count/ssrs_teacher_count used by
    # the progression funnel — both of which happen to equal these same raw
    # values in this fixture, since every SSRS Child/Teacher completion here
    # already sits within the core-battery cohort.
    assert result.ssrs_child_count == counts["ssrs_child"]
    assert result.ssrs_teacher_count == counts["ssrs_teacher"]
    # An individual instrument's count must never be silently overwritten by
    # (or forced to equal) the Completed Assessment Set aggregate.
    assert counts["ses"] != result.core_assessment_count


@pytest.mark.asyncio
async def test_overview_all_instrument_coverage_percentages_use_total_registered(service: LiveDashboardService):
    result = await service.get_overview()
    percents = {c.key: c.percent_of_registered for c in result.all_instrument_coverage}
    assert percents["registration"] == round(5 / 6 * 100, 2)
    assert percents["dietary_intake"] == round(3 / 6 * 100, 2)
    assert percents["ssrs_teacher"] == round(1 / 6 * 100, 2)


@pytest.mark.asyncio
async def test_overview_all_instrument_coverage_includes_coverage_tier(service: LiveDashboardService):
    result = await service.get_overview()
    tiers = {c.key: c.coverage_tier for c in result.all_instrument_coverage}
    # High: ratio >= 50% (registration 5/6, ses/dseq/child_illness_history/
    # paq_a/ssrs_parent 4/6, dietary_intake exactly 3/6). Partial: ratio > 0%
    # but < 50% (ssrs_child 2/6, ssrs_teacher 1/6). Same thresholds as the
    # Excel export's DATA COVERAGE section (module_analytics.coverage_tier).
    assert tiers == {
        "registration": "High",
        "ses": "High",
        "dseq": "High",
        "child_illness_history": "High",
        "paq_a": "High",
        "dietary_intake": "High",
        "ssrs_parent": "High",
        "ssrs_child": "Partial",
        "ssrs_teacher": "Partial",
    }


@pytest.mark.asyncio
async def test_overview_instrument_coverage_includes_coverage_tier(service: LiveDashboardService):
    # The original 6-instrument instrument_coverage list (used by the
    # Assessment Progress "Completed Assessment Set instruments" panel) also
    # gained coverage_tier — same helper, same thresholds.
    result = await service.get_overview()
    tiers = {c.key: c.coverage_tier for c in result.instrument_coverage}
    assert tiers["ses"] == "High"
    assert tiers["dietary_intake"] == "High"


@pytest.mark.asyncio
async def test_overview_all_instrument_coverage_zero_completion_handled(service: LiveDashboardService):
    # Every child in the fixture has visit_date == "" for a field not used
    # here; to exercise the zero-completion path directly (mirroring live
    # SSRS Teacher = 0/212 today) we assert the percent formula itself
    # produces a clean 0.0%, not a division error, when count is 0.
    from app.services.live_dashboard_service import _percent

    assert _percent(0, 6) == 0.0
    assert _percent(0, 0) == 0.0


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
    # Study-specific age groups: REC004 is exactly 8, REC003 is exactly 9;
    # REC001 (6), REC002 (11), REC006 (4) fall outside 8-10 -> "Other".
    assert buckets["8 years"] == 1  # REC004
    assert buckets["9 years"] == 1  # REC003
    assert buckets["10 years"] == 0
    assert buckets["Other (outside 8-10 years)"] == 3  # REC001, REC002, REC006
    assert buckets["Unknown"] == 1  # REC005, no dob


@pytest.mark.asyncio
async def test_demographics_numeric_summaries_exclude_blanks(service: LiveDashboardService):
    result = await service.get_demographics()
    assert result.per_capita_income_summary is not None
    assert result.per_capita_income_summary.count == 3
    assert result.ses_profile_count == 3


# --- Assessment module analytics (approved 2026-08-26) ---


@pytest.mark.asyncio
async def test_health_screening_reports_real_completion_and_conditions(service: LiveDashboardService):
    result = await service.get_health_screening()
    assert result.instrument == "Child Illness History"
    assert result.completion.total_registered == 6
    assert result.completion.completed == 4
    assert result.completion.coverage_tier == "High"
    conditions = {c.label: c for c in result.named_conditions}
    assert conditions["Asthma"].yes_count == 1


@pytest.mark.asyncio
async def test_physical_activity_reports_real_score_summaries(service: LiveDashboardService):
    result = await service.get_physical_activity()
    assert result.instrument == "PAQ-A"
    assert result.total_summary.valid_n == 1
    assert result.total_summary.missing_n == 5
    assert result.total_summary.mean == 3.2
    # Missing is never treated as zero — item1 has 1 valid + 5 missing, not a mean of 0.
    assert result.item1_summary.valid_n == 1
    assert result.item1_summary.missing_n == 5
    assert result.item1_summary.mean == 2.5


@pytest.mark.asyncio
async def test_screen_time_reports_real_distribution_and_yes_no_items(service: LiveDashboardService):
    result = await service.get_screen_time()
    assert result.instrument == "DSEQ"
    dist_list = [(c.code, c.count) for c in result.total_screen_time_distribution]
    assert dist_list == [("Less than 30 minutes", 0), ("30 minutes-1 hour", 1)]
    yes_no = {c.code: c.count for c in result.yes_no_items}
    assert yes_no["Household has screen-use rules (Q9)"] == 1
    assert yes_no["Uses screens for school/homework (Q14)"] == 0


@pytest.mark.asyncio
async def test_neurodevelopment_reports_ssrs_summaries_with_teacher_unmapped_data(service: LiveDashboardService):
    result = await service.get_neurodevelopment()
    assert result.parent.children_with_any_data == 1
    assert result.parent.avg_frequency_summary.mean == 0.5
    assert result.child.children_with_any_data == 1
    assert result.teacher.children_with_any_data == 0
    assert result.teacher.avg_frequency_summary.valid_n == 0
    assert result.teacher.avg_frequency_summary.mean is None
