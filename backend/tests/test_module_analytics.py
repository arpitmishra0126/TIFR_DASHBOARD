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
    named = {c["label"]: c for c in result["named_conditions"]}
    assert named["Asthma"]["yes_count"] == 1
    assert named["Asthma"]["percent_yes"] == ma.percent(1, named["Asthma"]["valid_n"])
    general = {c["label"]: c for c in result["general_flags"]}
    assert general["Currently ill"]["yes_count"] == 0


def test_ordered_category_counts_preserves_choice_code_order_and_zero_categories():
    choice_maps = {"q10": {"1": "Less than 30 minutes", "2": "30 minutes-1 hour", "3": "1-2 hours"}}
    records = [{"q10": "2"}, {"q10": "2"}, {"q10": "1"}]
    result = ma.ordered_category_counts(records, "q10", choice_maps)
    assert result == [("Less than 30 minutes", 1), ("30 minutes-1 hour", 2), ("1-2 hours", 0)]


def test_response_breakdown_separates_dont_know_from_no():
    choice_maps = {"f": {"0": "No", "1": "Yes", "9": "Don't know"}}
    records = [{"f": "1"}, {"f": "0"}, {"f": "9"}, {"f": ""}]
    result = ma.response_breakdown(records, "f", choice_maps)
    assert result == {"yes": 1, "no": 1, "dont_know": 1, "valid_n": 3}


def test_build_condition_indicator_uses_valid_respondents_as_percent_denominator():
    choice_maps = {"f": {"0": "No", "1": "Yes", "9": "Don't know"}}
    records = [{"f": "1"}, {"f": "1"}, {"f": "9"}, {"f": ""}]
    indicator = ma.build_condition_indicator(records, "f", "Test Item", choice_maps, asked_n=4)
    assert indicator["yes_count"] == 2
    assert indicator["dont_know_count"] == 1
    assert indicator["valid_n"] == 3  # 2 yes + 1 dont_know, blank excluded
    assert indicator["missing_count"] == 1  # asked_n(4) - valid_n(3)
    assert indicator["percent_yes"] == ma.percent(2, 3)  # NOT percent(2, 4)


def test_build_dietary_analysis_reports_per_food_group_distribution():
    choice_maps = {"die_grains_freq": {"1": "Daily", "2": "Rarely/Never"}}
    records = [
        {"child_id": "A", "dietary_intake_complete": "2", "die_grains_freq": "1"},
        {"child_id": "B", "dietary_intake_complete": "0", "die_grains_freq": ""},
    ]
    result = ma.build_dietary_analysis(records, choice_maps)
    assert result["completion"]["completed"] == 1
    grains = next(i for i in result["items"] if i["field_label"] == "Grains / Roots / Tubers")
    assert dict(grains["distribution"])["Daily"] == 1
    assert grains["valid_n"] == 1
    assert grains["missing_n"] == 1


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


def test_band_minutes_returns_none_for_missing_or_unrecognised_code():
    assert ma._band_minutes({"q2_tv_school": ""}, "q2_tv_school", ma._SCREEN_BAND_MINUTES) is None
    assert ma._band_minutes({}, "q2_tv_school", ma._SCREEN_BAND_MINUTES) is None
    assert ma._band_minutes({"q2_tv_school": "9"}, "q2_tv_school", ma._SCREEN_BAND_MINUTES) is None


def test_band_minutes_converts_known_codes_to_midpoint_minutes():
    assert ma._band_minutes({"q2_tv_school": "0"}, "q2_tv_school", ma._SCREEN_BAND_MINUTES) == 0
    assert ma._band_minutes({"q2_tv_school": "2"}, "q2_tv_school", ma._SCREEN_BAND_MINUTES) == 45


def test_weighted_daily_minutes_requires_both_sides_present():
    assert ma._weighted_daily_minutes(60, None) is None
    assert ma._weighted_daily_minutes(None, 90) is None
    assert ma._weighted_daily_minutes(70, 0) == round((70 * 5 + 0 * 2) / 7, 1)


def _dseq_choice_maps() -> dict:
    return {
        "baby_gender": {"1": "Male", "2": "Female"},
        "q8_supervision": {"3": "Always", "2": "Often", "1": "Sometimes", "0": "Never"},
        "q9_household_rules": {"1": "Yes", "0": "No"},
        "q13_main_use": {"1": "Homework/online learning", "5": "Watching stories/cartoons/videos"},
        "q10_total_screen_time": {"3": "1-2 hours"},
    }


def test_screen_time_analysis_minutes_derivation_and_denominators():
    from datetime import date

    from dateutil.relativedelta import relativedelta

    today = date.today()
    dob_9 = (today - relativedelta(years=9)).isoformat()
    dob_10 = (today - relativedelta(years=10)).isoformat()

    choice_maps = _dseq_choice_maps()
    # Child A: fully answered on every relevant field.
    child_a = {
        "child_id": "A", "dseq_complete": "2", "baby_gender": "1", "child_dob": dob_9,
        "q2_tv_school": "2", "q3_tv_holiday": "3", "q5_phone_school": "1", "q6_phone_holiday": "2",
        "q8_supervision": "3", "q9_household_rules": "1", "q10_total_screen_time": "3",
        "q11_outdoor_school": "2", "q12_outdoor_holiday": "1", "q13_main_use": "1",
    }
    # Child B: TV answered both sides, but phone only answered for holiday
    # (school-day phone missing) - school_total must be None (not phone=0),
    # and physical-activity fields are entirely unanswered.
    child_b = {
        "child_id": "B", "dseq_complete": "2", "baby_gender": "2", "child_dob": dob_10,
        "q2_tv_school": "1", "q3_tv_holiday": "1", "q6_phone_holiday": "1",
        "q9_household_rules": "0",
    }
    records = [child_a, child_b]

    result = ma.build_screen_time_analysis(records, choice_maps)

    # --- Missing DSEQ data (both complete here, so 0 missing) ---
    assert result["completion"]["completed"] == 2
    assert result["missing_count"] == 0

    # --- Primary continuous variable: school-day / weekend / weighted avg ---
    expected_school_a = 45 + 15  # tv_school(2)=45, phone_school(1)=15
    expected_weekend_a = 90 + 45  # tv_holiday(3)=90, phone_holiday(2)=45
    expected_weighted_a = ma._weighted_daily_minutes(expected_school_a, expected_weekend_a)
    assert result["school_day_summary"]["valid_n"] == 1  # only A has both TV+phone school-day values
    assert result["school_day_summary"]["mean"] == expected_school_a
    assert result["weekend_summary"]["valid_n"] == 2  # both A and B have TV+phone weekend values
    assert result["average_daily_summary"]["valid_n"] == 1
    assert result["average_daily_summary"]["mean"] == expected_weighted_a
    assert result["average_daily_summary"]["median"] == expected_weighted_a

    # --- Weekend minus school-day difference ---
    assert result["difference_summary"]["valid_n"] == 1
    assert result["difference_summary"]["mean"] == round(expected_weekend_a - expected_school_a, 1)

    # --- School-Day vs Weekend paired points ---
    paired = {p["group"]: p for p in result["school_vs_weekend"]}
    assert paired["School-Day"]["valid_n"] == 1
    assert paired["Weekend"]["valid_n"] == 2

    # --- By age / by sex (both use the primary weighted value, valid for A only) ---
    by_age = {p["group"]: p for p in result["by_age"]}
    assert by_age["9 years"]["valid_n"] == 1
    assert by_age["9 years"]["mean"] == expected_weighted_a
    assert by_age["10 years"]["valid_n"] == 0  # B has no weighted value (school missing)
    by_sex = {p["group"]: p for p in result["by_sex"]}
    assert by_sex["Male"]["valid_n"] == 1
    assert by_sex["Female"]["valid_n"] == 0

    # --- By device: laptop has no genuine duration field, so it is never
    # fabricated - mean_minutes stays None and valid_n stays 0. ---
    by_device = {d["device"]: d for d in result["by_device"]}
    assert by_device["Television"]["valid_n"] == 2  # both A and B answered TV school+holiday
    assert by_device["Smartphone/Tablet"]["valid_n"] == 1  # only A answered phone on both sides
    assert by_device["Laptop/Computer"]["mean_minutes"] is None
    assert by_device["Laptop/Computer"]["valid_n"] == 0

    # --- Physical activity (DSEQ Section B) - only A answered both sides ---
    assert result["physical_activity_school_day_summary"]["valid_n"] == 1
    assert result["physical_activity_weekend_summary"]["valid_n"] == 1
    pa_paired = {p["group"]: p for p in result["physical_activity_school_vs_weekend"]}
    assert pa_paired["School-Day"]["mean"] == 45
    assert pa_paired["Weekend"]["mean"] == 15

    # --- Screen time vs physical activity scatter: only children with BOTH
    # a valid weighted screen value and a valid weighted activity value. ---
    assert len(result["screen_vs_activity_scatter"]) == 1
    assert result["screen_vs_activity_scatter"][0]["screen_minutes"] == expected_weighted_a

    # --- Household rules / supervision / purpose (existing categorical fields) ---
    household = dict(result["household_rules_distribution"])
    assert household["Yes"] == 1
    assert household["No"] == 1
    assert result["household_rules_valid_n"] == 2

    # --- Secondary/descriptive Q10 distribution is unaffected by the new
    # minutes fields (still present, still categorical). ---
    assert dict(result["total_screen_time_distribution"])["1-2 hours"] == 1


def test_difference_distribution_has_six_contiguous_bins_in_order():
    """Regression test for a reported gap in the Weekend - School-Day
    Difference histogram: every value, including one that lands specifically
    in the -60-to-30 band, must be counted in exactly one of six contiguous,
    correctly-ordered bins - none silently dropped or merged."""
    assert ma._DIFF_MINUTES_BUCKET_LABELS == [
        "< -60 min", "-60 to -30 min", "-30 to 0 min", "0 to 30 min", "30 to 60 min", "60+ min",
    ]
    diff_values = [-75.0, -45.0, -15.0, 15.0, 45.0, 75.0]  # one value per intended bin
    result = dict(ma.bucket_counts(diff_values, ma._DIFF_MINUTES_BUCKET_EDGES, ma._DIFF_MINUTES_BUCKET_LABELS))
    assert result == {
        "< -60 min": 1,
        "-60 to -30 min": 1,
        "-30 to 0 min": 1,
        "0 to 30 min": 1,
        "30 to 60 min": 1,
        "60+ min": 1,
    }
    assert sum(result.values()) == len(diff_values)


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
