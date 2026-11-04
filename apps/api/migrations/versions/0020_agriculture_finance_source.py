"""Add source to agriculture finance transactions.

Revision ID: 0020_agriculture_finance_source
Revises: 0019_customer_accounts
Create Date: 2026-11-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020_agriculture_finance_source"
down_revision: str | None = "0019_customer_accounts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "agriculture_finance_transactions",
        sa.Column(
            "source",
            sa.String(length=16),
            nullable=False,
            server_default="agriculture",
        ),
    )
    op.alter_column(
        "agriculture_finance_transactions",
        "source",
        server_default=None,
        existing_type=sa.String(length=16),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.drop_column("agriculture_finance_transactions", "source")
