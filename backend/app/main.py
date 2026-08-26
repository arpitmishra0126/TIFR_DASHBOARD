"""FastAPI application entrypoint."""
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import dashboard, health
from app.config import get_settings
from app.core.logging import configure_logging
from app.redcap.exceptions import RedCapAPIError, RedCapNotConfiguredError, RedCapResponseValidationError

settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info("%s starting in '%s' environment", settings.app_name, settings.environment)
    if not settings.redcap_configured:
        logger.warning(
            "REDCAP_API_URL / REDCAP_API_TOKEN are not both set. /dashboard/* "
            "endpoints will fail until valid REDCap credentials are supplied via environment."
        )
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RedCapNotConfiguredError)
async def handle_redcap_not_configured(_: Request, exc: RedCapNotConfiguredError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.exception_handler(RedCapAPIError)
async def handle_redcap_api_error(_: Request, exc: RedCapAPIError) -> JSONResponse:
    logger.error("REDCap API error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "REDCap API request failed."})


@app.exception_handler(RedCapResponseValidationError)
async def handle_redcap_invalid_response(_: Request, exc: RedCapResponseValidationError) -> JSONResponse:
    logger.error("REDCap response validation error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "REDCap returned an unexpected response shape."})


app.include_router(health.router, prefix=settings.api_v1_prefix)
app.include_router(dashboard.router, prefix=settings.api_v1_prefix)
