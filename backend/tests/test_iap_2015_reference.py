"""Tests for the IAP 2015 growth-reference tables and classification
helpers - locks in known reference points and boundary conditions against
the validated numeric tables extracted from the source paper (Khadilkar
et al., Indian Pediatrics 2015;52:47-55), per the "test known reference
points and boundary conditions" requirement.
"""
from app.services import iap_2015_reference as iap


def test_height_table_known_points_match_published_values():
    # Table II (boys), age 9 row, as printed in the source paper.
    assert iap.IAP_HEIGHT_CM_BOYS[9]["p3"] == 119.0
    assert iap.IAP_HEIGHT_CM_BOYS[9]["p50"] == 131.8
    assert iap.IAP_HEIGHT_CM_BOYS[9]["p97"] == 145.3
    # Table IV (girls), age 9 row.
    assert iap.IAP_HEIGHT_CM_GIRLS[9]["p3"] == 117.8
    assert iap.IAP_HEIGHT_CM_GIRLS[9]["p50"] == 131.4


def test_weight_table_known_points_match_published_values():
    assert iap.IAP_WEIGHT_KG_BOYS[10]["p3"] == 20.7
    assert iap.IAP_WEIGHT_KG_BOYS[10]["p50"] == 31.1
    assert iap.IAP_WEIGHT_KG_GIRLS[10]["p3"] == 20.7
    assert iap.IAP_WEIGHT_KG_GIRLS[10]["p50"] == 31.0


def test_bmi_table_known_points_match_published_values():
    row = iap.IAP_BMI_BOYS[10]
    assert row["p3"] == 12.9
    assert row["eq23"] == 18.0
    assert row["eq27"] == 20.5
    row_g = iap.IAP_BMI_GIRLS[10]
    assert row_g["eq23"] == 18.4
    assert row_g["eq27"] == 21.9


def test_all_six_tables_cover_ages_5_through_18():
    for table in (
        iap.IAP_HEIGHT_CM_BOYS,
        iap.IAP_HEIGHT_CM_GIRLS,
        iap.IAP_WEIGHT_KG_BOYS,
        iap.IAP_WEIGHT_KG_GIRLS,
        iap.IAP_BMI_BOYS,
        iap.IAP_BMI_GIRLS,
    ):
        assert set(table.keys()) == set(range(5, 19))


def test_classify_iap_height_boundary_at_p3():
    # Boy, age 9, p3 = 119.0 - exactly at p3 is NOT flagged (only strictly below is).
    assert iap.classify_iap_height(118.9, 9, "Male") == "Short stature"
    assert iap.classify_iap_height(119.0, 9, "Male") == "Normal"
    assert iap.classify_iap_height(150.0, 9, "Male") == "Normal"


def test_classify_iap_weight_boundary_at_p3():
    assert iap.classify_iap_weight(19.0, 9, "Male") == "Low weight-for-age"
    assert iap.classify_iap_weight(19.1, 9, "Male") == "Normal"


def test_classify_iap_bmi_four_bands_and_boundaries():
    # Boy, age 10: p3=12.9, eq23=18.0, eq27=20.5
    assert iap.classify_iap_bmi(12.8, 10, "Male") == "Thinness"
    assert iap.classify_iap_bmi(12.9, 10, "Male") == "Normal"  # exactly at p3, not thin
    assert iap.classify_iap_bmi(17.9, 10, "Male") == "Normal"
    assert iap.classify_iap_bmi(18.0, 10, "Male") == "Overweight"  # exactly at eq23 IS flagged
    assert iap.classify_iap_bmi(20.4, 10, "Male") == "Overweight"
    assert iap.classify_iap_bmi(20.5, 10, "Male") == "Obesity"  # exactly at eq27 IS flagged
    assert iap.classify_iap_bmi(25.0, 10, "Male") == "Obesity"


def test_height_eligibility_reason_flags_each_missing_input():
    assert iap.iap_height_eligibility_reason(None, 9, "Male") == "Missing height"
    assert iap.iap_height_eligibility_reason(130.0, 9, None) == "Missing sex"
    assert iap.iap_height_eligibility_reason(130.0, None, "Male") == "Missing age at assessment"
    assert iap.iap_height_eligibility_reason(130.0, 4, "Male") == "Age outside IAP 5-18y range"
    assert iap.iap_height_eligibility_reason(130.0, 19, "Male") == "Age outside IAP 5-18y range"
    assert iap.iap_height_eligibility_reason(130.0, 9, "Male") is None


def test_weight_eligibility_reason_flags_each_missing_input():
    assert iap.iap_weight_eligibility_reason(None, 9, "Male") == "Missing weight"
    assert iap.iap_weight_eligibility_reason(25.0, 9, "Male") is None


def test_bmi_eligibility_reason_checks_both_height_and_weight():
    assert iap.iap_bmi_eligibility_reason(None, 25.0, 9, "Male") == "Missing height"
    assert iap.iap_bmi_eligibility_reason(130.0, None, 9, "Male") == "Missing weight"
    assert iap.iap_bmi_eligibility_reason(130.0, 25.0, 9, "Male") is None


def test_age_boundary_inclusive_at_5_and_18():
    assert iap.iap_height_eligibility_reason(100.0, 5, "Male") is None
    assert iap.iap_height_eligibility_reason(160.0, 18, "Male") is None
