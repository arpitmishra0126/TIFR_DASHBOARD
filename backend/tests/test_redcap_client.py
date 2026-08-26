import pytest

from app.config import Settings
from app.redcap.client import RedCapClient
from app.redcap.exceptions import RedCapNotConfiguredError


@pytest.mark.asyncio
async def test_client_requires_url_and_token_but_not_project_id():
    settings = Settings(
        _env_file=None,
        redcap_api_url="https://example.org/api/",
        redcap_api_token="dummy-token",
        redcap_project_id="",  # intentionally absent, as in the live deployment
    )
    client = RedCapClient(settings)
    # Should not raise for missing project_id alone.
    client._ensure_configured()


@pytest.mark.asyncio
async def test_client_raises_when_url_missing():
    settings = Settings(_env_file=None, redcap_api_url="", redcap_api_token="dummy-token")
    client = RedCapClient(settings)
    with pytest.raises(RedCapNotConfiguredError):
        await client.fetch_metadata()


@pytest.mark.asyncio
async def test_client_raises_when_token_missing():
    settings = Settings(_env_file=None, redcap_api_url="https://example.org/api/", redcap_api_token="")
    client = RedCapClient(settings)
    with pytest.raises(RedCapNotConfiguredError):
        await client.fetch_records()
