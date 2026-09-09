from app.ingestion.live_field_map import DIETARY_EXPORT_FIELDS, LIVE_FIELDS

_EXPECTED_DIETARY_PORTION_FIELDS = (
    "die_grains_portion",
    "die_pulses_portion",
    "die_nuts_seeds_portion",
    "die_dairy_portion",
    "die_flesh_portion",
    "die_eggs_portion",
    "die_dgl_veg_portion",
    "die_vita_fv_portion",
    "die_other_veg_portion",
    "die_other_fruits_portion",
)

_EXPECTED_OTHER_FOOD_FIELDS = ("die_other_specify", "die_other_portion", "die_other_freq")


def test_dietary_export_fields_include_all_ten_portion_fields():
    for field in _EXPECTED_DIETARY_PORTION_FIELDS:
        assert field in DIETARY_EXPORT_FIELDS


def test_dietary_export_fields_include_other_food_specified_fields():
    for field in _EXPECTED_OTHER_FOOD_FIELDS:
        assert field in DIETARY_EXPORT_FIELDS


def test_live_fields_actually_requests_the_new_dietary_fields():
    # LIVE_FIELDS is the literal field list passed to REDCap's record export
    # (LiveRedCapRepository.fetch_records(fields=list(LIVE_FIELDS))) - a
    # field missing here is never fetched regardless of what REDCap holds.
    for field in _EXPECTED_DIETARY_PORTION_FIELDS + _EXPECTED_OTHER_FOOD_FIELDS:
        assert field in LIVE_FIELDS
