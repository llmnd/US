"""Add organization-scoped customer records and connect sales.

Revision ID: 0013_sales_customers
Revises: 0012_livestock_finances
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013_sales_customers"
down_revision: str | None = "0012_livestock_finances"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.create_table(
        "sales_customers",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("customer_type", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("company_name", sa.String(length=160), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_sales_customers_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_sales_customers_org_name",
        "sales_customers",
        ["organization_id", "name"],
        unique=False,
    )
    op.create_index(
        "ix_sales_customers_org_phone",
        "sales_customers",
        ["organization_id", "phone"],
        unique=False,
    )
    op.add_column(
        "sales_orders",
        sa.Column("customer_id", uuid_type, nullable=True),
    )
    op.create_foreign_key(
        "fk_sales_orders_customer_id_sales_customers",
        "sales_orders",
        "sales_customers",
        ["customer_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "agriculture_finance_transactions",
        sa.Column("customer_id", uuid_type, nullable=True),
    )
    op.create_foreign_key(
        "fk_agriculture_finance_customer_id_sales_customers",
        "agriculture_finance_transactions",
        "sales_customers",
        ["customer_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_agriculture_finance_customer_id_sales_customers",
        "agriculture_finance_transactions",
        type_="foreignkey",
    )
    op.drop_column("agriculture_finance_transactions", "customer_id")
    op.drop_constraint(
        "fk_sales_orders_customer_id_sales_customers",
        "sales_orders",
        type_="foreignkey",
    )
    op.drop_column("sales_orders", "customer_id")
    op.drop_index("ix_sales_customers_org_phone", table_name="sales_customers")
    op.drop_index("ix_sales_customers_org_name", table_name="sales_customers")
    op.drop_table("sales_customers")
