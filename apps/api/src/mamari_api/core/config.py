import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import AliasChoices, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[5]
API_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://oulumata:oulumata@localhost:5432/oulumata"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    jwt_secret_key: SecretStr = SecretStr("development-only-change-before-production")
    bootstrap_admin_username: str = "oulumata"
    bootstrap_admin_password: SecretStr = SecretStr("passer123m")
    public_store_slug: str = "oulumata"
    access_token_minutes: int = Field(default=15, ge=5, le=60)
    upload_directory: Path = PROJECT_ROOT / "storage" / "uploads"
    blob_store_id: str | None = None
    blob_read_write_token: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("BLOB_READ_WRITE_TOKEN", "VERCEL_BLOB_READ_WRITE_TOKEN"),
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_async_database_url(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("DATABASE_URL doit être une URL PostgreSQL.")
        parsed = urlsplit(value.strip())
        if parsed.scheme in {"postgres", "postgresql"}:
            scheme = "postgresql+asyncpg"
        elif parsed.scheme == "postgresql+asyncpg":
            scheme = parsed.scheme
        else:
            return value

        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        sslmode = query.pop("sslmode", None)
        if sslmode is not None:
            query["ssl"] = sslmode
        query.pop("channel_binding", None)
        return urlunsplit(parsed._replace(scheme=scheme, query=urlencode(query)))

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value

        raw_value = value.strip()
        if raw_value.startswith("["):
            try:
                origins = json.loads(raw_value)
            except json.JSONDecodeError as error:
                if not raw_value.endswith("]"):
                    raise ValueError(
                        "CORS_ORIGINS doit être une liste JSON ou séparée par des virgules."
                    ) from error
                raw_value = raw_value[1:-1]
            else:
                if not isinstance(origins, list):
                    raise ValueError("CORS_ORIGINS doit être une liste.")
                return origins

        return [
            origin.strip().strip("\"'")
            for origin in raw_value.strip("[]").split(",")
            if origin.strip().strip("\"'")
        ]

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.app_env == "production":
            secret = self.jwt_secret_key.get_secret_value()
            if len(secret) < 32 or secret == "development-only-change-before-production":
                raise ValueError(
                    "Définir un JWT_SECRET_KEY unique d'au moins 32 caractères en production."
                )
        return self

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", API_ROOT / ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
