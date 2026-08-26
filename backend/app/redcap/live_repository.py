"""In-memory, read-only cache of live REDCap metadata + records.

There is no database layer in this architecture — REDCap is the source of
truth, and this class is the only place the app holds a transient copy of
REDCap data in process memory. Every value expires after CACHE_TTL_SECONDS,
after which the next request re-fetches from the live REDCap API, keeping
the dashboard "live" without hammering REDCap on every page navigation.

Never writes to REDCap. Never caches to disk.
"""
import asyncio
import time

from app.ingestion.live_field_map import LIVE_FIELDS
from app.redcap.client import RedCapClient

CACHE_TTL_SECONDS = 30.0


class LiveRedCapRepository:
    def __init__(self, client: RedCapClient) -> None:
        self._client = client
        self._lock = asyncio.Lock()
        self._metadata: list[dict] | None = None
        self._metadata_fetched_at: float = 0.0
        self._records: list[dict] | None = None
        self._records_fetched_at: float = 0.0

    async def get_metadata(self, force: bool = False) -> list[dict]:
        async with self._lock:
            if force or self._metadata is None or self._is_stale(self._metadata_fetched_at):
                self._metadata = await self._client.fetch_metadata()
                self._metadata_fetched_at = time.monotonic()
            return self._metadata

    async def get_records(self, force: bool = False) -> list[dict]:
        async with self._lock:
            if force or self._records is None or self._is_stale(self._records_fetched_at):
                self._records = await self._client.fetch_records(fields=list(LIVE_FIELDS))
                self._records_fetched_at = time.monotonic()
            return self._records

    @staticmethod
    def _is_stale(fetched_at: float) -> bool:
        return (time.monotonic() - fetched_at) > CACHE_TTL_SECONDS
