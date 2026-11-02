"""Add a public product catalog and detailed store orders.

Revision ID: 0011_store_catalog_orders
Revises: 0010_operations_collaborators
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011_store_catalog_orders"
down_revision: str | None = "0010_operations_collaborators"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.create_table(
        "products",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("unit", sa.String(length=40), nullable=False),
        sa.Column("price_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("stock_quantity", sa.Integer(), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("photo_filename", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("price_fcfa > 0", name="ck_products_price_positive"),
        sa.CheckConstraint("stock_quantity >= 0", name="ck_products_stock_nonnegative"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_products_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_products_org_public",
        "products",
        ["organization_id", "is_active", "is_published"],
        unique=False,
    )

    with op.batch_alter_table("sales_orders") as batch_op:
        batch_op.alter_column(
            "created_by_id",
            existing_type=uuid_type,
            nullable=True,
        )
        batch_op.add_column(sa.Column("customer_phone", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("customer_email", sa.String(length=320), nullable=True))
        batch_op.add_column(sa.Column("delivery_address", sa.String(length=500), nullable=True))
        batch_op.drop_constraint("ck_sales_orders_status", type_="check")
        batch_op.create_check_constraint(
            "ck_sales_orders_status",
            "status IN ('pending', 'confirmed', 'preparing', 'delivered', 'cancelled')",
        )

    op.create_table(
        "sales_order_items",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("order_id", uuid_type, nullable=False),
        sa.Column("product_id", uuid_type, nullable=True),
        sa.Column("product_name", sa.String(length=160), nullable=False),
        sa.Column("unit", sa.String(length=40), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_sales_order_items_quantity_positive"),
        sa.CheckConstraint("unit_price_fcfa > 0", name="ck_sales_order_items_price_positive"),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["sales_orders.id"],
            name="fk_sales_order_items_order_id_sales_orders",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name="fk_sales_order_items_product_id_products",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_sales_order_items_order_id",
        "sales_order_items",
        ["order_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_sales_order_items_order_id", table_name="sales_order_items")
    op.drop_table("sales_order_items")
    with op.batch_alter_table("sales_orders") as batch_op:
        batch_op.drop_constraint("ck_sales_orders_status", type_="check")
        batch_op.create_check_constraint(
            "ck_sales_orders_status",
            "status IN ('confirmed', 'preparing', 'delivered', 'cancelled')",
        )
        batch_op.drop_column("delivery_address")
        batch_op.drop_column("customer_email")
        batch_op.drop_column("customer_phone")
        batch_op.alter_column(
            "created_by_id",
            existing_type=sa.Uuid(as_uuid=True).with_variant(
                postgresql.UUID(as_uuid=True), "postgresql"
            ),
            nullable=False,
        )
    op.drop_index("ix_products_org_public", table_name="products")
    op.drop_table("products")
