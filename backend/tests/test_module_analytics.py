"""Unit tests for the shared analytical engine used by both the four
dashboard assessment modules and the Active Cases Excel export. Uses small,
hand-built record sets (rather than the shared live-shaped fixture) so each
calculation can be reasoned about precisely.
"""
from app.services import module_analytics as ma

CHOICE_MAPS = {
    "status": {"0": "No", "1": "Yes"},
    "freq": {"1": "Daily", "2": "Weekly"},
}


def test_resolve_value_returns_blank_for_missing_or_empty():
    assert ma.resolve_value("status", None, CHOICE_MAPS) == ""
    assert ma.resolve_value("status", "  ", CHOICE_MAPS) == ""


def test_resolve_value_resolves_choice_label():
    assert ma.resolve_value("status", "1", CHOICE_MAPS) == "Yes"


def test_resolve_value_falls_back_to_raw_code_when_label_missing():
    assert ma.resolve_value("status", "9", CHOICE_MAPS) == "9"


def test_resolve_value_passes_through_uncoded_field_unchanged():
    assert ma.resolve_value("free_text_field", " hello ", CHOICE_MAPS) == "hello"


def test_registered_records_excludes_blank_and_duplicate_child_ids():
    records = [
        {"child_id": "A"},
        {"child_id": ""},
        {"child_id": "A"},  # duplicate, must not double-count
        {"child_id": "B"},
    ]
    result = ma.registered_records(records)
    assert [r["child_id"] for r in result] == ["A", "B"]


def test_category_counts_ignores_blank_values():
    records = [{"freq": "1"}, {"freq": "1"}, {"freq": "2"}, {"freq": ""}, {"freq": None}]
    counts = ma.category_counts(records, "freq", CHOICE_MAPS)
    assert dict(counts) == {"Daily": 2, "Weekly": 1}


def test_numeric_values_excludes_unparseable_and_blank():
    from app.ingestion.normalize import parse_float

    records = [{"f": "1.5"}, {"f": ""}, {"f": None}, {"f": "not-a-number"}, {"f": "2.5"}]
    assert ma.numeric_values(records, "f", parse_float) == [1.5, 2.5]


def test_bucket_counts_places_values_in_correct_bucket():
    result = ma.bucket_counts([0.5, 2.5, 3.9, 5.0], edges=[2, 3, 4], labels=["low", "mid", "high", "top"])
    assert dict(result) == {"low": 1, "mid": 1, "high": 1, "top": 1}


def test_yes_count_only_counts_resolved_yes():
    records = [{"status": "1"}, {"status": "0"}, {"status": ""}]
    assert ma.yes_count(records, "status", CHOICE_MAPS) == 1


def test_complete_count_uses_redcap_completion_codes():
    records = [{"f": "2"}, {"f": "1"}, {"f": "0"}, {"f": ""}]
    assert ma.complete_count(records, "f") == 1


def test_percent_handles_zero_denominator():
    assert ma.percent(0, 0) == 0.0
    assert ma.percent(1, 4) == 25.0


def test_coverage_tier_thresholds():
    assert ma.coverage_tier(0, 10) == "No Data"
    assert ma.coverage_tier(4, 10) == "Partial"
    assert ma.coverage_tier(5, 10) == "High"
    assert ma.coverage_tier(0, 0) == "No Data"


def test_numeric_summary_never_treats_missing_as_zero():
    summary = ma.numeric_summary([], total=5)
    assert summary["valid_n"] == 0
    assert summary["missing_n"] == 5
    assert summary["mean"] is None
    assert summary["minimum"] is None
    assert summary["maximum"] is None


def test_numeric_summary_with_data():
    summary = ma.numeric_summary([1.0, 2.0, 3.0], total=5)
    assert summary["valid_n"] == 3
    assert summary["missing_n"] == 2
    assert summary["percent_valid"] == 60.0
    assert summary["mean"] == 2.0
    assert summary["minimum"] == 1.0
    assert summary["maximum"] == 3.0


def test_ssrs_items_answered_counts_any_nonblank_freq_field():
    records = [{"f1": "1", "f2": ""}, {"f1": "", "f2": ""}, {"f1": "", "f2": "2"}]
    assert ma.ssrs_items_answered(records, ("f1", "f2")) == 2


def test_ssrs_per_child_averages_computed_per_child_not_pooled():
    records = [
        {"f1": "0", "f2": "2", "i1": "1"},  # freq mean=1.0, imp mean=1.0
        {"f1": "", "f2": "", "i1": ""},  # no data at all -> excluded from both lists
        {"f1": "4", "f2": "", "i1": ""},  # freq mean=4.0 (only f1), no imp data
    ]
    freq_avgs, imp_avgs = ma.ssrs_per_child_averages(records, ("f1", "f2"), ("i1",))
    assert freq_avgs == [1.0, 4.0]
    assert imp_avgs == [1.0]


# --- Module-level builders ---


def _chh_records():
    return [
        {"child_id": "A", "child_illness_history_complete": "2", "chh_q8_asthma": "1", "chh_illness_current": "0"},
        {"child_id": "B", "child_illness_history_complete": "0", "chh_q8_asthma": "", "chh_illness_current": ""},
        {"child_id": ""},  # excluded
    ]


def test_health_screening_analysis_counts_and_completion():
    result = ma.build_health_screening_analysis(_chh_records(), {"chh_q8_asthma": {"1": "Yes", "0": "No"}, "chh_illness_current": {"1": "Yes", "0": "No"}})
    assert result["completion"]["total_registered"] == 2
    assert result["completion"]["completed"] == 1
    assert result["completion"]["coverage_tier"] == "High"
    named = dict(result["named_conditions"])
    assert named["Asthma"] == 1
    general = dict(result["general_flags"])
    assert general["Currently ill"] == 0


def test_physical_activity_analysis_missing_stays_missing():
    records = [
        {"child_id": "A", "paq_a_complete": "2", "paq_item1_score": "2.0", "paq_item8_score": "3.0", "paq_total_score": "2.5"},
        {"child_id": "B", "paq_a_complete": "0"},
    ]
    result = ma.build_physical_activity_analysis(records, {})
    assert result["completion"]["completed"] == 1
    assert result["completion"]["total_registered"] == 2
    assert result["item1_summary"]["valid_n"] == 1
    assert result["item1_summary"]["missing_n"] == 1
    assert result["total_summary"]["mean"] == 2.5
    assert dict(result["total_score_distribution"])["2.0-2.99"] == 1


def test_screen_time_analysis_distribution_and_yes_no():
    choice_maps = {
        "q10_total_screen_time": {"1": "Less than 30 minutes"},
        "q9_household_rules": {"1": "Yes", "0": "No"},
        "q14_school_use": {"1": "Yes", "0": "No"},
        "q15_entertainment_use": {"1": "Yes", "0": "No"},
    }
    records = [
        {"child_id": "A", "dseq_complete": "2", "q10_total_screen_time": "1", "q9_household_rules": "1", "q14_school_use": "0", "q15_entertainment_use": "1"},
        {"child_id": "B", "dseq_complete": "0"},
    ]
    result = ma.build_screen_time_analysis(records, choice_maps)
    assert result["completion"]["completed"] == 1
    assert dict(result["total_screen_time_distribution"]) == {"Less than 30 minutes": 1}
    yes_no = dict(result["yes_no_items"])
    assert yes_no["Household has screen-use rules (Q9)"] == 1
    assert yes_no["Uses screens for school/homework (Q14)"] == 0
    assert yes_no["Uses screens mainly for entertainment (Q15)"] == 1


def test_neurodevelopment_analysis_teacher_shows_zero_not_invented():
    records = [
        {"child_id": "A", "ssrs_parent_complete": "2", "p1_freq": "1", "p1_imp": "2"},
        {"child_id": "B", "ssrs_parent_complete": "0"},
    ]
    result = ma.build_neurodevelopment_analysis(
        records, {},
        parent_freq_fields=("p1_freq",), parent_imp_fields=("p1_imp",),
        child_freq_fields=("c1_freq",), child_imp_fields=("c1_imp",),
        teacher_freq_fields=("t1_freq",), teacher_imp_fields=("t1_imp",),
    )
    assert result["parent"]["children_with_any_data"] == 1
    assert result["parent"]["avg_frequency_summary"]["mean"] == 1.0
    assert result["teacher"]["children_with_any_data"] == 0
    assert result["teacher"]["avg_frequency_summary"]["valid_n"] == 0
    assert result["teacher"]["avg_frequency_summary"]["mean"] is None
