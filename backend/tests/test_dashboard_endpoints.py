from datetime import date

from fastapi.testclient import TestClient

from app.api.deps import get_live_dashboard_service
from app.main import app
from app.services.live_dashboard_service import LiveDashboardService
from tests.fixtures.live_redcap import FIXTURE_METADATA, FakeRedCapRepository, build_fixture_records

AS_OF = date(2026, 8, 25)


def _fake_service() -> LiveDashboardService:
    repo = FakeRedCapRepository(FIXTURE_METADATA, build_fixture_records(AS_OF))
    return LiveDashboardService(repo)


app.dependency_overrides[get_live_dashboard_service] = _fake_service
client = TestClient(app)


def test_overview_endpoint_returns_core_battery_progression():
    response = client.get("/api/v1/dashboard/overview")
    assert response.status_code == 200
    body = response.json()
    assert body["total_registered"] == 6
    assert body["core_assessment_count"] == 3
    assert body["ssrs_parent_count"] == 4  # independent of core_assessment_count — see fixture REC004
    assert body["ssrs_child_count"] == 2
    all_coverage_keys = {c["key"] for c in body["all_instrument_coverage"]}
    assert all_coverage_keys == {
        "registration",
        "ses",
        "dseq",
        "child_illness_history",
        "paq_a",
        "dietary_intake",
        "ssrs_parent",
        "ssrs_child",
        "ssrs_teacher",
    }
    assert body["ssrs_teacher_count"] == 1
    # All four assessment modules are field-mapped; nothing pending integration.
    assert body["modules_pending_integration"] == []
    assert body["chh_completion"]["instrument"] == "Child Illness History"
    assert body["dseq_completion"]["instrument"] == "DSEQ"


def test_overview_endpoint_accepts_refresh_query_param():
    response = client.get("/api/v1/dashboard/overview?refresh=true")
    assert response.status_code == 200
    body = response.json()
    assert body["total_registered"] == 6


def test_overview_endpoint_refresh_param_does_not_change_default_response_shape():
    default_response = client.get("/api/v1/dashboard/overview").json()
    refreshed_response = client.get("/api/v1/dashboard/overview?refresh=true").json()
    assert default_response == refreshed_response


def test_overview_endpoint_returns_registration_completion_and_coverage():
    response = client.get("/api/v1/dashboard/overview")
    body = response.json()
    assert body["registration_complete_count"] == 5
    coverage_keys = {c["key"] for c in body["instrument_coverage"]}
    assert coverage_keys == {"ses", "dseq", "child_illness_history", "paq_a", "dietary_intake", "ssrs_parent"}
    dietary = next(c for c in body["instrument_coverage"] if c["key"] == "dietary_intake")
    assert dietary["completed_count"] == 3


def test_registry_endpoint_supports_search_and_pagination():
    response = client.get("/api/v1/dashboard/registry", params={"search": "REC00", "limit": 2, "offset": 0})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 6
    assert len(body["children"]) == 2
    assert body["unavailable_fields"] == []


def test_demographics_endpoint_returns_distributions():
    response = client.get("/api/v1/dashboard/demographics")
    assert response.status_code == 200
    body = response.json()
    assert body["sex_distribution"]["male"] == 5
    assert body["ses_profile_count"] == 3


def test_health_endpoint_returns_real_named_conditions_and_completion():
    response = client.get("/api/v1/dashboard/health")
    assert response.status_code == 200
    body = response.json()
    assert body["instrument"] == "Child Illness History"
    assert body["completion"]["total_registered"] == 6
    assert body["completion"]["completed"] == 4
    conditions = {c["label"]: c for c in body["named_conditions"]}
    assert conditions["Asthma"]["yes_count"] == 1
    flags = {c["label"]: c for c in body["general_flags"]}
    assert flags["Currently ill"]["yes_count"] == 0


def test_physical_activity_endpoint_returns_real_score_summaries():
    response = client.get("/api/v1/dashboard/physical-activity")
    assert response.status_code == 200
    body = response.json()
    assert body["instrument"] == "PAQ-A"
    assert body["total_summary"]["valid_n"] == 1
    assert body["total_summary"]["missing_n"] == 5
    assert body["total_summary"]["mean"] == 3.2


def test_screen_time_endpoint_returns_real_distribution():
    response = client.get("/api/v1/dashboard/screen-time")
    assert response.status_code == 200
    body = response.json()
    assert body["instrument"] == "DSEQ"
    # Ordered by REDCap choice-code order (fixture defines codes 1, 2), not
    # by descending frequency — every defined category appears, zero-count included.
    dist_list = [(c["code"], c["count"]) for c in body["total_screen_time_distribution"]]
    assert dist_list == [("Less than 30 minutes", 0), ("30 minutes-1 hour", 1)]
    yes_no = {c["code"]: c["count"] for c in body["yes_no_items"]}
    assert yes_no["Household has screen-use rules (Q9)"] == 1


def test_dietary_intake_endpoint_returns_per_food_group_distribution():
    response = client.get("/api/v1/dashboard/dietary-intake")
    assert response.status_code == 200
    body = response.json()
    assert body["instrument"] == "Dietary Intake"
    assert body["completion"]["total_registered"] == 6
    labels = [item["field_label"] for item in body["items"]]
    assert "Grains / Roots / Tubers" in labels
    assert len(body["items"]) == 10


def test_neurodevelopment_endpoint_shows_teacher_with_no_acquired_data():
    response = client.get("/api/v1/dashboard/neurodevelopment")
    assert response.status_code == 200
    body = response.json()
    assert body["parent"]["children_with_any_data"] == 1
    assert body["parent"]["avg_frequency_summary"]["mean"] == 0.5
    assert body["child"]["children_with_any_data"] == 1
    assert body["teacher"]["children_with_any_data"] == 0
    assert body["teacher"]["avg_frequency_summary"]["valid_n"] == 0
    assert body["teacher"]["avg_frequency_summary"]["mean"] is None


def test_export_active_cases_endpoint_returns_xlsx_with_dated_filename():
    response = client.get("/api/v1/dashboard/export/active-cases")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert 'filename="ICMR_Active_Cases_' in response.headers["content-disposition"]
    assert response.headers["content-disposition"].endswith('.xlsx"')
    assert len(response.content) > 0


def test_export_active_cases_csv_endpoint_returns_csv_with_dated_filename():
    response = client.get("/api/v1/dashboard/export/active-cases.csv")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert 'filename="ICMR_Active_Cases_' in response.headers["content-disposition"]
    assert response.headers["content-disposition"].endswith('.csv"')

    body = response.content.decode("utf-8-sig")
    lines = body.strip().splitlines()
    header = lines[0].split(",")
    assert header[0] == "Child ID"
    # 6 registered/active fixture children -> 1 header + 6 data rows
    assert len(lines) == 7


def test_progress_endpoint_returns_four_stage_pipeline():
    response = client.get("/api/v1/dashboard/progress")
    assert response.status_code == 200
    body = response.json()
    stages = {s["key"]: s["count"] for s in body["stages"]}
    assert stages == {
        "registered": 6,
        "core_assessment_battery": 3,
        "ssrs_child": 2,
        "ssrs_teacher": 1,
    }
