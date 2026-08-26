"""V1 dashboard API — the only interface the frontend talks to.

Every endpoint here reads live from REDCap (via the cached LiveRedCapRepository)
and normalizes in memory. There is no database. The REDCap token never leaves
the backend process.
"""
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_live_dashboard_service
from app.schemas.dashboard import (
    DemographicsResponse,
    OverviewResponse,
    ProgressResponse,
    RegistryResponse,
    UnavailableModule,
)
from app.services.live_dashboard_service import LiveDashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(service: LiveDashboardService = Depends(get_live_dashboard_service)) -> OverviewResponse:
    return await service.get_overview()


@router.get("/registry", response_model=RegistryResponse)
async def get_registry(
    search: str | None = Query(default=None, description="Substring match on child ID"),
    sex: str | None = Query(default=None),
    village: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> RegistryResponse:
    return await service.get_registry(search=search, sex=sex, village=village, limit=limit, offset=offset)


@router.get("/demographics", response_model=DemographicsResponse)
async def get_demographics(
    service: LiveDashboardService = Depends(get_live_dashboard_service),
) -> DemographicsResponse:
    return await service.get_demographics()


@router.get("/health", response_model=UnavailableModule)
async def get_health_screening() -> UnavailableModule:
    return LiveDashboardService.get_health_screening_status()


@router.get("/physical-activity", response_model=UnavailableModule)
async def get_physical_activity() -> UnavailableModule:
    return LiveDashboardService.get_physical_activity_status()


@router.get("/screen-time", response_model=UnavailableModule)
async def get_screen_time() -> UnavailableModule:
    return LiveDashboardService.get_screen_time_status()


@router.get("/neurodevelopment", response_model=UnavailableModule)
async def get_neurodevelopment() -> UnavailableModule:
    return LiveDashboardService.get_neurodevelopment_status()


@router.get("/progress", response_model=ProgressResponse)
async def get_progress(service: LiveDashboardService = Depends(get_live_dashboard_service)) -> ProgressResponse:
    return await service.get_progress()
