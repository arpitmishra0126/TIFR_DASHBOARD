from app.ingestion.choice_maps import build_choice_maps, parse_choice_string


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
