"""Fixture REDCap metadata/records shaped like the live PID 196 project
("ICMR Neurodevelopment Study"), used to test normalization and aggregation
deterministically without any network call. Field names mirror the real
live project's registration_form + screening_rural (SES questionnaire) +
the six core-battery / SSRS completion fields, but values are entirely
synthetic test data.
"""
from datetime import date

FIXTURE_METADATA: list[dict] = [
    {"field_name": "child_id", "form_name": "registration_form", "field_type": "text", "field_label": "Original Cohort Child ID"},
    {
        "field_name": "baby_gender",
        "form_name": "registration_form",
        "field_type": "dropdown",
        "field_label": "sex of the child",
        # Real live label format: bilingual "English /Hindi" — exercises the
        # primary-language-segment stripping in app.ingestion.choice_maps.
        "select_choices_or_calculations": "1, male /transliteration | 2, female/transliteration",
    },
    {"field_name": "child_dob", "form_name": "registration_form", "field_type": "text", "field_label": "child dob"},
    {"field_name": "village_name", "form_name": "registration_form", "field_type": "text", "field_label": "Village name"},
    {
        "field_name": "baby_status",
        "form_name": "registration_form",
        "field_type": "radio",
        "field_label": "child Status",
        "select_choices_or_calculations": "1, Live / transliteration | 0, Dead / transliteration",
    },
    {"field_name": "visit_date", "form_name": "registration_form", "field_type": "text", "field_label": "Visit Date"},
    {"field_name": "registration_form_complete", "form_name": "registration_form", "field_type": "text", "field_label": "Complete?"},
    {"field_name": "scr_pareek_total", "form_name": "screening_rural", "field_type": "calc", "field_label": "SES Score"},
    {"field_name": "scr_pareek_category", "form_name": "screening_rural", "field_type": "calc", "field_label": "Udai Pareek Category"},
    {"field_name": "scr_prasad_category", "form_name": "screening_rural", "field_type": "calc", "field_label": "BG Prasad Category"},
    {"field_name": "scr_pci", "form_name": "screening_rural", "field_type": "calc", "field_label": "Per Capita Income"},
    {"field_name": "scr_bg_members", "form_name": "screening_rural", "field_type": "text", "field_label": "Household members"},
    {"field_name": "screening_rural_complete", "form_name": "screening_rural", "field_type": "text", "field_label": "Complete?"},
    {"field_name": "dseq_complete", "form_name": "dseq", "field_type": "text", "field_label": "Complete?"},
    {"field_name": "child_illness_history_complete", "form_name": "child_illness_history", "field_type": "text", "field_label": "Complete?"},
    {"field_name": "paq_a_complete", "form_name": "paq_a", "field_type": "text", "field_label": "Complete?"},
    {"field_name": "dietary_intake_complete", "form_name": "dietary_intake", "field_type": "text", "field_label": "Complete?"},
    {"field_name": "ssrs_parent_complete", "form_name": "ssrs_parent", "field_type": "text", "field_label": "Complete?"},
    {"field_name": "ssrs_child_complete", "form_name": "ssrs_child", "field_type": "text", "field_label": "Complete?"},
    {"field_name": "ssrs_teacher_complete", "form_name": "ssrs_teacher", "field_type": "text", "field_label": "Complete?"},
]


def _dob_years_ago(years: int, as_of: date) -> str:
    return date(as_of.year - years, as_of.month, as_of.day).isoformat()


_CORE_FIELDS = (
    "screening_rural_complete",
    "dseq_complete",
    "child_illness_history_complete",
    "paq_a_complete",
    "dietary_intake_complete",
    "ssrs_parent_complete",
)


def _base_record(child_id: str, **overrides: str) -> dict:
    record = {
        "child_id": child_id,
        "baby_gender": "1",
        "child_dob": "",
        "village_name": "Alpha Village",
        "baby_status": "1",
        "visit_date": "",
        "registration_form_complete": "2",
        "scr_pareek_total": "",
        "scr_pareek_category": "",
        "scr_prasad_category": "",
        "scr_pci": "",
        "scr_bg_members": "",
        "screening_rural_complete": "0",
        "dseq_complete": "0",
        "child_illness_history_complete": "0",
        "paq_a_complete": "0",
        "dietary_intake_complete": "0",
        "ssrs_parent_complete": "0",
        "ssrs_child_complete": "0",
        "ssrs_teacher_complete": "0",
    }
    record.update(overrides)
    return record


def build_fixture_records(as_of: date) -> list[dict]:
    core_complete = {f: "2" for f in _CORE_FIELDS}

    return [
        # REC001: full pipeline through SSRS Child, but NOT SSRS Teacher.
        _base_record(
            "REC001",
            baby_gender="1",
            child_dob=_dob_years_ago(6, as_of),
            village_name="Alpha Village",
            scr_pareek_total="35",
            scr_pareek_category="2",
            scr_prasad_category="3",
            scr_pci="3000",
            scr_bg_members="5",
            ssrs_child_complete="2",
            ssrs_teacher_complete="0",
            **core_complete,
        ),
        # REC002: full pipeline through SSRS Teacher.
        _base_record(
            "REC002",
            baby_gender="2",
            child_dob=_dob_years_ago(11, as_of),
            village_name="Beta Village",
            scr_pareek_total="40",
            scr_pareek_category="3",
            scr_prasad_category="4",
            scr_pci="2500",
            scr_bg_members="6",
            ssrs_child_complete="2",
            ssrs_teacher_complete="2",
            **core_complete,
        ),
        # REC003: core battery complete, but SSRS Child not started.
        _base_record(
            "REC003",
            child_dob=_dob_years_ago(9, as_of),
            scr_pareek_total="20",
            scr_pareek_category="4",
            scr_prasad_category="4",
            scr_pci="1800",
            scr_bg_members="4",
            **core_complete,
        ),
        # REC004: PARTIAL core battery — 5 of 6 complete (dietary_intake missing).
        # Must NOT count toward core_assessment_battery (strict intersection).
        _base_record(
            "REC004",
            child_dob=_dob_years_ago(8, as_of),
            screening_rural_complete="2",
            dseq_complete="2",
            child_illness_history_complete="2",
            paq_a_complete="2",
            dietary_intake_complete="0",
            ssrs_parent_complete="2",
        ),
        # REC005: registered only, nothing else started.
        _base_record("REC005", child_dob=""),
        # REC006: registration form itself marked incomplete, but still a
        # valid record with a child_id — must still count as "registered".
        _base_record("REC006", registration_form_complete="0", child_dob=_dob_years_ago(4, as_of)),
        # REC007: blank child_id — must be excluded from every count entirely,
        # even though its instrument fields look "complete".
        _base_record("", **core_complete, ssrs_child_complete="2", ssrs_teacher_complete="2"),
    ]


class FakeRedCapRepository:
    """Duck-compatible stand-in for LiveRedCapRepository — no network I/O."""

    def __init__(self, metadata: list[dict], records: list[dict]) -> None:
        self._metadata = metadata
        self._records = records

    async def get_metadata(self) -> list[dict]:
        return self._metadata

    async def get_records(self) -> list[dict]:
        return self._records
