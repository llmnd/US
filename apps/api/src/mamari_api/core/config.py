from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[5]


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://mamari:mamari@localhost:5432/mamari"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    jwt_secret_key: SecretStr = SecretStr("development-only-change-before-production")
    bootstrap_admin_username: str = "mamari"
    bootstrap_admin_password: SecretStr = SecretStr("passer123m")
    access_token_minutes: int = Field(default=15, ge=5, le=60)
    upload_directory: Path = PROJECT_ROOT / "storage" / "uploads"

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
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
