"""Allow organizations to hide unused workspace modules.

Revision ID: 0022_hidden_organization_modules
Revises: 0021_sales_order_status_history
Create Date: 2026-11-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022_hidden_organization_modules"
down_revision: str | None = "0021_sales_order_status_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE organizations SET name = 'Oulimata' "
            "WHERE slug = 'mamari' AND name = 'Mamari'"
        )
    )
    op.add_column(
        "organizations",
        sa.Column(
            "hidden_modules",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("organizations", "hidden_modules")
    op.execute(
        sa.text(
            "UPDATE organizations SET name = 'Mamari' "
            "WHERE slug = 'mamari' AND name = 'Oulimata'"
        )
    )
