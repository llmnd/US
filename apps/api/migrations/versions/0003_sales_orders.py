"""Add organization-scoped sales orders.

Revision ID: 0003_sales_orders
Revises: 0002_private_accounts
Create Date: 2026-11-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_sales_orders"
down_revision: str | None = "0002_private_accounts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.create_table(
        "sales_orders",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("reference", sa.String(length=32), nullable=False),
        sa.Column("customer_name", sa.String(length=160), nullable=False),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("amount_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("amount_fcfa > 0", name="ck_sales_orders_amount_positive"),
        sa.CheckConstraint(
            "status IN ('confirmed', 'preparing', 'delivered', 'cancelled')",
            name="ck_sales_orders_status",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_sales_orders_created_by_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_sales_orders_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "reference",
            name="uq_sales_orders_org_reference",
        ),
    )
    op.create_index(
        "ix_sales_orders_org_date",
        "sales_orders",
        ["organization_id", "order_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_sales_orders_org_date", table_name="sales_orders")
    op.drop_table("sales_orders")
