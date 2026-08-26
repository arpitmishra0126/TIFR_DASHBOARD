"""The V1 dashboard variable contract, as approved in
data/ICMR_Neurodevelopment_Dashboard_V1_Variable_Spec.docx.

KNOWN LIMITATION: the only REDCap export available to this project so far is
the DATA_LABELS export (data/ICMRNeurodevelopment_DATA_LABELS_2026-08-25_1434.csv),
which uses human-readable question text as column headers, not REDCap's
internal variable names. The keys below are therefore REDCap *field labels*,
not variable names.

This mapping must be re-keyed to real REDCap variable names once the
project's Data Dictionary is obtained via RedCapClient.fetch_metadata().
Do not guess variable names — re-key from the Data Dictionary export only.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class FieldMapping:
    """One dashboard field's provenance, matching the approved V1 spec table."""

    dashboard_module: str
    normalized_field: str
    redcap_source_label: str
    derived: bool = False


# Registry / Study Overview
REGISTRY_FIELDS: tuple[FieldMapping, ...] = (
    FieldMapping("Registry", "redcap_child_id", "Original Cohort Child ID"),
    FieldMapping("Registry", "sex", "sex of the child"),
    FieldMapping("Registry", "dob", "child dob"),
    FieldMapping("Registry", "age_years", "child dob (age derived)", derived=True),
    FieldMapping("Registry", "village", "Village name"),
    FieldMapping("Registry", "child_status", "child Status"),
    FieldMapping("Registry", "visit_date", "Visit Date"),
    FieldMapping("Registry", "registration_complete", "Complete? (Registration form)"),
)

# Demographics & SES
SES_FIELDS: tuple[FieldMapping, ...] = (
    FieldMapping("Demographics & SES", "udai_pareek_score", "22. SES Score based on Udai Pareek Scale"),
    FieldMapping("Demographics & SES", "udai_pareek_category", "Category (Udai Pareek)"),
    FieldMapping("Demographics & SES", "bg_prasad_category", "Category (BG Prasad)"),
    FieldMapping("Demographics & SES", "per_capita_income", "Per Capita Income"),
    FieldMapping(
        "Demographics & SES", "household_size", "P9. How many family members live in your household?"
    ),
)

# Health & Screening
HEALTH_SCREENING_FIELDS: tuple[FieldMapping, ...] = (
    FieldMapping(
        "Health & Screening",
        "current_illness_flag",
        "1. Is the child currently suffering from any illness or health problem?",
    ),
    FieldMapping(
        "Health & Screening",
        "chronic_condition_flag",
        "7. Has the child ever been diagnosed with any long-term or recurrent medical condition?",
    ),
    FieldMapping(
        "Health & Screening",
        "neurodev_condition_flag",
        "18. Has the child ever been diagnosed with a developmental, learning, "
        "neurological, or behavioural condition?",
    ),
    FieldMapping(
        "Health & Screening",
        "hospitalisation_flag",
        "19. Has the child ever been admitted to a hospital overnight or longer?",
    ),
    FieldMapping(
        "Health & Screening",
        "assessment_eligibility_decision",
        "27. Based on the child's current health status, what is the decision "
        "regarding today's assessment?",
    ),
)

# Physical Activity (PAQ-A)
PHYSICAL_ACTIVITY_FIELDS: tuple[FieldMapping, ...] = (
    FieldMapping(
        "Physical Activity",
        "item1_composite_score",
        "Item 1 composite score (mean of spare-time activity checklist)",
    ),
    FieldMapping(
        "Physical Activity",
        "item8_composite_score",
        "Item 8 composite score (mean of daily activity ratings, Mon-Sun)",
    ),
    FieldMapping(
        "Physical Activity",
        "paqa_final_score",
        "PAQ-A final activity summary score (mean of items 1-8; excludes item 9)",
    ),
)

# Screen Time
SCREEN_TIME_FIELDS: tuple[FieldMapping, ...] = (
    FieldMapping(
        "Screen Time",
        "total_daily_screen_time",
        "What is the average total screen time of the child per day across all devices?",
    ),
    FieldMapping("Screen Time", "tv_frequency", "How often does the child watch television in a typical week?"),
    FieldMapping(
        "Screen Time",
        "smartphone_frequency",
        "How often does the child use a smartphone/tablet in a typical week?",
    ),
    FieldMapping(
        "Screen Time", "laptop_frequency", "How often does the child use a laptop/computer in a typical week?"
    ),
    FieldMapping(
        "Screen Time",
        "educational_use_flag",
        "Does the child use screen devices for school-related learning or homework?",
    ),
    FieldMapping(
        "Screen Time",
        "entertainment_use_flag",
        "Does the child use screen devices mainly for entertainment (games/videos/cartoons)?",
    ),
)

# Neurodevelopment / Assessment (teacher-rated items only)
NEURODEVELOPMENT_FIELDS: tuple[FieldMapping, ...] = (
    FieldMapping(
        "Neurodevelopment / Assessment",
        "teacher_academic_performance",
        "43. Overall academic performance compared with other children in the same classroom",
    ),
    FieldMapping(
        "Neurodevelopment / Assessment", "teacher_reading_ability", "44. Reading ability compared with other students"
    ),
    FieldMapping(
        "Neurodevelopment / Assessment",
        "teacher_math_ability",
        "45. Mathematics ability compared with other students",
    ),
    FieldMapping(
        "Neurodevelopment / Assessment",
        "teacher_academic_motivation",
        "48. Overall motivation to succeed academically",
    ),
    FieldMapping(
        "Neurodevelopment / Assessment",
        "teacher_learning_ability",
        "50. Overall learning ability/intellectual functioning compared with classmates",
    ),
    FieldMapping(
        "Neurodevelopment / Assessment",
        "teacher_classroom_behaviour",
        "51. Overall classroom behaviour compared with classmates",
    ),
)

# Assessment Progress / Funnel
ASSESSMENT_PROGRESS_FIELDS: tuple[FieldMapping, ...] = (
    FieldMapping("Assessment Progress", "registration_complete", "Complete? (Registration form)"),
    FieldMapping("Assessment Progress", "ses_complete", "Complete? (SES/BG Prasad form)"),
    FieldMapping("Assessment Progress", "screen_time_complete", "Complete? (Screen Time form)"),
    FieldMapping("Assessment Progress", "health_screening_complete", "Complete? (Health Screening form)"),
    FieldMapping("Assessment Progress", "physical_activity_complete", "Complete? (Physical Activity form)"),
    FieldMapping("Assessment Progress", "nutrition_complete", "Complete? (Nutrition form)"),
    FieldMapping("Assessment Progress", "parent_report_complete", "Complete? (Parent-report assessment form)"),
    FieldMapping("Assessment Progress", "child_report_complete", "Complete? (Child self-report assessment form)"),
    FieldMapping("Assessment Progress", "teacher_report_complete", "Complete? (Teacher assessment form)"),
    FieldMapping("Assessment Progress", "overall_status", "derived from all instrument Complete? statuses", derived=True),
)

ALL_FIELD_MAPPINGS: tuple[FieldMapping, ...] = (
    REGISTRY_FIELDS
    + SES_FIELDS
    + HEALTH_SCREENING_FIELDS
    + PHYSICAL_ACTIVITY_FIELDS
    + SCREEN_TIME_FIELDS
    + NEURODEVELOPMENT_FIELDS
    + ASSESSMENT_PROGRESS_FIELDS
)
