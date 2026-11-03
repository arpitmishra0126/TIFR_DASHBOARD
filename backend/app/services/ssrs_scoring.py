"""SSRS raw domain scoring - approved spec (confirmed by the study team,
2026-11-03).

Raw totals of the frequency answers only - importance is NEVER scored, and
no item is reverse-scored. This is an ADAPTED, SSRS-informed research
questionnaire, not the official SSRS, so only raw scores are ever shown:
no official norms, cutoffs, percentiles or "at risk"/colour-coded risk
labels anywhere in this app.

Each item is a REDCap `radio` coded 0/1/2 (frequency: Never/Sometimes/Very
Often) or, for the teacher academic/classroom competence items, 1-5
(Lowest 10%..Highest 10%) - a domain's score is simply the sum of the raw
coded values across that domain's own fields, for a child who answered
every one of them on a form marked Complete.

Kept as one small config object (not scattered across module_analytics.py)
so the respondent/domain/field-list/range/direction mapping is easy to
review or change later - every scoring function in module_analytics.py
reads from SSRS_SCORE_DOMAINS, never a second hardcoded copy of this table.

    | Respondent | Domain                         | Fields                  | Range | Direction                               |
    | Parent     | Social Skills                  | p1_freq..p40_freq       | 0-80  | higher = stronger social skills         |
    | Parent     | Problem Behaviours              | p41_freq..p52_freq      | 0-24  | higher = more concerns                  |
    | Child      | Social Skills                  | c1_freq..c34_freq       | 0-68  | higher = stronger social skills         |
    | Teacher    | Social Skills                  | t1_freq..t30_freq       | 0-60  | higher = stronger social skills         |
    | Teacher    | Problem Behaviours              | t31_freq..t42_freq      | 0-24  | higher = more concerns                  |
    | Teacher    | Academic/Classroom Competence   | t43_rating..t51_rating  | 9-45  | higher = stronger classroom functioning |

Never combine Social Skills and Problem Behaviours into one total.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.ingestion.live_field_map import (
    SSRS_CHILD_FREQ_FIELDS,
    SSRS_PARENT_FREQ_FIELDS,
    SSRS_TEACHER_FREQ_FIELDS,
    SSRS_TEACHER_RATING_FIELDS,
)


@dataclass(frozen=True)
class SsrsScoreDomain:
    respondent: str  # "parent" | "child" | "teacher"
    key: str  # "social_skills" | "problem_behaviours" | "academic_competence"
    label: str
    fields: tuple[str, ...]
    complete_field: str
    minimum: int
    maximum: int
    direction: str


SSRS_SCORE_DOMAINS: tuple[SsrsScoreDomain, ...] = (
    SsrsScoreDomain(
        "parent", "social_skills", "Social Skills",
        SSRS_PARENT_FREQ_FIELDS[:40], "ssrs_parent_complete", 0, 80,
        "Higher score = stronger social skills",
    ),
    SsrsScoreDomain(
        "parent", "problem_behaviours", "Problem Behaviours",
        SSRS_PARENT_FREQ_FIELDS[40:], "ssrs_parent_complete", 0, 24,
        "Higher score = more concerns",
    ),
    SsrsScoreDomain(
        "child", "social_skills", "Social Skills",
        SSRS_CHILD_FREQ_FIELDS, "ssrs_child_complete", 0, 68,
        "Higher score = stronger social skills",
    ),
    SsrsScoreDomain(
        "teacher", "social_skills", "Social Skills",
        SSRS_TEACHER_FREQ_FIELDS[:30], "ssrs_teacher_complete", 0, 60,
        "Higher score = stronger social skills",
    ),
    SsrsScoreDomain(
        "teacher", "problem_behaviours", "Problem Behaviours",
        SSRS_TEACHER_FREQ_FIELDS[30:], "ssrs_teacher_complete", 0, 24,
        "Higher score = more concerns",
    ),
    SsrsScoreDomain(
        "teacher", "academic_competence", "Academic/Classroom Competence",
        SSRS_TEACHER_RATING_FIELDS, "ssrs_teacher_complete", 9, 45,
        "Higher score = stronger classroom functioning",
    ),
)

SSRS_DOMAINS_BY_RESPONDENT: dict[str, tuple[SsrsScoreDomain, ...]] = {
    "parent": tuple(d for d in SSRS_SCORE_DOMAINS if d.respondent == "parent"),
    "child": tuple(d for d in SSRS_SCORE_DOMAINS if d.respondent == "child"),
    "teacher": tuple(d for d in SSRS_SCORE_DOMAINS if d.respondent == "teacher"),
}

SSRS_DOMAIN_BY_RESPONDENT_KEY: dict[str, SsrsScoreDomain] = {
    f"{d.respondent}_{d.key}": d for d in SSRS_SCORE_DOMAINS
}
