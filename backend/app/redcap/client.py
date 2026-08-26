"""REDCap API client.

Architectural boundary for all REDCap communication: authentication, record
export, metadata (Data Dictionary) export, retries, and response validation.

This client is fully implemented but is NOT invoked anywhere in the
application yet — REDCAP_API_URL / REDCAP_API_TOKEN / REDCAP_PROJECT_ID are
not configured, and calling any method before they are will raise
RedCapNotConfiguredError. No live connection is made at this stage.
"""
import logging

import httpx

from app.config import Settings
from app.redcap.exceptions import RedCapAPIError, RedCapNotConfiguredError, RedCapResponseValidationError

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT_SECONDS = 30.0
_DEFAULT_MAX_RETRIES = 3


class RedCapClient:
    """Thin, retrying HTTP client over the REDCap API v1 REST interface."""

    def __init__(
        self,
        settings: Settings,
        timeout_seconds: float = _DEFAULT_TIMEOUT_SECONDS,
        max_retries: int = _DEFAULT_MAX_RETRIES,
    ) -> None:
        self._api_url = settings.redcap_api_url
        self._api_token = settings.redcap_api_token
        self._project_id = settings.redcap_project_id
        self._timeout_seconds = timeout_seconds
        self._max_retries = max_retries

    def _ensure_configured(self) -> None:
        # project_id is not sent in any REDCap API request below — the token
        # alone scopes a request to a project. It is required only for
        # app-level bookkeeping (see Settings.redcap_configured), not for
        # making authenticated requests, so it is intentionally not checked here.
        if not (self._api_url and self._api_token):
            raise RedCapNotConfiguredError(
                "REDCap is not configured. Set REDCAP_API_URL and REDCAP_API_TOKEN "
                "in the environment before calling the REDCap client."
            )

    async def _post(self, data: dict[str, str]) -> httpx.Response:
        self._ensure_configured()
        payload = {"token": self._api_token, **data}

        last_error: Exception | None = None
        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            for attempt in range(1, self._max_retries + 1):
                try:
                    response = await client.post(self._api_url, data=payload)
                    if response.status_code >= 500:
                        raise RedCapAPIError(
                            f"REDCap server error (attempt {attempt}/{self._max_retries})",
                            status_code=response.status_code,
                        )
                    if response.status_code >= 400:
                        raise RedCapAPIError(
                            f"REDCap request failed: {response.text}",
                            status_code=response.status_code,
                        )
                    return response
                except (httpx.TransportError, RedCapAPIError) as exc:
                    last_error = exc
                    logger.warning("REDCap request attempt %s/%s failed: %s", attempt, self._max_retries, exc)

        assert last_error is not None
        raise RedCapAPIError(f"REDCap request failed after {self._max_retries} attempts: {last_error}")

    async def fetch_records(self, fields: list[str] | None = None) -> list[dict]:
        """Export records for the configured project.

        Args:
            fields: optional subset of field names to export (raw REDCap
                variable names, once the Data Dictionary is available).
        """
        data = {"content": "record", "format": "json", "type": "flat", "rawOrLabel": "raw"}
        if fields:
            for i, field in enumerate(fields):
                data[f"fields[{i}]"] = field

        response = await self._post(data)
        try:
            records = response.json()
        except ValueError as exc:
            raise RedCapResponseValidationError(f"REDCap record export was not valid JSON: {exc}") from exc

        if not isinstance(records, list):
            raise RedCapResponseValidationError("REDCap record export did not return a list of records.")

        return records

    async def fetch_metadata(self) -> list[dict]:
        """Export the project's Data Dictionary (field/variable metadata).

        This is required before real field-name mapping can be implemented —
        the reference CSV only contains data-labels, not variable names.
        """
        data = {"content": "metadata", "format": "json"}
        response = await self._post(data)
        try:
            metadata = response.json()
        except ValueError as exc:
            raise RedCapResponseValidationError(f"REDCap metadata export was not valid JSON: {exc}") from exc

        if not isinstance(metadata, list):
            raise RedCapResponseValidationError("REDCap metadata export did not return a list of fields.")

        return metadata
