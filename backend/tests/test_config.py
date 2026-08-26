from app.config import Settings


def test_settings_load_defaults_without_redcap_credentials():
    settings = Settings(_env_file=None)
    assert settings.redcap_api_url == ""
    assert settings.redcap_api_token == ""
    assert settings.redcap_project_id == ""
    assert settings.redcap_configured is False


def test_redcap_configured_true_with_url_and_token_only():
    settings = Settings(
        _env_file=None,
        redcap_api_url="https://example.org/api/",
        redcap_api_token="dummy-token",
    )
    assert settings.redcap_project_id == ""
    assert settings.redcap_configured is True


def test_redcap_configured_true_with_project_id_also_present():
    settings = Settings(
        _env_file=None,
        redcap_api_url="https://example.org/api/",
        redcap_api_token="dummy-token",
        redcap_project_id="196",
    )
    assert settings.redcap_configured is True


def test_cors_origins_list_parses_comma_separated_values():
    settings = Settings(_env_file=None, cors_allow_origins="http://a.test, http://b.test")
    assert settings.cors_origins_list == ["http://a.test", "http://b.test"]
