from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from pwdlib import PasswordHash

from mamari_api.core.config import get_settings

password_hash = PasswordHash.recommended()
_invalid_user_hash = password_hash.hash("not-a-real-user-password")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, stored_hash: str | None) -> bool:
    is_valid = password_hash.verify(password, stored_hash or _invalid_user_hash)
    return is_valid and stored_hash is not None


def create_access_token(user_id: UUID) -> tuple[str, int]:
    settings = get_settings()
    lifetime_seconds = settings.access_token_minutes * 60
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "iss": "mamari-api",
            "iat": now,
            "exp": now + timedelta(seconds=lifetime_seconds),
        },
        settings.jwt_secret_key.get_secret_value(),
        algorithm="HS256",
    )
    return token, lifetime_seconds


def decode_access_token(token: str) -> UUID:
    claims = jwt.decode(
        token,
        get_settings().jwt_secret_key.get_secret_value(),
        algorithms=["HS256"],
        issuer="mamari-api",
        options={"require": ["sub", "exp", "iat", "iss"]},
    )
    return UUID(claims["sub"])
