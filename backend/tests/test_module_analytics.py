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


def test_build_other_food_specified_records_real_entries_and_respects_skip_logic():
    choice_maps = {"die_other_freq": {"1": "Daily", "8": "Rarely/Never"}}
    records = [
        # Specified a food; frequency answered and not "rarely/never", so a
        # portion was genuinely asked for and answered.
        {
            "child_id": "A", "dietary_intake_complete": "2",
            "die_other_specify": "Jaggery", "die_other_freq": "1", "die_other_portion": "1 spoon",
        },
        # Specified a food, but frequency is "rarely/never" - REDCap's own
        # skip logic means portion was never asked. Must be "not_applicable",
        # never counted as missing/non-response.
        {
            "child_id": "B", "dietary_intake_complete": "2",
            "die_other_specify": "Papaya", "die_other_freq": "8", "die_other_portion": "",
        },
        # Specified a food, frequency genuinely left blank (not the skip
        # case) - a real non-response, distinct from the skip case above.
        {
            "child_id": "C", "dietary_intake_complete": "0",
            "die_other_specify": "Mango", "die_other_freq": "", "die_other_portion": "",
        },
        # Did not specify anything at all - excluded entirely, not a
        # zero/blank row.
        {"child_id": "D", "dietary_intake_complete": "2"},
    ]
    result = ma.build_dietary_analysis(records, choice_maps)
    other = result["other_food_specified"]

    assert other["total"] == 4
    assert other["valid_n"] == 3
    assert other["percent_valid"] == ma.percent(3, 4)
    assert len(other["entries"]) == 3

    by_name = {e["food_name"]: e for e in other["entries"]}
    assert by_name["Jaggery"]["portion"] == "1 spoon"
    assert by_name["Jaggery"]["portion_status"] == "recorded"
    assert by_name["Jaggery"]["frequency"] == "Daily"
    assert by_name["Jaggery"]["frequency_status"] == "recorded"

    assert by_name["Papaya"]["portion"] is None
    assert by_name["Papaya"]["portion_status"] == "not_applicable"
    assert by_name["Papaya"]["frequency"] == "Rarely/Never"

    assert by_name["Mango"]["portion_status"] == "not_answered"
    assert by_name["Mango"]["frequency"] is None
    assert by_name["Mango"]["frequency_status"] == "not_answered"

    assert "D" not in by_name


def test_physical_activity_analysis_missing_stays_missing():
    records = [
        {"child_id": "A", "paq_c_complete": "2", "paq_item1_score": "2.0", "paq_item8_score": "3.0", "paq_total_score": "2.5"},
        {"child_id": "B", "paq_c_complete": "0"},
    ]
    result = ma.build_physical_activity_analysis(records, {})
    assert result["completion"]["completed"] == 1
    assert result["completion"]["total_registered"] == 2
    assert result["item1_summary"]["valid_n"] == 1
    assert result["item1_summary"]["missing_n"] == 1
    assert result["total_summary"]["mean"] == 2.5
    assert dict(result["total_score_distribution"])["2.0-2.99"] == 1


def test_physical_activity_key_scores_match_approved_paqc_specification():
    """Approved PAQ-C "Key Scores" specification, traced against the live
    REDCap `paq_c` form metadata (2026-09-10):

    - Final PAQ-C Score = `paq_total_score` - REDCap's own calc field,
      `(item1 + q2..q7 + item8)/8`, which already excludes the illness/
      exclusion item (REDCap's own field label: "excludes item 9"). No
      other field on the instrument represents a "final"/overall score.
    - Item 9 Score / Daily Activity Score = `paq_item8_score` - REDCap's
      own calc field, the mean of the 7 Monday-Sunday ratings
      (`paq_q8_mon`..`paq_q8_sun`), each answered on the approved
      None=1/Little=2/Medium=3/Often=4/Very often=5 scale. There is no
      second, independently-collected field for a distinct "Daily
      Activity Score" anywhere on the instrument, so both dashboard cards
      intentionally read this same summary - this test locks that mapping
      in so a future refactor can't silently point either card at the
      wrong field.

    This is a regression/documentation test for the field wiring, not a
    reimplementation of REDCap's own calc engine - `paq_item1_score`/
    `paq_item8_score`/`paq_total_score` are computed by REDCap itself and
    passed through unchanged.
    """
    records = [
        # Child A: fully answered - realistic values consistent with the
        # 1-5 possible range of every underlying PAQ-C item.
        {
            "child_id": "A", "paq_c_complete": "2",
            "paq_item1_score": "2.11",  # mean of the 27 spare-time activity items
            "paq_item8_score": "3.43",  # mean of paq_q8_mon..sun (Item 9 / Daily Activity Score)
            "paq_total_score": "2.75",  # mean of item1 + q2..q7 + item8 (Final PAQ-C Score)
        },
        # Child B: instrument not completed, no calculated scores at all -
        # must be excluded from valid_n, never treated as a 0.
        {"child_id": "B", "paq_c_complete": "0"},
    ]
    result = ma.build_physical_activity_analysis(records, {})

    # Final PAQ-C Score
    assert result["total_summary"]["mean"] == 2.75
    assert result["total_summary"]["valid_n"] == 1
    assert result["total_summary"]["total"] == 2
    assert result["total_summary"]["percent_valid"] == ma.percent(1, 2)

    # Item 9 Score / Daily Activity Score - same underlying field
    assert result["item8_summary"]["mean"] == 3.43
    assert result["item8_summary"]["valid_n"] == 1
    assert result["item8_summary"]["total"] == 2
    assert result["item8_summary"]["percent_valid"] == ma.percent(1, 2)

    # Every score's theoretical range is 1-5 (not enforced by this
    # function - REDCap's own calc formula guarantees it structurally,
    # since every contributing item is itself scored 1-5 - but confirmed
    # here as documentation that no value in this fixture falls outside it).
    for summary_key in ("item1_summary", "item8_summary", "total_summary"):
        mean = result[summary_key]["mean"]
        assert mean is None or 1 <= mean <= 5


def test_physical_activity_item_scores_cover_items_1_through_8_with_correct_means():
    """Items 1-8 (approved numbering) - retained scores 1-5, read directly
    from their own REDCap fields (no re-derivation - REDCap already stores
    each as a plain 1-5 radio/calc value)."""
    records = [
        {
            "child_id": "A", "paq_c_complete": "2",
            "paq_item1_score": "2.11", "paq_q2_pe": "3", "paq_q3_lunch": "4",
            "paq_q4_afterschool": "2", "paq_q5_evening": "5", "paq_q6_weekend": "1",
            "paq_q7_describe": "3", "paq_item8_score": "3.43",
        },
        {"child_id": "B", "paq_c_complete": "0"},
    ]
    result = ma.build_physical_activity_analysis(records, {})
    by_key = {item["key"]: item for item in result["item_scores"]}
    assert [item["key"] for item in result["item_scores"]] == [
        "item1", "item2", "item3", "item4", "item5", "item6", "item7", "item8",
    ]
    assert by_key["item1"]["mean"] == 2.11
    assert by_key["item2"]["mean"] == 3
    assert by_key["item3"]["mean"] == 4
    assert by_key["item4"]["mean"] == 2
    assert by_key["item5"]["mean"] == 5
    assert by_key["item6"]["mean"] == 1
    assert by_key["item7"]["mean"] == 3
    assert by_key["item8"]["mean"] == 3.43
    for item in result["item_scores"]:
        assert item["valid_n"] == 1
        assert item["missing_n"] == 1
        assert item["total"] == 2


def test_physical_activity_weekly_activity_covers_all_seven_days():
    """Item 9 (approved numbering) - mean of Monday-Sunday scores, each
    day's own raw value shown independently on the same None=1..Very
    often=5 scale."""
    records = [
        {
            "child_id": "A", "paq_c_complete": "2",
            "paq_q8_mon": "1", "paq_q8_tue": "2", "paq_q8_wed": "3",
            "paq_q8_thu": "4", "paq_q8_fri": "5", "paq_q8_sat": "3", "paq_q8_sun": "2",
        },
        {"child_id": "B", "paq_c_complete": "0"},
    ]
    result = ma.build_physical_activity_analysis(records, {})
    by_day = {day["day"]: day for day in result["weekly_activity"]}
    assert [day["day"] for day in result["weekly_activity"]] == [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    ]
    assert by_day["Monday"]["mean"] == 1
    assert by_day["Tuesday"]["mean"] == 2
    assert by_day["Wednesday"]["mean"] == 3
    assert by_day["Thursday"]["mean"] == 4
    assert by_day["Friday"]["mean"] == 5
    assert by_day["Saturday"]["mean"] == 3
    assert by_day["Sunday"]["mean"] == 2
    for day in result["weekly_activity"]:
        assert day["valid_n"] == 1
        assert day["missing_n"] == 1
        assert day["total"] == 2


def test_physical_activity_item10_exclusion_is_separately_denominated_and_excluded_from_score():
    """Item 10 (approved numbering) - the illness/exclusion item
    (paq_q9_sick) - must be reported as its own Yes/No breakdown, denominated
    against instrument completion (asked_n), and must never feed into
    total_summary (Final PAQ-C Score)."""
    choice_maps = {"paq_q9_sick": {"1": "Yes", "0": "No"}}
    records = [
        {"child_id": "A", "paq_c_complete": "2", "paq_q9_sick": "1", "paq_total_score": "2.75"},
        {"child_id": "B", "paq_c_complete": "2", "paq_q9_sick": "0", "paq_total_score": "3.0"},
        {"child_id": "C", "paq_c_complete": "2"},  # completed instrument, skipped this item
        {"child_id": "D", "paq_c_complete": "0"},  # instrument not completed at all
    ]
    result = ma.build_physical_activity_analysis(records, choice_maps)
    item10 = result["item10_exclusion"]
    assert item10["yes_count"] == 1
    assert item10["no_count"] == 1
    assert item10["valid_n"] == 2
    assert item10["asked_n"] == 3  # completed == 3, independent of this item's own valid_n
    assert item10["missing_count"] == 1
    # Final PAQ-C Score is unaffected by item10 - still just paq_total_score.
    assert result["total_summary"]["mean"] == round((2.75 + 3.0) / 2, 2)
    assert result["total_summary"]["valid_n"] == 2


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


def test_dseq_coding_scores_pooled_and_single_field_domains():
    """Approved 2026-09-10 DSEQ coding specification. REDCap's own numeric
    codes on q1/q4/q7 (Frequency), q2/q3/q5/q6 (Duration), q8 (Supervision)
    and q9 (Household Rules) are already identical to the approved coding
    scale, so this test locks in the field mapping/aggregation method (pool
    every valid response across a domain's fields into one list; a
    single-field domain is just that field's own numeric_summary), not a
    re-derivation of the scale itself."""
    records = [
        {
            "child_id": "A", "dseq_complete": "2",
            "q1_tv_freq": "3", "q4_phone_freq": "2", "q7_laptop_freq": "1",
            "q2_tv_school": "2", "q3_tv_holiday": "3", "q5_phone_school": "1", "q6_phone_holiday": "2",
            "q8_supervision": "3", "q9_household_rules": "1",
        },
        {
            "child_id": "B", "dseq_complete": "2",
            "q1_tv_freq": "0",  # q4/q7 unanswered
            "q2_tv_school": "1", "q3_tv_holiday": "1", "q6_phone_holiday": "1",  # q5 unanswered
            "q9_household_rules": "0",  # q8 unanswered
        },
    ]
    result = ma.build_screen_time_analysis(records, {})
    scores = result["coding_scores"]

    # Frequency: pooled q1+q4+q7 - A contributes 3 values (3,2,1), B only 1
    # (0) since q4/q7 are blank for B - never treated as a 0.
    freq = scores["frequency"]
    assert freq["valid_n"] == 4
    assert freq["total"] == 2 * 3  # total_registered(2) * 3 pooled fields
    assert freq["missing_n"] == 2
    assert freq["mean"] == round((3 + 2 + 1 + 0) / 4, 2)

    # Duration: pooled q2+q3+q5+q6 - A contributes 4 values, B contributes 3
    # (q5 blank for B).
    duration = scores["duration"]
    assert duration["valid_n"] == 7
    assert duration["total"] == 2 * 4
    assert duration["missing_n"] == 1
    assert duration["mean"] == round((2 + 3 + 1 + 2 + 1 + 1 + 1) / 7, 2)

    # Supervision: single field (q8) - only A answered.
    supervision = scores["supervision"]
    assert supervision["valid_n"] == 1
    assert supervision["total"] == 2
    assert supervision["mean"] == 3.0

    # Household Rules: single field (q9) - both answered (1 Yes, 1 No), so
    # the coded-score mean is the proportion who answered Yes (0-1 scale).
    rules = scores["household_rules"]
    assert rules["valid_n"] == 2
    assert rules["total"] == 2
    assert rules["mean"] == 0.5


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


def test_assessment_tool_status_done_flag_and_item_breakdown():
    """1=Done, 2=Not Done - blank must be excluded, never counted as either."""
    assert ma._done_flag({"pkb_1": "1"}, "pkb_1") == 1
    assert ma._done_flag({"pkb_1": "2"}, "pkb_1") == 0
    assert ma._done_flag({"pkb_1": ""}, "pkb_1") is None
    assert ma._done_flag({}, "pkb_1") is None

    records = [{"pkb_1": "1"}, {"pkb_1": "1"}, {"pkb_1": "2"}, {"pkb_1": ""}]
    item = ma._assessment_tool_item_status(records, "pkb_1", "Padh Ke Batao")
    assert item == {
        "key": "pkb_1", "label": "Padh Ke Batao",
        "done_count": 2, "not_done_count": 1, "valid_n": 3, "completion_percent": ma.percent(2, 3),
    }


def test_assessment_tool_status_analysis_field_mapping_and_denominators():
    """Locks in the exact 9 REDCap fields for the SANGIAN/VWM domains, the
    per-participant pooling method (blank fields excluded from both the
    done-count and that child's own denominator), and every reported
    denominator - not a re-derivation of the underlying REDCap scale."""
    records = [
        # Child A: fully answered - 6/6 SANGIAN done, 2/3 VWM done.
        {
            "child_id": "A", "assessment_tool_status_complete": "2",
            "pkb_1": "1", "ank_2": "1", "lkt_3": "1", "hp_4": "1", "cmc_5": "1", "chmc_6": "1",
            "vwm_1": "1", "dccs_2": "1", "cd_3": "2",
        },
        # Child B: only answered the SANGIAN block (VWM fields blank) -
        # 3/6 SANGIAN done; must NOT contribute to the VWM domain at all
        # (answered=0 there), and blank VWM fields must not count as Not
        # Done in the per-field item breakdown either.
        {
            "child_id": "B", "assessment_tool_status_complete": "0",
            "pkb_1": "1", "ank_2": "1", "lkt_3": "1", "hp_4": "2", "cmc_5": "2", "chmc_6": "2",
        },
        # Child C: registered but nothing on this instrument answered at
        # all - must be fully excluded from every domain/item denominator.
        {"child_id": "C"},
    ]
    result = ma.build_assessment_tool_status_analysis(records)

    assert result["instrument"] == "Assessment Tool Status"
    assert result["completion"]["completed"] == 1
    assert result["completion"]["total_registered"] == 3

    # --- Per-field item breakdown (9 rows, exact field order) ---
    keys = [item["key"] for item in result["items"]]
    assert keys == ["pkb_1", "ank_2", "lkt_3", "hp_4", "cmc_5", "chmc_6", "vwm_1", "dccs_2", "cd_3"]
    by_key = {item["key"]: item for item in result["items"]}
    assert by_key["pkb_1"]["done_count"] == 2 and by_key["pkb_1"]["valid_n"] == 2
    assert by_key["hp_4"]["done_count"] == 1 and by_key["hp_4"]["not_done_count"] == 1 and by_key["hp_4"]["valid_n"] == 2
    # vwm_1 only answered by A (B/C blank) - valid_n must be 1, not 0 or 3.
    assert by_key["vwm_1"]["done_count"] == 1 and by_key["vwm_1"]["valid_n"] == 1
    assert by_key["cd_3"]["done_count"] == 0 and by_key["cd_3"]["not_done_count"] == 1 and by_key["cd_3"]["valid_n"] == 1

    # --- SANGIAN domain: both A (6 done) and B (3 done) answered at least
    # one SANGIAN field, so valid_n=2 and mean_done=(6+3)/2=4.5. ---
    sangian = result["sangian"]
    assert sangian["field_count"] == 6
    assert sangian["valid_n"] == 2
    assert sangian["total"] == 3
    assert sangian["mean_done"] == 4.5
    assert sangian["completion_percent"] == round(4.5 / 6 * 100, 1)

    # --- VWM domain: only A answered any VWM field - B's blank VWM fields
    # must NOT count as a 0-done respondent, so valid_n=1, not 2. ---
    vwm = result["vwm"]
    assert vwm["field_count"] == 3
    assert vwm["valid_n"] == 1
    assert vwm["mean_done"] == 2.0
    assert vwm["completion_percent"] == round(2 / 3 * 100, 1)

    # --- Overall domain (all 9 fields pooled): A=8 done, B=3 done. ---
    overall = result["overall"]
    assert overall["field_count"] == 9
    assert overall["valid_n"] == 2
    assert overall["mean_done"] == 5.5
    assert overall["completion_percent"] == round(5.5 / 9 * 100, 1)

    # --- Overall (field-response pooled, NOT a participant denominator):
    # sum of done/not_done across all 9 items' own valid_n. Done=11
    # (2+2+2+1+1+1+1+1+0), Not Done=4 (0+0+0+1+1+1+0+0+1), valid_n=15. ---
    overall_pooled = result["overall_pooled"]
    assert overall_pooled["done_count"] == 11
    assert overall_pooled["not_done_count"] == 4
    assert overall_pooled["valid_n"] == 15
    assert overall_pooled["completion_percent"] == ma.percent(11, 15)


def test_assessment_tool_status_domain_with_no_respondents_is_none_not_zero():
    """A domain nobody has answered must report null mean/completion -
    never a fabricated 0, matching every other coded-score card's
    no-data convention in this codebase."""
    records = [{"child_id": "A", "assessment_tool_status_complete": "0"}]
    result = ma.build_assessment_tool_status_analysis(records)
    for domain in ("sangian", "vwm", "overall"):
        assert result[domain]["valid_n"] == 0
        assert result[domain]["mean_done"] is None
        assert result[domain]["completion_percent"] is None


def test_assessment_tool_status_participant_level_denominators_are_total_registered():
    """The *_participant fields are genuine participant counts - a child
    counts as Done only when every field in that test's group is answered
    Done - and every denominator is total_registered, never a sub-test
    count or a per-field valid_n (the "completed participants / total
    registered participants" figure required by Overview and the
    Assessment Tool Status section, distinct from the mean-done-per-
    respondent `sangian`/`vwm`/`overall` fields and the field-response-
    pooled `overall_pooled`/`items` fields, which are unchanged)."""
    records = [
        # Child A: all 6 SANGIAN done, VWM/DCCS done, CD explicitly Not Done.
        {
            "child_id": "A", "assessment_tool_status_complete": "2",
            "pkb_1": "1", "ank_2": "1", "lkt_3": "1", "hp_4": "1", "cmc_5": "1", "chmc_6": "1",
            "vwm_1": "1", "dccs_2": "1", "cd_3": "2",
        },
        # Child B: partial SANGIAN (not all 6 done), VWM/DCCS/CD blank.
        {
            "child_id": "B", "assessment_tool_status_complete": "0",
            "pkb_1": "1", "ank_2": "1", "lkt_3": "1", "hp_4": "2", "cmc_5": "2", "chmc_6": "2",
        },
        # Child C: nothing answered at all.
        {"child_id": "C"},
    ]
    result = ma.build_assessment_tool_status_analysis(records)

    assert result["sangian_participant"] == {"done_count": 1, "total": 3, "percent": ma.percent(1, 3)}
    assert result["vwm_participant"] == {"done_count": 1, "total": 3, "percent": ma.percent(1, 3)}
    assert result["dccs_participant"] == {"done_count": 1, "total": 3, "percent": ma.percent(1, 3)}
    assert result["cd_participant"] == {"done_count": 0, "total": 3, "percent": ma.percent(0, 3)}
    # Overall participant: all 9 fields must be Done - A fails on cd_3.
    assert result["overall_participant"] == {"done_count": 0, "total": 3, "percent": ma.percent(0, 3)}


def test_assessment_tool_status_common_participant_ids_is_intersection_of_the_four_tests():
    """`common_participant_ids` is SANGIAN ∩ VWM ∩ DCCS ∩ CD Done
    participants - additive, must not alter any existing *_participant
    count/percent above."""
    records = [
        # D: Done on all four - the only child that should appear.
        {
            "child_id": "D", "assessment_tool_status_complete": "2",
            "pkb_1": "1", "ank_2": "1", "lkt_3": "1", "hp_4": "1", "cmc_5": "1", "chmc_6": "1",
            "vwm_1": "1", "dccs_2": "1", "cd_3": "1",
        },
        # E: Done on SANGIAN/VWM/DCCS but Not Done on CD - excluded.
        {
            "child_id": "E", "assessment_tool_status_complete": "2",
            "pkb_1": "1", "ank_2": "1", "lkt_3": "1", "hp_4": "1", "cmc_5": "1", "chmc_6": "1",
            "vwm_1": "1", "dccs_2": "1", "cd_3": "2",
        },
        # F: nothing answered - excluded.
        {"child_id": "F"},
    ]
    result = ma.build_assessment_tool_status_analysis(records)
    assert result["common_participant_ids"] == ["D"]
    # The four participant counts themselves are unaffected by this field.
    assert result["sangian_participant"]["done_count"] == 2
    assert result["vwm_participant"]["done_count"] == 2
    assert result["dccs_participant"]["done_count"] == 2
    assert result["cd_participant"]["done_count"] == 1


def test_assessment_tool_status_participant_statuses_row_per_child_matches_aggregates():
    """`participant_statuses` is a per-child Done/Not-Done view using the
    exact same predicate as the aggregate *_participant/common_participant_ids
    fields - re-deriving the aggregates from these per-child rows must match
    them exactly, proving this is not a second completion definition."""
    records = [
        {
            "child_id": "D", "assessment_tool_status_complete": "2",
            "pkb_1": "1", "ank_2": "1", "lkt_3": "1", "hp_4": "1", "cmc_5": "1", "chmc_6": "1",
            "vwm_1": "1", "dccs_2": "1", "cd_3": "1",
        },
        {
            "child_id": "E", "assessment_tool_status_complete": "2",
            "pkb_1": "1", "ank_2": "1", "lkt_3": "1", "hp_4": "1", "cmc_5": "1", "chmc_6": "1",
            "vwm_1": "1", "dccs_2": "1", "cd_3": "2",
        },
        {"child_id": "F"},
    ]
    result = ma.build_assessment_tool_status_analysis(records)
    rows = result["participant_statuses"]
    assert [r["child_id"] for r in rows] == ["D", "E", "F"]
    assert rows[0] == {"child_id": "D", "sangian": True, "vwm": True, "dccs": True, "cd": True}
    assert rows[1] == {"child_id": "E", "sangian": True, "vwm": True, "dccs": True, "cd": False}
    assert rows[2] == {"child_id": "F", "sangian": False, "vwm": False, "dccs": False, "cd": False}

    # Re-derive each aggregate from these rows and confirm it matches the
    # existing aggregate fields exactly.
    assert sum(r["sangian"] for r in rows) == result["sangian_participant"]["done_count"]
    assert sum(r["vwm"] for r in rows) == result["vwm_participant"]["done_count"]
    assert sum(r["dccs"] for r in rows) == result["dccs_participant"]["done_count"]
    assert sum(r["cd"] for r in rows) == result["cd_participant"]["done_count"]
    assert [r["child_id"] for r in rows if r["sangian"] and r["vwm"] and r["dccs"] and r["cd"]] == result["common_participant_ids"]
