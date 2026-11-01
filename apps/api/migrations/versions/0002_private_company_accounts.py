"""Use usernames and allow accounts without email addresses.

Revision ID: 0002_private_accounts
Revises: 0001_identity
Create Date: 2026-11-01
"""

import re
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_private_accounts"
down_revision: str | None = "0001_identity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _username_for(email: str | None, user_id: uuid.UUID, used: set[str]) -> str:
    local_part = email.split("@", maxsplit=1)[0] if email else "user"
    base = re.sub(r"[^a-z0-9._-]+", "-", local_part.casefold()).strip("._-")
    if len(base) < 3 or not base[0].isalnum():
        base = f"user-{base}"
    candidate = base[:32]
    if candidate not in used:
        return candidate

    suffix_length = 8
    while suffix_length <= 28:
        suffix = user_id.hex[:suffix_length]
        candidate = f"{base[: 31 - suffix_length]}-{suffix}"
        if candidate not in used:
            return candidate
        suffix_length += 4
    raise RuntimeError(f"Unable to generate a unique username for user {user_id}.")


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("username", sa.String(length=32), nullable=True))
        batch_op.alter_column("email", existing_type=sa.String(length=320), nullable=True)

    users = sa.table(
        "users",
        sa.column("id", sa.Uuid(as_uuid=True)),
        sa.column("email", sa.String(length=320)),
        sa.column("username", sa.String(length=32)),
    )
    connection = op.get_bind()
    existing_users = connection.execute(sa.select(users.c.id, users.c.email)).all()
    used_usernames: set[str] = set()
    for user_id, email in existing_users:
        username = _username_for(email, user_id, used_usernames)
        used_usernames.add(username)
        connection.execute(
            sa.update(users).where(users.c.id == user_id).values(username=username)
        )

    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "username",
            existing_type=sa.String(length=32),
            nullable=False,
        )
        batch_op.create_unique_constraint("uq_users_username", ["username"])


def downgrade() -> None:
    users = sa.table(
        "users",
        sa.column("username", sa.String(length=32)),
        sa.column("email", sa.String(length=320)),
    )
    connection = op.get_bind()
    for username, in connection.execute(
        sa.select(users.c.username).where(users.c.email.is_(None))
    ):
        connection.execute(
            sa.update(users)
            .where(users.c.username == username)
            .values(email=f"{username}@mamari.local")
        )

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("uq_users_username", type_="unique")
        batch_op.drop_column("username")
        batch_op.alter_column(
            "email",
            existing_type=sa.String(length=320),
            nullable=False,
        )
