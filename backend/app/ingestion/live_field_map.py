"""V1 dashboard field availability against the LIVE REDCap API scope.

Verified against a live, read-only metadata export (RedCapClient.fetch_metadata())
against project PID 196, "ICMR Neurodevelopment Study".

PID 196 has 9 instruments: Registration Form, SES questionnaire, Digital-
Screen Exposure Questionnaire (DSEQ), Child Illness History, PAQ-A, Dietary
Intake, SSRS Parent, SSRS Child, SSRS Teacher.

Resolution rule applied below: a live field is mapped to an approved V1
metric ONLY when it measures the same underlying construct, not merely a
similarly-labelled field. As of 2026-08-26, field-level content is mapped
into the dashboard for Registration, SES, Child Illness History (Health &
Screening), PAQ-A (Physical Activity), and DSEQ (Screen Time) — following
the approved Active Cases Excel analytical specification (see
app.services.module_analytics). SSRS Parent/Child/Teacher contribute
items-answered/mean-rating summaries to Neurodevelopment (not the
individual t43-t51 teacher ratings, which remain unmapped — see
NEURODEVELOPMENT_STATUS). Dietary Intake's per-field content is exported
in the Active Cases sheet but has no dedicated dashboard module.
Instrument-level completion status for all instruments is used throughout
(see PROGRESSION_STATUS and the Assessment Progress module).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class LiveFieldStatus:
    dashboard_module: str
    metric: str
    available: bool
    live_field: str | None = None
    live_form: str | None = None
    note: str = ""


# --- Registry / Study Overview (source form: registration_form) ---
REGISTRY_STATUS: tuple[LiveFieldStatus, ...] = (
    LiveFieldStatus(
        "Registry", "redcap_child_id", True, "child_id", "registration_form",
        "Project's primary record-identifier field ('Original Cohort Child ID').",
    ),
    LiveFieldStatus("Registry", "sex", True, "baby_gender", "registration_form"),
    LiveFieldStatus("Registry", "dob", True, "child_dob", "registration_form"),
    LiveFieldStatus("Registry", "age_years", True, None, None, "Dashboard-derived from child_dob."),
    LiveFieldStatus("Registry", "village", True, "village_name", "registration_form"),
    LiveFieldStatus(
        "Registry", "child_status", True, "baby_status", "registration_form",
        "Binary Live/Dead field in this project (not the multi-category status seen elsewhere).",
    ),
    LiveFieldStatus("Registry", "visit_date", True, "visit_date", "registration_form"),
    LiveFieldStatus(
        "Registry", "registration_complete", True, "registration_form_complete", "registration_form",
    ),
)

# --- Demographics & SES (source form: screening_rural, labelled "SES questionnaire") ---
SES_STATUS: tuple[LiveFieldStatus, ...] = (
    LiveFieldStatus("Demographics & SES", "sex_distribution", True, "baby_gender", "registration_form"),
    LiveFieldStatus("Demographics & SES", "age_distribution", True, None, None, "Derived from child_dob."),
    LiveFieldStatus(
        "Demographics & SES", "udai_pareek_score", True, "scr_pareek_total", "screening_rural",
        "Live field labelled '22. SES Score...' (scr_ses_pareek_flag) is a binary calc "
        "flag, not the numeric score, so scr_pareek_total (the true cumulative P1-P9 "
        "score) is used instead.",
    ),
    LiveFieldStatus(
        "Demographics & SES", "udai_pareek_category", True, "scr_pareek_category", "screening_rural",
        "Numeric category code (1-5); REDCap does not expose text choice labels for "
        "calculated fields via the API, so no category name is invented.",
    ),
    LiveFieldStatus(
        "Demographics & SES", "bg_prasad_category", True, "scr_prasad_category", "screening_rural",
        "Numeric category code (1-5); same API limitation.",
    ),
    LiveFieldStatus("Demographics & SES", "per_capita_income", True, "scr_pci", "screening_rural"),
    LiveFieldStatus(
        "Demographics & SES", "household_size", True, "scr_bg_members", "screening_rural",
        "The P9 household-size field (scr_pareek_family) is a 2-bucket radio "
        "('Up to 5' / 'More than 5'), not a numeric count. scr_bg_members (the B2 "
        "field, used for per-capita income) is a numeric text field asking the same "
        "question and is used here instead so household_size is a true count.",
    ),
)

# --- Assessment module analytics (approved 2026-08-26 as the V1 analytical
#     specification — see app.services.module_analytics and the Active Cases
#     Excel export's "DOMAIN ANALYSIS" section, which uses the exact same
#     field lists and calculations as these four dashboard modules). ---
HEALTH_SCREENING_STATUS: tuple[LiveFieldStatus, ...] = (
    LiveFieldStatus(
        "Health & Screening", "current_illness_flag", True, "chh_illness_current", "child_illness_history",
        "Approved 2026-08-26 as part of the Child Illness History 'general flags' analysis.",
    ),
    LiveFieldStatus("Health & Screening", "chronic_condition_flag", True, "chh_chronic_condition", "child_illness_history"),
    LiveFieldStatus("Health & Screening", "neurodev_condition_flag", True, "chh_dev_diagnosis", "child_illness_history"),
    LiveFieldStatus("Health & Screening", "hospitalisation_flag", True, "chh_hospitalised", "child_illness_history"),
    LiveFieldStatus(
        "Health & Screening", "assessment_eligibility_decision", False, None, None,
        "chh_fit_for_assessment/chh_assessor_decision exist and are exported in the Active Cases sheet, but "
        "were not included in the approved Summary/dashboard analysis — only the 11 named conditions and 8 "
        "general flags were approved for aggregate display.",
    ),
)

PHYSICAL_ACTIVITY_STATUS: tuple[LiveFieldStatus, ...] = (
    LiveFieldStatus(
        "Physical Activity", "item1_composite_score", True, "paq_item1_score", "paq_a",
        "REDCap-calculated field; approved 2026-08-26.",
    ),
    LiveFieldStatus("Physical Activity", "item8_composite_score", True, "paq_item8_score", "paq_a"),
    LiveFieldStatus("Physical Activity", "paqa_final_score", True, "paq_total_score", "paq_a"),
)

SCREEN_TIME_STATUS: tuple[LiveFieldStatus, ...] = (
    LiveFieldStatus(
        "Screen Time", "total_daily_screen_time", True, "q10_total_screen_time", "dseq",
        "Approved 2026-08-26 distribution + 3 Yes/No items (Q9/Q14/Q15).",
    ),
    LiveFieldStatus(
        "Screen Time", "tv_frequency", False, "q1_tv_freq", "dseq",
        "Field is mapped and exported in the Active Cases sheet, but per-item TV/phone/laptop frequency "
        "distributions were not included in the approved Summary/dashboard analysis (only Q10 total screen "
        "time + the 3 Yes/No items were).",
    ),
    LiveFieldStatus("Screen Time", "smartphone_frequency", False, "q4_phone_freq", "dseq", "See tv_frequency note."),
    LiveFieldStatus("Screen Time", "laptop_frequency", False, "q7_laptop_freq", "dseq", "See tv_frequency note."),
    LiveFieldStatus("Screen Time", "educational_use_flag", True, "q14_school_use", "dseq", "Approved 2026-08-26 (Q14 Yes/No item)."),
    LiveFieldStatus("Screen Time", "entertainment_use_flag", True, "q15_entertainment_use", "dseq", "Approved 2026-08-26 (Q15 Yes/No item)."),
)

NEURODEVELOPMENT_STATUS: tuple[LiveFieldStatus, ...] = (
    LiveFieldStatus(
        "Neurodevelopment", "teacher_academic_performance", False, "t43_rating", "ssrs_teacher",
        "t43_rating exists in REDCap but is NOT part of the approved analytical specification — the approved "
        "Neurodevelopment analysis uses SSRS Parent/Child/Teacher items-answered counts and mean "
        "frequency/importance ratings (p*/c*/t*_freq and _imp fields) instead of the individual t43-t51 "
        "teacher ratings. SSRS Teacher also has 0/live completions today regardless.",
    ),
    LiveFieldStatus("Neurodevelopment", "teacher_reading_ability", False, "t44_rating", "ssrs_teacher", "See teacher_academic_performance note."),
    LiveFieldStatus("Neurodevelopment", "teacher_math_ability", False, "t45_rating", "ssrs_teacher", "See teacher_academic_performance note."),
    LiveFieldStatus("Neurodevelopment", "teacher_academic_motivation", False, "t48_rating", "ssrs_teacher", "See teacher_academic_performance note."),
    LiveFieldStatus("Neurodevelopment", "teacher_learning_ability", False, "t50_rating", "ssrs_teacher", "See teacher_academic_performance note."),
    LiveFieldStatus("Neurodevelopment", "teacher_classroom_behaviour", False, "t51_rating", "ssrs_teacher", "See teacher_academic_performance note."),
)

# --- Assessment Progress / Pipeline ---
# Confirmed instrument -> completion-field mapping (all 9 instruments in PID 196).
# REDCap coding: 0=Incomplete, 1=Unverified, 2=Complete.
REGISTRATION_COMPLETE_FIELD = "registration_form_complete"

# The six instruments that together make up the "Core Assessment Battery",
# paired with their user-facing labels (for the Assessment Coverage section).
SSRS_PARENT_COMPLETE_FIELD = "ssrs_parent_complete"
SSRS_CHILD_COMPLETE_FIELD = "ssrs_child_complete"
SSRS_TEACHER_COMPLETE_FIELD = "ssrs_teacher_complete"

CORE_BATTERY_INSTRUMENTS: tuple[tuple[str, str, str], ...] = (
    # (key, completion field, display label)
    ("ses", "screening_rural_complete", "SES"),
    ("dseq", "dseq_complete", "DSEQ"),
    ("child_illness_history", "child_illness_history_complete", "Child Illness History"),
    ("paq_a", "paq_a_complete", "PAQ-A"),
    ("dietary_intake", "dietary_intake_complete", "Dietary Intake"),
    ("ssrs_parent", SSRS_PARENT_COMPLETE_FIELD, "SSRS Parent"),
)

CORE_BATTERY_COMPLETE_FIELDS: tuple[str, ...] = tuple(field for _, field, _ in CORE_BATTERY_INSTRUMENTS)

CORE_BATTERY_DESCRIPTION = (
    "SES, DSEQ, Child Illness History, PAQ-A, Dietary Intake and SSRS Parent completed."
)

# All nine live instruments in PID 196, each paired with its own completion
# field and a display label for the Overview "Assessment Instrument Coverage"
# panel. Every entry is calculated independently of the others — this is a
# per-instrument breakdown, NOT the Completed Assessment Set intersection
# (see CORE_BATTERY_COMPLETE_FIELDS / _core_battery_ids for that).
ALL_INSTRUMENTS: tuple[tuple[str, str, str], ...] = (
    ("registration", REGISTRATION_COMPLETE_FIELD, "Registration Form"),
    *CORE_BATTERY_INSTRUMENTS,
    ("ssrs_child", SSRS_CHILD_COMPLETE_FIELD, "SSRS Child"),
    ("ssrs_teacher", SSRS_TEACHER_COMPLETE_FIELD, "SSRS Teacher"),
)

PROGRESSION_STATUS: tuple[LiveFieldStatus, ...] = (
    LiveFieldStatus("Assessment Progress", "registered", True, "child_id", "registration_form"),
    LiveFieldStatus("Assessment Progress", "core_assessment_battery", True, None, "screening_rural, dseq, child_illness_history, paq_a, dietary_intake, ssrs_parent", CORE_BATTERY_DESCRIPTION),
    LiveFieldStatus("Assessment Progress", "ssrs_child", True, SSRS_CHILD_COMPLETE_FIELD, "ssrs_child"),
    LiveFieldStatus("Assessment Progress", "ssrs_teacher", True, SSRS_TEACHER_COMPLETE_FIELD, "ssrs_teacher"),
)

ALL_STATUS: tuple[LiveFieldStatus, ...] = (
    REGISTRY_STATUS
    + SES_STATUS
    + HEALTH_SCREENING_STATUS
    + PHYSICAL_ACTIVITY_STATUS
    + SCREEN_TIME_STATUS
    + NEURODEVELOPMENT_STATUS
    + PROGRESSION_STATUS
)

# --- Export-only fields (Active Cases Excel/CSV export) ---
# Approved per the 2026-08-26 live-metadata field audit. These are NOT used
# by any dashboard module/calculation above — they exist here only so that
# LiveRedCapRepository's fixed field whitelist (LIVE_FIELDS) includes them,
# for app.services.export_service to read. See export_service.py's
# ACTIVE_CASES_FIELD_SPECS for the per-field acquired/derived documentation.
#
# Udai Pareek P1 (caste, scr_pareek_caste) and P1a (actual caste category,
# scr_caste_category) are intentionally EXCLUDED from this list and from the
# export — caste is sensitive demographic data and was excluded per explicit
# instruction, even though it is technically part of the P1-P9 Udai Pareek
# item set. The 8 fields below are P2-P9.
SES_EXPORT_FIELDS: tuple[str, ...] = (
    "scr_bg_income",
    "scr_pareek_occupation",
    "scr_pareek_social",
    "scr_pareek_house",
    "scr_pareek_animals",
    "scr_pareek_education",
    "scr_pareek_land",
    "scr_pareek_assets",
    "scr_pareek_family",
)

DSEQ_EXPORT_FIELDS: tuple[str, ...] = (
    "q1_tv_freq",
    "q2_tv_school",
    "q3_tv_holiday",
    "q4_phone_freq",
    "q5_phone_school",
    "q6_phone_holiday",
    "q7_laptop_freq",
    "q8_supervision",
    "q9_household_rules",
    "q10_total_screen_time",
    "q11_outdoor_school",
    "q12_outdoor_holiday",
    "q13_main_use",
    "q14_school_use",
    "q15_entertainment_use",
)

# The 34 coded Yes/No/ordinal fields identified in the audit report (the
# audit's prose estimate of "~26" undercounted the 10 individual chh_q8_*
# named-condition checks as a single group).
CHH_EXPORT_FIELDS: tuple[str, ...] = (
    "chh_illness_current",
    "chh_unwell_7days",
    "chh_illness_3mo",
    "chh_illness_3mo_freq",
    "chh_missed_school_3mo",
    "chh_chronic_condition",
    "chh_q8_asthma",
    "chh_q8_heart",
    "chh_q8_tb",
    "chh_q8_diabetes",
    "chh_q8_thyroid",
    "chh_q8_anaemia",
    "chh_q8_malnutrition",
    "chh_q8_kidney",
    "chh_q8_liver",
    "chh_q8_infections",
    "chh_q8_other",
    "chh_seizures",
    "chh_loc_fainting",
    "chh_cns_infection",
    "chh_head_injury",
    "chh_vision_difficulty",
    "chh_uses_glasses",
    "chh_hearing_difficulty",
    "chh_ear_infection",
    "chh_dev_diagnosis",
    "chh_hospitalised",
    "chh_surgery",
    "chh_medicine_current",
    "chh_allergy",
    "chh_health_rating",
    "chh_fit_for_assessment",
    "chh_health_affects_today",
    "chh_assessor_decision",
)

PAQA_EXPORT_FIELDS: tuple[str, ...] = ("paq_item1_score", "paq_item8_score", "paq_total_score")

DIETARY_EXPORT_FIELDS: tuple[str, ...] = (
    "die_grains_freq",
    "die_pulses_freq",
    "die_nuts_seeds_freq",
    "die_dairy_freq",
    "die_flesh_freq",
    "die_eggs_freq",
    "die_dgl_veg_freq",
    "die_vita_fv_freq",
    "die_other_veg_freq",
    "die_other_fruits_freq",
)

# SSRS Parent/Child/Teacher: per-item frequency + importance rating fields
# (confirmed live field names, 2026-08-26). Raw items are not individually
# exported to keep the Active Cases sheet readable — export_service.py
# instead computes a per-child "items answered" count and mean rating for
# each of the two rating scales. Included for all three instruments
# (including Teacher, which has 0/212 live completions today) so the same
# computation is dynamic and future-proof rather than hardcoded per form.
SSRS_PARENT_FREQ_FIELDS: tuple[str, ...] = tuple(f"p{i}_freq" for i in range(1, 53))
SSRS_PARENT_IMP_FIELDS: tuple[str, ...] = tuple(f"p{i}_imp" for i in range(1, 41))
SSRS_CHILD_FREQ_FIELDS: tuple[str, ...] = tuple(f"c{i}_freq" for i in range(1, 35))
SSRS_CHILD_IMP_FIELDS: tuple[str, ...] = tuple(f"c{i}_imp" for i in range(1, 35))
SSRS_TEACHER_FREQ_FIELDS: tuple[str, ...] = tuple(f"t{i}_freq" for i in range(1, 43))
SSRS_TEACHER_IMP_FIELDS: tuple[str, ...] = tuple(f"t{i}_imp" for i in range(1, 31))

EXPORT_ONLY_FIELDS: tuple[str, ...] = (
    *SES_EXPORT_FIELDS,
    *DSEQ_EXPORT_FIELDS,
    *CHH_EXPORT_FIELDS,
    *PAQA_EXPORT_FIELDS,
    *DIETARY_EXPORT_FIELDS,
    *SSRS_PARENT_FREQ_FIELDS,
    *SSRS_PARENT_IMP_FIELDS,
    *SSRS_CHILD_FREQ_FIELDS,
    *SSRS_CHILD_IMP_FIELDS,
    *SSRS_TEACHER_FREQ_FIELDS,
    *SSRS_TEACHER_IMP_FIELDS,
)

# The fixed set of live REDCap field names the application requests and caches.
LIVE_FIELDS: tuple[str, ...] = (
    "child_id",
    "baby_gender",
    "child_dob",
    "village_name",
    "baby_status",
    "visit_date",
    REGISTRATION_COMPLETE_FIELD,
    "scr_pareek_total",
    "scr_pareek_category",
    "scr_prasad_category",
    "scr_pci",
    "scr_bg_members",
    *CORE_BATTERY_COMPLETE_FIELDS,
    SSRS_CHILD_COMPLETE_FIELD,
    SSRS_TEACHER_COMPLETE_FIELD,
    *EXPORT_ONLY_FIELDS,
)
