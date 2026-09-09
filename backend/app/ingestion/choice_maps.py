"""Resolve REDCap radio/dropdown coded values to their label text.

REDCap's raw-format record export returns the stored code (e.g. "1") for
radio/dropdown fields, not the human label. The Data Dictionary (metadata)
export carries the code->label mapping per field in
`select_choices_or_calculations`, formatted as "code, label | code, label | ...".
Calc fields have no such mapping - their formula lives in the same column but
does not describe choice labels, so calc-derived values are exposed as raw
numbers, not invented text.

This study's forms label choices bilingually, e.g. "1, male /पुरुष | 2, female/महिला"
 - an English segment, a slash, then a Hindi transliteration. Only the English
segment is kept; the dashboard is English-language, and keeping the raw
bilingual string would silently break any downstream exact-match grouping
(sex distribution, status grouping, etc.) against plain English labels.

Some `calc` fields (e.g. the Udai Pareek / BG Prasad SES category fields)
have no `select_choices_or_calculations` choice list - REDCap's metadata API
never returns one for calc fields, only the formula - but DO carry their
named categories as documented text in `field_note` (confirmed live,
2026-09-03: "1=I Upper >43; 2=II Upper-middle 33-42; ..."). See
`parse_calc_category_note`/`build_calc_category_maps` below, which parse
that documented convention into the same {code: label} shape as a normal
choice map, so calc-derived category codes can be resolved exactly like any
other coded field, using only project-supplied text.
"""
import re

ChoiceMap = dict[str, str]

_CHOICE_FIELD_TYPES = {"radio", "dropdown"}

# Used to detect whether the text before a choice label's first "/" is an
# actual English segment (Latin script) versus ordinary punctuation inside
# a single-language label - see _primary_language_segment below.
_LATIN_LETTER_PATTERN = re.compile(r"[A-Za-z]")

# Matches one "<code>=<roman numeral> <Label> <range>" segment of a calc
# field's field_note, e.g. "2=II Upper-middle 33-42" -> code "2", label
# "Upper-middle". The label is whatever falls between the roman numeral and
# the first comparison operator or digit that starts the numeric range.
_CALC_CATEGORY_PATTERN = re.compile(
    r"(?P<code>\d+)\s*=\s*[IVXLCDM]+\s+(?P<label>[A-Za-z][A-Za-z\-]*(?:\s[A-Za-z][A-Za-z\-]*)*?)\s+(?:[<>]=?|\d)"
)


def _primary_language_segment(label: str) -> str:
    """Keep only the English segment of a bilingual "English/Hindi" choice
    label, split at the first '/'.

    A label with no Latin-script text before that first '/' has no English
    segment to extract at all - e.g. a purely Hindi label such as DSEQ/
    Dietary Intake's frequency scale option "शायद ही कभी/कभी नहीं" ("rarely/
    never"), where the '/' is ordinary punctuation inside one Hindi phrase,
    not a language separator. Splitting on it there would silently drop the
    second half ("/कभी नहीं") for no reason, since there is no English text
    to isolate - so such a label is returned whole instead.

    This does not change behavior for any field that genuinely has an
    English segment before the slash (including the separately-documented
    quirk where a mid-word slash inside that English segment itself, e.g.
    "1-2 days/week / <hindi>", still truncates at the first slash - that
    remains unchanged/out of scope here).
    """
    if "/" not in label:
        return label.strip()
    head, _, _ = label.partition("/")
    if not _LATIN_LETTER_PATTERN.search(head):
        return label.strip()
    return head.strip()


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
    skipped - they are not coded and require no label resolution.
    """
    maps: dict[str, ChoiceMap] = {}
    for field in metadata:
        if field.get("field_type") not in _CHOICE_FIELD_TYPES:
            continue
        maps[field["field_name"]] = parse_choice_string(field.get("select_choices_or_calculations"))
    return maps


def parse_calc_category_note(field_note: str | None) -> ChoiceMap:
    """Parse a calc field's `field_note` for the documented
    "<code>=<roman numeral> <Label> <range>" convention into {code: label}.
    Only fields whose field_note actually matches this convention yield any
    entries - anything else returns an empty map rather than a guessed label.
    """
    if not field_note:
        return {}
    labels: ChoiceMap = {}
    for segment in field_note.split(";"):
        match = _CALC_CATEGORY_PATTERN.search(segment.strip())
        if match:
            labels[match.group("code")] = match.group("label").strip()
    return labels


def build_calc_category_maps(metadata: list[dict]) -> dict[str, ChoiceMap]:
    """Build {field_name: {code: label}} for calc fields whose field_note
    documents named numeric categories (confirmed live for the Udai Pareek
    and BG Prasad SES category fields). Calc fields without a matching
    field_note are omitted entirely, never assigned an invented label.
    """
    maps: dict[str, ChoiceMap] = {}
    for field in metadata:
        if field.get("field_type") != "calc":
            continue
        parsed = parse_calc_category_note(field.get("field_note"))
        if parsed:
            maps[field["field_name"]] = parsed
    return maps
