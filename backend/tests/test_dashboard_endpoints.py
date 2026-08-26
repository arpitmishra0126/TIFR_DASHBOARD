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
    assert body["ssrs_child_count"] == 2
    assert body["ssrs_teacher_count"] == 1
    assert "physical_activity" in body["modules_pending_integration"]


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


def test_health_endpoint_reports_instrument_exists_but_unmapped():
    response = client.get("/api/v1/dashboard/health")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert "Child Illness History" in body["reason"]


def test_physical_activity_endpoint_reports_instrument_exists_but_unmapped():
    response = client.get("/api/v1/dashboard/physical-activity")
    body = response.json()
    assert body["available"] is False
    assert "PAQ-A" in body["reason"]


def test_screen_time_endpoint_reports_instrument_exists_but_unmapped():
    response = client.get("/api/v1/dashboard/screen-time")
    body = response.json()
    assert body["available"] is False
    assert "DSEQ" in body["reason"]


def test_neurodevelopment_endpoint_reports_instrument_exists_but_unmapped():
    response = client.get("/api/v1/dashboard/neurodevelopment")
    body = response.json()
    assert body["available"] is False
    assert "SSRS Teacher" in body["reason"]


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
