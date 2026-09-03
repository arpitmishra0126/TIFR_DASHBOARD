from app.ingestion.choice_maps import build_calc_category_maps, build_choice_maps, parse_calc_category_note, parse_choice_string


def test_parse_choice_string_basic():
    assert parse_choice_string("1, Male | 2, Female") == {"1": "Male", "2": "Female"}


def test_parse_choice_string_blank():
    assert parse_choice_string(None) == {}
    assert parse_choice_string("") == {}


def test_parse_choice_string_ignores_malformed_segments():
    assert parse_choice_string("1, Male | garbage | 2, Female") == {"1": "Male", "2": "Female"}


def test_parse_choice_string_strips_bilingual_transliteration():
    # This study's live forms label choices as "English /Hindi" — only the
    # English segment should survive, so downstream exact-match grouping
    # (e.g. sex distribution counts) isn't silently broken by the raw label.
    assert parse_choice_string("1, male /पुरुष | 2, female/महिला") == {
        "1": "male",
        "2": "female",
    }
    assert parse_choice_string("1, Live / जीवित | 0, Dead / मृत") == {
        "1": "Live",
        "0": "Dead",
    }


def test_build_choice_maps_skips_non_choice_fields():
    metadata = [
        {"field_name": "gender", "field_type": "radio", "select_choices_or_calculations": "1, Male | 2, Female"},
        {"field_name": "dob", "field_type": "text"},
        {"field_name": "score", "field_type": "calc", "select_choices_or_calculations": "[a]+[b]"},
    ]
    maps = build_choice_maps(metadata)
    assert maps == {"gender": {"1": "Male", "2": "Female"}}


def test_parse_calc_category_note_extracts_labels_from_live_convention():
    # Confirmed live 2026-09-03 field_note text for scr_pareek_category.
    note = "1=I Upper >43; 2=II Upper-middle 33-42; 3=III Middle 24-32; 4=IV Lower-middle 13-23; 5=V Lower <13"
    assert parse_calc_category_note(note) == {
        "1": "Upper",
        "2": "Upper-middle",
        "3": "Middle",
        "4": "Lower-middle",
        "5": "Lower",
    }


def test_parse_calc_category_note_blank_or_unrecognized_yields_empty():
    assert parse_calc_category_note(None) == {}
    assert parse_calc_category_note("") == {}
    assert parse_calc_category_note("just some unrelated free text") == {}


def test_build_calc_category_maps_only_covers_calc_fields_with_parseable_notes():
    metadata = [
        {
            "field_name": "scr_pareek_category",
            "field_type": "calc",
            "field_note": "1=I Upper >43; 2=II Upper-middle 33-42; 5=V Lower <13",
        },
        {"field_name": "some_other_calc", "field_type": "calc", "field_note": "no structured categories here"},
        {"field_name": "gender", "field_type": "radio", "select_choices_or_calculations": "1, Male | 2, Female"},
    ]
    maps = build_calc_category_maps(metadata)
    assert maps == {"scr_pareek_category": {"1": "Upper", "2": "Upper-middle", "5": "Lower"}}
