"""V1 dashboard field availability against the LIVE REDCap API scope.

Verified against a live, read-only metadata export (RedCapClient.fetch_metadata())
against project PID 196, "ICMR Neurodevelopment Study".

PID 196 has 9 instruments: Registration Form, SES questionnaire, Digital-
Screen Exposure Questionnaire (DSEQ), Child Illness History, PAQ-A, Dietary
Intake, SSRS Parent, SSRS Child, SSRS Teacher.

Resolution rule applied below: a live field is mapped to an approved V1
metric ONLY when it measures the same underlying construct, not merely a
similarly-labelled field. This app currently maps field-level content for
Registration and the SES questionnaire only; the other 6 instruments exist
in the project but their per-field content has not yet been mapped into
this dashboard — only their instrument-level completion status is used
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

# --- Instruments that exist in PID 196 but whose per-field content is not yet
#     mapped into this dashboard. Their instrument-level completion status IS
#     used (see PROGRESSION_STATUS) — this section covers the still-unbuilt
#     detailed-metric modules only. ---
HEALTH_SCREENING_STATUS: tuple[LiveFieldStatus, ...] = (
    LiveFieldStatus(
        "Health & Screening", "current_illness_flag", False, None, None,
        "The 'Child Illness History' instrument exists in this project, but its "
        "field-level content has not yet been mapped into this dashboard module. "
        "Only its instrument-completion status is currently used (Assessment Progress).",
    ),
    LiveFieldStatus("Health & Screening", "chronic_condition_flag", False, None, None, "See current_illness_flag note."),
    LiveFieldStatus("Health & Screening", "neurodev_condition_flag", False, None, None, "See current_illness_flag note."),
    LiveFieldStatus("Health & Screening", "hospitalisation_flag", False, None, None, "See current_illness_flag note."),
    LiveFieldStatus("Health & Screening", "assessment_eligibility_decision", False, None, None, "See current_illness_flag note."),
)

PHYSICAL_ACTIVITY_STATUS: tuple[LiveFieldStatus, ...] = (
    LiveFieldStatus(
        "Physical Activity", "item1_composite_score", False, None, None,
        "The PAQ-A instrument exists in this project, but its field-level content "
        "has not yet been mapped into this dashboard module. Only its instrument-"
        "completion status is currently used (Assessment Progress).",
    ),
    LiveFieldStatus("Physical Activity", "item8_composite_score", False, None, None, "See item1_composite_score note."),
    LiveFieldStatus("Physical Activity", "paqa_final_score", False, None, None, "See item1_composite_score note."),
)

SCREEN_TIME_STATUS: tuple[LiveFieldStatus, ...] = (
    LiveFieldStatus(
        "Screen Time", "total_daily_screen_time", False, None, None,
        "The Digital-Screen Exposure Questionnaire (DSEQ) instrument exists in this "
        "project, but its field-level content has not yet been mapped into this "
        "dashboard module. Only its instrument-completion status is currently used "
        "(Assessment Progress).",
    ),
    LiveFieldStatus("Screen Time", "tv_frequency", False, None, None, "See total_daily_screen_time note."),
    LiveFieldStatus("Screen Time", "smartphone_frequency", False, None, None, "See total_daily_screen_time note."),
    LiveFieldStatus("Screen Time", "laptop_frequency", False, None, None, "See total_daily_screen_time note."),
    LiveFieldStatus("Screen Time", "educational_use_flag", False, None, None, "See total_daily_screen_time note."),
    LiveFieldStatus("Screen Time", "entertainment_use_flag", False, None, None, "See total_daily_screen_time note."),
)

NEURODEVELOPMENT_STATUS: tuple[LiveFieldStatus, ...] = (
    LiveFieldStatus(
        "Neurodevelopment", "teacher_academic_performance", False, None, None,
        "The SSRS Teacher instrument exists in this project, but its field-level "
        "content has not yet been mapped into this dashboard module. Only its "
        "instrument-completion status is currently used (Assessment Progress).",
    ),
    LiveFieldStatus("Neurodevelopment", "teacher_reading_ability", False, None, None, "See teacher_academic_performance note."),
    LiveFieldStatus("Neurodevelopment", "teacher_math_ability", False, None, None, "See teacher_academic_performance note."),
    LiveFieldStatus("Neurodevelopment", "teacher_academic_motivation", False, None, None, "See teacher_academic_performance note."),
    LiveFieldStatus("Neurodevelopment", "teacher_learning_ability", False, None, None, "See teacher_academic_performance note."),
    LiveFieldStatus("Neurodevelopment", "teacher_classroom_behaviour", False, None, None, "See teacher_academic_performance note."),
)

# --- Assessment Progress / Pipeline ---
# Confirmed instrument -> completion-field mapping (all 9 instruments in PID 196).
# REDCap coding: 0=Incomplete, 1=Unverified, 2=Complete.
REGISTRATION_COMPLETE_FIELD = "registration_form_complete"

# The six instruments that together make up the "Core Assessment Battery",
# paired with their user-facing labels (for the Assessment Coverage section).
CORE_BATTERY_INSTRUMENTS: tuple[tuple[str, str, str], ...] = (
    # (key, completion field, display label)
    ("ses", "screening_rural_complete", "SES"),
    ("dseq", "dseq_complete", "DSEQ"),
    ("child_illness_history", "child_illness_history_complete", "Child Illness History"),
    ("paq_a", "paq_a_complete", "PAQ-A"),
    ("dietary_intake", "dietary_intake_complete", "Dietary Intake"),
    ("ssrs_parent", "ssrs_parent_complete", "SSRS Parent"),
)

CORE_BATTERY_COMPLETE_FIELDS: tuple[str, ...] = tuple(field for _, field, _ in CORE_BATTERY_INSTRUMENTS)

SSRS_CHILD_COMPLETE_FIELD = "ssrs_child_complete"
SSRS_TEACHER_COMPLETE_FIELD = "ssrs_teacher_complete"

CORE_BATTERY_DESCRIPTION = (
    "SES, DSEQ, Child Illness History, PAQ-A, Dietary Intake and SSRS Parent completed."
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
)
