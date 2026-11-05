import pytest
from pydantic import SecretStr, ValidationError
from sqlalchemy.engine import make_url

from mamari_api.core.config import API_ROOT, PROJECT_ROOT, Settings


def test_environment_file_is_resolved_from_project_root() -> None:
    assert Settings.model_config["env_file"] == (
        PROJECT_ROOT / ".env",
        API_ROOT / ".env.local",
    )


def test_cors_origins_accept_json_and_comma_separated_values() -> None:
    json_settings = Settings(
        _env_file=None,
        cors_origins='["https://mamari.example.com","http://localhost:3000"]',
    )
    comma_settings = Settings(
        _env_file=None,
        cors_origins="https://mamari.example.com, http://localhost:3000",
    )
    shell_sourced_settings = Settings(
        _env_file=None,
        cors_origins="[https://mamari.example.com, http://localhost:3000]",
    )

    expected = ["https://mamari.example.com", "http://localhost:3000"]
    assert json_settings.cors_origins == expected
    assert comma_settings.cors_origins == expected
    assert shell_sourced_settings.cors_origins == expected


def test_cors_origins_reject_malformed_json() -> None:
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        Settings(_env_file=None, cors_origins='["https://mamari.example.com"')


def test_neon_postgres_urls_are_normalized_for_asyncpg() -> None:
    settings = Settings(
        _env_file=None,
        database_url=(
            "postgresql://app:secret@ep-example.us-east-2.aws.neon.tech/US"
            "?sslmode=require&channel_binding=require"
        ),
    )

    url = make_url(settings.database_url)
    assert url.drivername == "postgresql+asyncpg"
    assert url.database == "US"
    assert url.query == {"ssl": "require"}


def test_existing_asyncpg_urls_keep_the_driver_and_normalize_ssl() -> None:
    settings = Settings(
        _env_file=None,
        database_url="postgresql+asyncpg://app:secret@localhost/oulumata?sslmode=require",
    )

    url = make_url(settings.database_url)
    assert url.drivername == "postgresql+asyncpg"
    assert url.query == {"ssl": "require"}


def test_production_rejects_default_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(_env_file=None, app_env="production")


def test_production_accepts_a_strong_jwt_secret() -> None:
    settings = Settings(
        app_env="production",
        jwt_secret_key=SecretStr("a-unique-secret-for-production-32-chars"),
    )

    assert settings.jwt_secret_key.get_secret_value().startswith("a-unique")
