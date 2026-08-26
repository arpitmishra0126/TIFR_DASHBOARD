"""Environment-based application configuration.

All values are sourced from environment variables / .env — nothing here is
hard-coded, and no REDCap credentials have real defaults.
"""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Application ---
    app_name: str = "ICMR Neurodevelopment Dashboard API"
    environment: str = Field(default="development")
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"

    # --- CORS ---
    cors_allow_origins: str = "http://localhost:5173"

    # --- REDCap (live source of truth — REDCap API -> FastAPI -> in-memory processing) ---
    redcap_api_url: str = Field(default="", description="REDCap API endpoint. Must be supplied via env.")
    redcap_api_token: str = Field(default="", description="REDCap API token. Must be supplied via env. Never commit.")
    redcap_project_id: str = Field(
        default="",
        description="REDCap project ID. Optional bookkeeping only — the REDCap client does not require it.",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]

    @property
    def redcap_configured(self) -> bool:
        """True once a REDCap URL + token are supplied via environment.

        The REDCap client only needs URL+token to make requests; project_id is
        optional bookkeeping and is not required for the client to be usable.
        """
        return bool(self.redcap_api_url and self.redcap_api_token)


@lru_cache
def get_settings() -> Settings:
    return Settings()
