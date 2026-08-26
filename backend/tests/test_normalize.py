from datetime import date

from app.ingestion.normalize import (
    capitalize_label,
    compute_age_years,
    parse_complete_flag,
    parse_date,
    parse_float,
    parse_int,
    parse_yes_no,
)


def test_parse_yes_no_variants():
    assert parse_yes_no("Yes") is True
    assert parse_yes_no("no") is False
    assert parse_yes_no("") is None
    assert parse_yes_no(None) is None
    assert parse_yes_no("maybe") is None


def test_parse_complete_flag():
    assert parse_complete_flag("Complete") is True
    assert parse_complete_flag("Incomplete") is False
    assert parse_complete_flag(None) is False
    assert parse_complete_flag("") is False


def test_parse_complete_flag_handles_live_redcap_numeric_codes():
    # REDCap raw-format export returns '0'=Incomplete, '1'=Unverified, '2'=Complete
    assert parse_complete_flag("2") is True
    assert parse_complete_flag("0") is False
    assert parse_complete_flag("1") is False


def test_parse_float_variants():
    assert parse_float("3000") == 3000.0
    assert parse_float("3000.5") == 3000.5
    assert parse_float("") is None
    assert parse_float(None) is None
    assert parse_float("not-a-number") is None


def test_parse_int_variants():
    assert parse_int("5") == 5
    assert parse_int("5.0") == 5
    assert parse_int("") is None
    assert parse_int(None) is None
    assert parse_int("abc") is None


def test_parse_date_valid_and_invalid():
    assert parse_date("2020-05-01") == date(2020, 5, 1)
    assert parse_date("not-a-date") is None
    assert parse_date(None) is None


def test_compute_age_years():
    assert compute_age_years(date(2015, 6, 15), as_of=date(2026, 6, 14)) == 10
    assert compute_age_years(date(2015, 6, 15), as_of=date(2026, 6, 15)) == 11
    assert compute_age_years(None) is None


def test_capitalize_label_variants():
    assert capitalize_label("male") == "Male"
    assert capitalize_label("FEMALE") == "Female"
    assert capitalize_label("  male ") == "Male"
    assert capitalize_label("") is None
    assert capitalize_label(None) is None
