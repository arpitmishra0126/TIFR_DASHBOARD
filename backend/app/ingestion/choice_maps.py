"""Resolve REDCap radio/dropdown coded values to their label text.

REDCap's raw-format record export returns the stored code (e.g. "1") for
radio/dropdown fields, not the human label. The Data Dictionary (metadata)
export carries the code->label mapping per field in
`select_choices_or_calculations`, formatted as "code, label | code, label | ...".
Calc fields have no such mapping — their formula lives in the same column but
does not describe choice labels, so calc-derived values are exposed as raw
numbers, not invented text.

This study's forms label choices bilingually, e.g. "1, male /पुरुष | 2, female/महिला"
— an English segment, a slash, then a Hindi transliteration. Only the English
segment is kept; the dashboard is English-language, and keeping the raw
bilingual string would silently break any downstream exact-match grouping
(sex distribution, status grouping, etc.) against plain English labels.
"""

ChoiceMap = dict[str, str]

_CHOICE_FIELD_TYPES = {"radio", "dropdown"}


def _primary_language_segment(label: str) -> str:
    """Keep only the text before the first '/' in a bilingual choice label."""
    return label.split("/", 1)[0].strip()


def parse_choice_string(raw: str | None) -> ChoiceMap:
    """Parse one field's `select_choices_or_calculations` string into code -> label."""
    if not raw:
        return {}
    choices: ChoiceMap = {}
    for part in raw.split("|"):
        part = part.strip()
        if not part or "," not in part:
            continue
        code, label = part.split(",", 1)
        choices[code.strip()] = _primary_language_segment(label)
    return choices


def build_choice_maps(metadata: list[dict]) -> dict[str, ChoiceMap]:
    """Build {field_name: {code: label}} for every radio/dropdown field in the
    REDCap Data Dictionary. Other field types (text, calc, notes, ...) are
    skipped — they are not coded and require no label resolution.
    """
    maps: dict[str, ChoiceMap] = {}
    for field in metadata:
        if field.get("field_type") not in _CHOICE_FIELD_TYPES:
            continue
        maps[field["field_name"]] = parse_choice_string(field.get("select_choices_or_calculations"))
    return maps
