from app.redcap.live_repository import LiveRedCapRepository


class _CountingClient:
    """Fake RedCapClient that counts how many times each export is called."""

    def __init__(self) -> None:
        self.metadata_calls = 0
        self.records_calls = 0

    async def fetch_metadata(self) -> list[dict]:
        self.metadata_calls += 1
        return [{"call": self.metadata_calls}]

    async def fetch_records(self, fields: list[str] | None = None) -> list[dict]:
        self.records_calls += 1
        return [{"call": self.records_calls}]


async def test_get_records_uses_cache_within_ttl():
    client = _CountingClient()
    repo = LiveRedCapRepository(client)  # type: ignore[arg-type]

    first = await repo.get_records()
    second = await repo.get_records()

    assert client.records_calls == 1
    assert first == second


async def test_get_records_force_true_bypasses_cache():
    client = _CountingClient()
    repo = LiveRedCapRepository(client)  # type: ignore[arg-type]

    await repo.get_records()
    await repo.get_records(force=True)

    assert client.records_calls == 2


async def test_get_metadata_force_true_bypasses_cache():
    client = _CountingClient()
    repo = LiveRedCapRepository(client)  # type: ignore[arg-type]

    await repo.get_metadata()
    await repo.get_metadata(force=True)

    assert client.metadata_calls == 2
