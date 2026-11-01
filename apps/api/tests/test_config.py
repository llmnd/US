import pytest
from pydantic import SecretStr, ValidationError

from mamari_api.core.config import PROJECT_ROOT, Settings


def test_environment_file_is_resolved_from_project_root() -> None:
    assert Settings.model_config["env_file"] == PROJECT_ROOT / ".env"


def test_production_rejects_default_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(app_env="production")


def test_production_accepts_a_strong_jwt_secret() -> None:
    settings = Settings(
        app_env="production",
        jwt_secret_key=SecretStr("a-unique-secret-for-production-32-chars"),
    )

    assert settings.jwt_secret_key.get_secret_value().startswith("a-unique")
