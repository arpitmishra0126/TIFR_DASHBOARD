"""Validated numeric reference tables - IAP 2015 revised growth charts.

Source (full attribution, as printed on the study-supplied chart images and
confirmed by direct extraction of the source paper):

    Khadilkar V, Yadav S, Agrawal KK, Tamboli S, Banerjee M, Cherian A,
    Goyal JP, Khadilkar A, Kumaravel V, Mohan V, Narayanappa D, Ray I,
    Yewale V; Indian Academy of Pediatrics Growth Charts Committee.
    Revised IAP growth charts for height, weight and body mass index for
    5- to 18-year-old Indian children.
    Indian Pediatrics. 2015 Jan 15;52(1):47-55. PMID: 25638185.
    https://indianpediatrics.net/jan2015/47.pdf

Method used in the source paper: Cole's LMS method, applied to pooled
cross-sectional data on 33,148 apparently healthy Indian children
(18,170 boys, 14,978 girls) aged 5-18 years from 14 Indian cities / 9
study groups. 3rd/10th/25th/50th/75th/90th/97th percentiles for height and
weight; 3rd/5th/10th/25th/50th/23-adult-equivalent/27-adult-equivalent
percentiles for BMI (the 23/27 adult-equivalent cut-offs are the paper's
own stated overweight/obesity thresholds, "as per recent recommendations
for Asian Indian overweight and obesity cut-offs").

Data provenance - these are NOT estimated from the chart images. They were
extracted directly and programmatically from the source PDF's own published
Tables II-VII (one data row per whole year of age, 5-18), cross-verified
against the paper's own printed row values before being committed here -
see the 2026-10-22 CLAUDE.md entry for the extraction/verification method.
Only the whole-year-age rows are kept (the source table is published at
0.5-year steps; this cohort's age-at-assessment is already computed in
whole years elsewhere in this app, so no interpolation is introduced here).

Units: height in cm, weight in kg, BMI in kg/m^2. Age in whole years.
Sex coverage: both boys and girls (separate tables, never cross-applied).
Age coverage: 5-18 years inclusive. Do not use outside this range - the
source paper itself does not cover ages 0-5 (see the separate, unrelated
WHO Child Growth Standards for that range, intentionally NOT implemented in
this codebase yet - see ANTHROPOMETRY_GROWTH_SCREENING section of
CLAUDE.md for why).

"3rd percentile" is used here as the low-end screening cut-off for both
height-for-age ("short stature") and weight-for-age ("low weight-for-age"),
matching the paper's own stated convention for its BMI thinness cut-off
("The 3rd percentile was used to define thinness") applied consistently to
its other two percentile-based measures - not an invented threshold.
"""

IAP_AGE_MIN_YEARS = 5
IAP_AGE_MAX_YEARS = 18

# Table II (boys) / Table IV (girls) - Height (cm) centiles + SD, whole-year rows.
IAP_HEIGHT_CM_BOYS: dict[int, dict[str, float]] = {
    5: {"p3": 99.0, "p10": 102.3, "p25": 105.6, "p50": 108.9, "p75": 112.4, "p90": 115.9, "p97": 119.4, "sd": 5.7},
    6: {"p3": 104.2, "p10": 107.7, "p25": 111.2, "p50": 114.8, "p75": 118.5, "p90": 122.2, "p97": 126.0, "sd": 5.6},
    7: {"p3": 109.3, "p10": 113.0, "p25": 116.8, "p50": 120.7, "p75": 124.6, "p90": 128.6, "p97": 132.6, "sd": 5.9},
    8: {"p3": 114.3, "p10": 118.2, "p25": 122.3, "p50": 126.4, "p75": 130.5, "p90": 134.8, "p97": 139.1, "sd": 6.3},
    9: {"p3": 119.0, "p10": 123.2, "p25": 127.5, "p50": 131.8, "p75": 136.3, "p90": 140.7, "p97": 145.3, "sd": 6.4},
    10: {"p3": 123.6, "p10": 128.1, "p25": 132.6, "p50": 137.2, "p75": 141.9, "p90": 146.6, "p97": 151.4, "sd": 6.8},
    11: {"p3": 128.2, "p10": 133.0, "p25": 137.8, "p50": 142.7, "p75": 147.6, "p90": 152.5, "p97": 157.5, "sd": 7.6},
    12: {"p3": 133.2, "p10": 138.3, "p25": 143.3, "p50": 148.4, "p75": 153.5, "p90": 158.6, "p97": 163.7, "sd": 8.1},
    13: {"p3": 138.3, "p10": 143.7, "p25": 149.0, "p50": 154.3, "p75": 159.5, "p90": 164.7, "p97": 169.9, "sd": 9.0},
    14: {"p3": 143.4, "p10": 149.0, "p25": 154.5, "p50": 159.9, "p75": 165.1, "p90": 170.3, "p97": 175.4, "sd": 9.0},
    15: {"p3": 148.0, "p10": 153.7, "p25": 159.2, "p50": 164.5, "p75": 169.7, "p90": 174.8, "p97": 179.7, "sd": 7.9},
    16: {"p3": 151.8, "p10": 157.4, "p25": 162.9, "p50": 168.1, "p75": 173.1, "p90": 178.0, "p97": 182.7, "sd": 7.2},
    17: {"p3": 155.0, "p10": 160.6, "p25": 165.9, "p50": 171.0, "p75": 175.8, "p90": 180.4, "p97": 184.8, "sd": 6.9},
    18: {"p3": 158.1, "p10": 163.6, "p25": 168.7, "p50": 173.6, "p75": 178.2, "p90": 182.5, "p97": 186.7, "sd": 6.9},
}

IAP_HEIGHT_CM_GIRLS: dict[int, dict[str, float]] = {
    5: {"p3": 97.2, "p10": 100.5, "p25": 103.9, "p50": 107.5, "p75": 111.3, "p90": 115.2, "p97": 119.3, "sd": 5.4},
    6: {"p3": 102.3, "p10": 106.0, "p25": 109.7, "p50": 113.5, "p75": 117.4, "p90": 121.5, "p97": 125.6, "sd": 5.8},
    7: {"p3": 107.4, "p10": 111.4, "p25": 115.4, "p50": 119.4, "p75": 123.5, "p90": 127.7, "p97": 131.9, "sd": 6.1},
    8: {"p3": 112.6, "p10": 116.8, "p25": 121.1, "p50": 125.4, "p75": 129.6, "p90": 133.9, "p97": 138.1, "sd": 6.2},
    9: {"p3": 117.8, "p10": 122.4, "p25": 126.9, "p50": 131.4, "p75": 135.8, "p90": 140.2, "p97": 144.5, "sd": 6.9},
    10: {"p3": 123.3, "p10": 128.1, "p25": 132.8, "p50": 137.4, "p75": 142.0, "p90": 146.4, "p97": 150.8, "sd": 7.8},
    11: {"p3": 128.8, "p10": 133.7, "p25": 138.6, "p50": 143.3, "p75": 147.9, "p90": 152.4, "p97": 156.8, "sd": 7.9},
    12: {"p3": 134.0, "p10": 138.9, "p25": 143.7, "p50": 148.4, "p75": 153.0, "p90": 157.5, "p97": 162.0, "sd": 7.0},
    13: {"p3": 138.2, "p10": 142.9, "p25": 147.6, "p50": 152.2, "p75": 156.8, "p90": 161.3, "p97": 165.9, "sd": 6.9},
    14: {"p3": 141.3, "p10": 145.8, "p25": 150.2, "p50": 154.7, "p75": 159.2, "p90": 163.7, "p97": 168.2, "sd": 6.6},
    15: {"p3": 143.3, "p10": 147.5, "p25": 151.8, "p50": 156.1, "p75": 160.5, "p90": 165.0, "p97": 169.5, "sd": 6.6},
    16: {"p3": 144.7, "p10": 148.6, "p25": 152.7, "p50": 156.9, "p75": 161.2, "p90": 165.6, "p97": 170.1, "sd": 6.1},
    17: {"p3": 145.7, "p10": 149.5, "p25": 153.4, "p50": 157.4, "p75": 161.6, "p90": 165.9, "p97": 170.4, "sd": 6.5},
    18: {"p3": 146.6, "p10": 150.2, "p25": 153.9, "p50": 157.8, "p75": 161.9, "p90": 166.1, "p97": 170.6, "sd": 6.6},
}

# Table III (boys) / Table V (girls) - Weight (kg) centiles + SD, whole-year rows.
IAP_WEIGHT_KG_BOYS: dict[int, dict[str, float]] = {
    5: {"p3": 13.2, "p10": 14.3, "p25": 15.6, "p50": 17.1, "p75": 19.0, "p90": 21.3, "p97": 24.2, "sd": 3.2},
    6: {"p3": 14.5, "p10": 15.8, "p25": 17.4, "p50": 19.3, "p75": 21.7, "p90": 24.6, "p97": 28.3, "sd": 3.6},
    7: {"p3": 16.0, "p10": 17.6, "p25": 19.6, "p50": 21.9, "p75": 24.9, "p90": 28.6, "p97": 33.4, "sd": 4.2},
    8: {"p3": 17.5, "p10": 19.5, "p25": 21.9, "p50": 24.8, "p75": 28.5, "p90": 33.2, "p97": 39.4, "sd": 5.7},
    9: {"p3": 19.1, "p10": 21.5, "p25": 24.3, "p50": 27.9, "p75": 32.3, "p90": 38.0, "p97": 45.5, "sd": 6.3},
    10: {"p3": 20.7, "p10": 23.5, "p25": 26.9, "p50": 31.1, "p75": 36.3, "p90": 43.0, "p97": 51.8, "sd": 7.9},
    11: {"p3": 22.6, "p10": 25.9, "p25": 29.8, "p50": 34.7, "p75": 40.9, "p90": 48.7, "p97": 58.7, "sd": 8.9},
    12: {"p3": 24.9, "p10": 28.7, "p25": 33.3, "p50": 39.0, "p75": 46.0, "p90": 54.8, "p97": 66.1, "sd": 10.0},
    13: {"p3": 27.5, "p10": 31.8, "p25": 37.0, "p50": 43.3, "p75": 51.1, "p90": 60.7, "p97": 72.6, "sd": 11.3},
    14: {"p3": 30.7, "p10": 35.5, "p25": 41.3, "p50": 48.2, "p75": 56.4, "p90": 66.3, "p97": 78.3, "sd": 12.1},
    15: {"p3": 34.5, "p10": 39.8, "p25": 45.9, "p50": 53.1, "p75": 61.6, "p90": 71.5, "p97": 83.1, "sd": 12.1},
    16: {"p3": 37.5, "p10": 43.1, "p25": 49.5, "p50": 56.8, "p75": 65.2, "p90": 74.8, "p97": 85.8, "sd": 12.2},
    17: {"p3": 39.8, "p10": 45.6, "p25": 52.1, "p50": 59.5, "p75": 67.8, "p90": 77.1, "p97": 87.5, "sd": 12.3},
    18: {"p3": 41.8, "p10": 47.7, "p25": 54.3, "p50": 61.6, "p75": 69.7, "p90": 78.6, "p97": 88.4, "sd": 11.3},
}

IAP_WEIGHT_KG_GIRLS: dict[int, dict[str, float]] = {
    5: {"p3": 12.3, "p10": 13.4, "p25": 14.8, "p50": 16.4, "p75": 18.5, "p90": 21.3, "p97": 25.0, "sd": 2.5},
    6: {"p3": 13.7, "p10": 15.1, "p25": 16.7, "p50": 18.7, "p75": 21.3, "p90": 24.6, "p97": 29.1, "sd": 3.4},
    7: {"p3": 15.1, "p10": 16.8, "p25": 18.7, "p50": 21.2, "p75": 24.2, "p90": 28.2, "p97": 33.4, "sd": 4.4},
    8: {"p3": 16.7, "p10": 18.7, "p25": 21.1, "p50": 24.0, "p75": 27.6, "p90": 32.2, "p97": 38.1, "sd": 5.2},
    9: {"p3": 18.5, "p10": 20.9, "p25": 23.7, "p50": 27.2, "p75": 31.5, "p90": 36.7, "p97": 43.4, "sd": 6.4},
    10: {"p3": 20.7, "p10": 23.5, "p25": 26.9, "p50": 31.0, "p75": 36.0, "p90": 42.0, "p97": 49.4, "sd": 7.7},
    11: {"p3": 23.3, "p10": 26.7, "p25": 30.7, "p50": 35.4, "p75": 41.0, "p90": 47.7, "p97": 55.9, "sd": 8.5},
    12: {"p3": 26.2, "p10": 30.0, "p25": 34.5, "p50": 39.8, "p75": 46.0, "p90": 53.4, "p97": 62.1, "sd": 9.0},
    13: {"p3": 28.9, "p10": 33.1, "p25": 37.9, "p50": 43.6, "p75": 50.2, "p90": 57.9, "p97": 67.1, "sd": 9.4},
    14: {"p3": 31.3, "p10": 35.6, "p25": 40.6, "p50": 46.4, "p75": 53.2, "p90": 61.1, "p97": 70.4, "sd": 9.6},
    15: {"p3": 33.1, "p10": 37.5, "p25": 42.5, "p50": 48.4, "p75": 55.1, "p90": 62.9, "p97": 72.1, "sd": 9.6},
    16: {"p3": 34.7, "p10": 39.1, "p25": 44.0, "p50": 49.7, "p75": 56.3, "p90": 64.0, "p97": 72.8, "sd": 8.7},
    17: {"p3": 36.2, "p10": 40.5, "p25": 45.3, "p50": 50.9, "p75": 57.3, "p90": 64.7, "p97": 73.3, "sd": 8.8},
    18: {"p3": 37.6, "p10": 41.8, "p25": 46.6, "p50": 52.0, "p75": 58.2, "p90": 65.3, "p97": 73.5, "sd": 10.2},
}

# Table VI (boys) / Table VII (girls) - BMI (kg/m^2) centiles + SD, whole-year rows.
# eq23/eq27 = the paper's own "23 adult-equivalent" (overweight) and "27
# adult-equivalent" (obesity) cut-off values at that age/sex - these ARE the
# literal overweight/obesity thresholds requested, not a derived percentile.
IAP_BMI_BOYS: dict[int, dict[str, float]] = {
    5: {"p3": 12.1, "p5": 12.4, "p10": 12.8, "p25": 13.6, "p50": 14.7, "eq23": 15.7, "eq27": 17.5, "sd": 1.6},
    6: {"p3": 12.2, "p5": 12.5, "p10": 12.9, "p25": 13.7, "p50": 14.9, "eq23": 16.0, "eq27": 17.8, "sd": 1.8},
    7: {"p3": 12.3, "p5": 12.6, "p10": 13.1, "p25": 13.9, "p50": 15.1, "eq23": 16.3, "eq27": 18.2, "sd": 1.9},
    8: {"p3": 12.5, "p5": 12.8, "p10": 13.3, "p25": 14.2, "p50": 15.5, "eq23": 16.7, "eq27": 18.8, "sd": 2.5},
    9: {"p3": 12.7, "p5": 13.0, "p10": 13.5, "p25": 14.5, "p50": 15.9, "eq23": 17.3, "eq27": 19.6, "sd": 2.6},
    10: {"p3": 12.9, "p5": 13.2, "p10": 13.8, "p25": 14.9, "p50": 16.4, "eq23": 18.0, "eq27": 20.5, "sd": 3.1},
    11: {"p3": 13.1, "p5": 13.5, "p10": 14.1, "p25": 15.4, "p50": 17.0, "eq23": 18.7, "eq27": 21.5, "sd": 3.2},
    12: {"p3": 13.3, "p5": 13.8, "p10": 14.5, "p25": 15.8, "p50": 17.7, "eq23": 19.5, "eq27": 22.6, "sd": 3.4},
    13: {"p3": 13.6, "p5": 14.0, "p10": 14.8, "p25": 16.3, "p50": 18.2, "eq23": 20.2, "eq27": 23.4, "sd": 3.5},
    14: {"p3": 13.8, "p5": 14.3, "p10": 15.1, "p25": 16.7, "p50": 18.7, "eq23": 20.8, "eq27": 24.2, "sd": 3.7},
    15: {"p3": 14.2, "p5": 14.7, "p10": 15.5, "p25": 17.2, "p50": 19.3, "eq23": 21.4, "eq27": 24.9, "sd": 3.7},
    16: {"p3": 14.6, "p5": 15.1, "p10": 16.0, "p25": 17.7, "p50": 19.9, "eq23": 22.0, "eq27": 25.5, "sd": 3.7},
    17: {"p3": 15.1, "p5": 15.6, "p10": 16.6, "p25": 18.3, "p50": 20.5, "eq23": 22.6, "eq27": 26.0, "sd": 3.8},
    18: {"p3": 15.6, "p5": 16.2, "p10": 17.1, "p25": 18.9, "p50": 21.1, "eq23": 23.2, "eq27": 26.6, "sd": 3.2},
}

IAP_BMI_GIRLS: dict[int, dict[str, float]] = {
    5: {"p3": 11.9, "p5": 12.1, "p10": 12.5, "p25": 13.3, "p50": 14.3, "eq23": 15.5, "eq27": 18.0, "sd": 1.4},
    6: {"p3": 12.0, "p5": 12.2, "p10": 12.7, "p25": 13.5, "p50": 14.5, "eq23": 15.9, "eq27": 18.6, "sd": 1.7},
    7: {"p3": 12.1, "p5": 12.4, "p10": 12.8, "p25": 13.7, "p50": 14.9, "eq23": 16.4, "eq27": 19.3, "sd": 2.1},
    8: {"p3": 12.3, "p5": 12.6, "p10": 13.1, "p25": 14.0, "p50": 15.3, "eq23": 16.9, "eq27": 20.1, "sd": 2.3},
    9: {"p3": 12.4, "p5": 12.8, "p10": 13.3, "p25": 14.4, "p50": 15.8, "eq23": 17.6, "eq27": 21.0, "sd": 2.7},
    10: {"p3": 12.7, "p5": 13.1, "p10": 13.7, "p25": 14.9, "p50": 16.5, "eq23": 18.4, "eq27": 21.9, "sd": 2.9},
    11: {"p3": 13.0, "p5": 13.4, "p10": 14.1, "p25": 15.5, "p50": 17.2, "eq23": 19.3, "eq27": 23.0, "sd": 3.1},
    12: {"p3": 13.4, "p5": 13.9, "p10": 14.7, "p25": 16.1, "p50": 18.0, "eq23": 20.2, "eq27": 24.1, "sd": 3.2},
    13: {"p3": 13.9, "p5": 14.4, "p10": 15.2, "p25": 16.8, "p50": 18.8, "eq23": 21.1, "eq27": 25.2, "sd": 3.2},
    14: {"p3": 14.3, "p5": 14.9, "p10": 15.7, "p25": 17.3, "p50": 19.4, "eq23": 21.8, "eq27": 25.9, "sd": 3.4},
    15: {"p3": 14.7, "p5": 15.2, "p10": 16.1, "p25": 17.8, "p50": 19.9, "eq23": 22.3, "eq27": 26.3, "sd": 3.4},
    16: {"p3": 15.0, "p5": 15.6, "p10": 16.5, "p25": 18.2, "p50": 20.3, "eq23": 22.6, "eq27": 26.5, "sd": 3.1},
    17: {"p3": 15.4, "p5": 16.0, "p10": 16.9, "p25": 18.6, "p50": 20.6, "eq23": 22.9, "eq27": 26.7, "sd": 3.0},
    18: {"p3": 15.7, "p5": 16.3, "p10": 17.3, "p25": 18.9, "p50": 21.0, "eq23": 23.2, "eq27": 26.8, "sd": 3.6},
}

IAP_CITATION = (
    "Khadilkar et al., Indian Pediatrics 2015;52(1):47-55 "
    "(IAP Growth Charts Committee, 5-18y Indian children)"
)


def iap_height_eligibility_reason(height_cm: float | None, age_years: int | None, sex: str | None) -> str | None:
    """None means eligible for IAP height-for-age screening; otherwise the reason it isn't."""
    if height_cm is None:
        return "Missing height"
    if sex not in ("Male", "Female"):
        return "Missing sex"
    if age_years is None:
        return "Missing age at assessment"
    if not (IAP_AGE_MIN_YEARS <= age_years <= IAP_AGE_MAX_YEARS):
        return "Age outside IAP 5-18y range"
    return None


def iap_weight_eligibility_reason(weight_kg: float | None, age_years: int | None, sex: str | None) -> str | None:
    if weight_kg is None:
        return "Missing weight"
    if sex not in ("Male", "Female"):
        return "Missing sex"
    if age_years is None:
        return "Missing age at assessment"
    if not (IAP_AGE_MIN_YEARS <= age_years <= IAP_AGE_MAX_YEARS):
        return "Age outside IAP 5-18y range"
    return None


def iap_bmi_eligibility_reason(
    height_cm: float | None, weight_kg: float | None, age_years: int | None, sex: str | None,
) -> str | None:
    if height_cm is None:
        return "Missing height"
    if weight_kg is None:
        return "Missing weight"
    if sex not in ("Male", "Female"):
        return "Missing sex"
    if age_years is None:
        return "Missing age at assessment"
    if not (IAP_AGE_MIN_YEARS <= age_years <= IAP_AGE_MAX_YEARS):
        return "Age outside IAP 5-18y range"
    return None


def classify_iap_height(height_cm: float, age_years: int, sex: str) -> str:
    """Caller must have already confirmed eligibility via iap_height_eligibility_reason()."""
    table = IAP_HEIGHT_CM_BOYS if sex == "Male" else IAP_HEIGHT_CM_GIRLS
    row = table[age_years]
    return "Short stature" if height_cm < row["p3"] else "Normal"


def classify_iap_weight(weight_kg: float, age_years: int, sex: str) -> str:
    table = IAP_WEIGHT_KG_BOYS if sex == "Male" else IAP_WEIGHT_KG_GIRLS
    row = table[age_years]
    return "Low weight-for-age" if weight_kg < row["p3"] else "Normal"


def classify_iap_bmi(bmi: float, age_years: int, sex: str) -> str:
    table = IAP_BMI_BOYS if sex == "Male" else IAP_BMI_GIRLS
    row = table[age_years]
    if bmi < row["p3"]:
        return "Thinness"
    if bmi >= row["eq27"]:
        return "Obesity"
    if bmi >= row["eq23"]:
        return "Overweight"
    return "Normal"
