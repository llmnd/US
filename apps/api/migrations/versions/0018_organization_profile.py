"""Add editable organization profile fields.

Revision ID: 0018_organization_profile
Revises: 0017_communication_planning
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018_organization_profile"
down_revision: str | None = "0017_communication_planning"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("organizations", sa.Column("legal_form", sa.String(length=120), nullable=True))
    op.add_column("organizations", sa.Column("phone", sa.String(length=32), nullable=True))
    op.add_column("organizations", sa.Column("email", sa.String(length=320), nullable=True))
    op.add_column("organizations", sa.Column("address", sa.String(length=500), nullable=True))
    op.add_column("organizations", sa.Column("website", sa.String(length=500), nullable=True))
    op.add_column("organizations", sa.Column("facebook_url", sa.String(length=500), nullable=True))
    op.add_column("organizations", sa.Column("tiktok_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "tiktok_url")
    op.drop_column("organizations", "facebook_url")
    op.drop_column("organizations", "website")
    op.drop_column("organizations", "address")
    op.drop_column("organizations", "email")
    op.drop_column("organizations", "phone")
    op.drop_column("organizations", "legal_form")
    op.drop_column("organizations", "description")
