"""V1 dashboard API — the only interface the frontend talks to.

Every endpoint here reads live from REDCap (via the cached LiveRedCapRepository)
and normalizes in memory. There is no database. The REDCap token never leaves
the backend process.
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.api.deps import get_live_dashboard_service
from app.schemas.dashboard import (
    DemographicsResponse,
    HealthScreeningResponse,
    NeurodevelopmentResponse,
    OverviewResponse,
    PhysicalActivityResponse,
    ProgressResponse,
    RegistryResponse,
    ScreenTimeResponse,
)
from app.services.export_service import export_filename
from app.services.live_dashboard_service import LiveDashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


_REFRESH_QUERY = Query(
    default=False,
    description="If true, bypass the in-memory REDCap cache and force a fresh fetch from REDCap.",
)


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(
    refresh: bool = _REFRESH_QUERY,
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> OverviewResponse:
    return await service.get_overview(force=refresh)


@router.get("/registry", response_model=RegistryResponse)
async def get_registry(
    search: str | None = Query(default=None, description="Substring match on child ID"),
    sex: str | None = Query(default=None),
    village: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    refresh: bool = _REFRESH_QUERY,
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> RegistryResponse:
    return await service.get_registry(search=search, sex=sex, village=village, limit=limit, offset=offset, force=refresh)


@router.get("/demographics", response_model=DemographicsResponse)
async def get_demographics(
    refresh: bool = _REFRESH_QUERY,
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> DemographicsResponse:
    return await service.get_demographics(force=refresh)


@router.get("/health", response_model=HealthScreeningResponse)
async def get_health_screening(
    refresh: bool = _REFRESH_QUERY,
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> HealthScreeningResponse:
    return await service.get_health_screening(force=refresh)


@router.get("/physical-activity", response_model=PhysicalActivityResponse)
async def get_physical_activity(
    refresh: bool = _REFRESH_QUERY,
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> PhysicalActivityResponse:
    return await service.get_physical_activity(force=refresh)


@router.get("/screen-time", response_model=ScreenTimeResponse)
async def get_screen_time(
    refresh: bool = _REFRESH_QUERY,
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> ScreenTimeResponse:
    return await service.get_screen_time(force=refresh)


@router.get("/neurodevelopment", response_model=NeurodevelopmentResponse)
async def get_neurodevelopment(
    refresh: bool = _REFRESH_QUERY,
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> NeurodevelopmentResponse:
    return await service.get_neurodevelopment(force=refresh)


@router.get("/export/active-cases")
async def export_active_cases(
    refresh: bool = _REFRESH_QUERY,
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> Response:
    workbook_bytes = await service.get_active_cases_export(force=refresh)
    filename = export_filename()
    return Response(
        content=workbook_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/active-cases.csv")
async def export_active_cases_csv(
    refresh: bool = _REFRESH_QUERY,
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> Response:
    csv_text = await service.get_active_cases_csv_export(force=refresh)
    filename = export_filename(extension="csv")
    return Response(
        content="﻿" + csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/progress", response_model=ProgressResponse)
async def get_progress(
    refresh: bool = _REFRESH_QUERY,
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> ProgressResponse:
    return await service.get_progress(force=refresh)
