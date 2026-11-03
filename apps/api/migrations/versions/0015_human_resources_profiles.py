"""Add human resources information to organization memberships.

Revision ID: 0015_human_resources_profiles
Revises: 0014_stock_ledger
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_human_resources_profiles"
down_revision: str | None = "0014_stock_ledger"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("memberships", sa.Column("job_title", sa.String(length=120), nullable=True))
    op.add_column("memberships", sa.Column("department", sa.String(length=100), nullable=True))
    op.add_column("memberships", sa.Column("hire_date", sa.Date(), nullable=True))
    op.add_column(
        "memberships",
        sa.Column("employment_type", sa.String(length=24), nullable=True),
    )
    op.add_column(
        "memberships",
        sa.Column(
            "employment_status",
            sa.String(length=16),
            server_default="active",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_memberships_employment_status",
        "memberships",
        "employment_status IN ('active', 'on_leave', 'ended')",
    )
    op.alter_column("memberships", "employment_status", server_default=None)


def downgrade() -> None:
    op.drop_constraint(
        "ck_memberships_employment_status",
        "memberships",
        type_="check",
    )
    op.drop_column("memberships", "employment_status")
    op.drop_column("memberships", "employment_type")
    op.drop_column("memberships", "hire_date")
    op.drop_column("memberships", "department")
    op.drop_column("memberships", "job_title")
