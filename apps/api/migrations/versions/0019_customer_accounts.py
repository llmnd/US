"""Link store customer records to customer accounts.

Revision ID: 0019_customer_accounts
Revises: 0018_organization_profile
Create Date: 2026-11-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019_customer_accounts"
down_revision: str | None = "0018_organization_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.add_column("sales_customers", sa.Column("user_id", uuid_type, nullable=True))
    op.create_foreign_key(
        "fk_sales_customers_user_id_users",
        "sales_customers",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_unique_constraint("uq_sales_customers_user_id", "sales_customers", ["user_id"])


def downgrade() -> None:
    op.drop_constraint("uq_sales_customers_user_id", "sales_customers", type_="unique")
    op.drop_constraint("fk_sales_customers_user_id_users", "sales_customers", type_="foreignkey")
    op.drop_column("sales_customers", "user_id")
