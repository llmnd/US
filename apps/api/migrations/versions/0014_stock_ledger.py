"""Create a traceable stock ledger and migrate current product quantities.

Revision ID: 0014_stock_ledger
Revises: 0013_sales_customers
Create Date: 2026-11-03
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0014_stock_ledger"
down_revision: str | None = "0013_sales_customers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.create_table(
        "stock_items",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("product_id", uuid_type, nullable=True),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("unit", sa.String(length=40), nullable=False),
        sa.Column("location", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "source IN ('agriculture', 'elevage', 'other')",
            name="ck_stock_items_source",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_stock_items_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name="fk_stock_items_product_id_products",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "id", name="uq_stock_items_org_id"),
    )
    op.create_index(
        "ix_stock_items_org_source",
        "stock_items",
        ["organization_id", "source"],
        unique=False,
    )
    op.create_table(
        "stock_movements",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("stock_item_id", uuid_type, nullable=False),
        sa.Column("created_by_id", uuid_type, nullable=True),
        sa.Column("movement_type", sa.String(length=16), nullable=False),
        sa.Column("direction", sa.String(length=3), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("movement_date", sa.Date(), nullable=False),
        sa.Column("reference_type", sa.String(length=32), nullable=True),
        sa.Column("reference_id", uuid_type, nullable=True),
        sa.Column("transfer_id", uuid_type, nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "movement_type IN ('opening', 'production', 'sale', 'cancellation', "
            "'addition', 'loss', 'consumption', 'adjustment', 'transfer_in', 'transfer_out')",
            name="ck_stock_movements_type",
        ),
        sa.CheckConstraint("direction IN ('in', 'out')", name="ck_stock_movements_direction"),
        sa.CheckConstraint("quantity > 0", name="ck_stock_movements_quantity_positive"),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_stock_movements_created_by_id_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_stock_movements_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "stock_item_id"],
            ["stock_items.organization_id", "stock_items.id"],
            name="fk_stock_movements_org_item",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "reference_type",
            "reference_id",
            name="uq_stock_movements_org_reference",
        ),
    )
    op.create_index(
        "ix_stock_movements_org_item_date",
        "stock_movements",
        ["organization_id", "stock_item_id", "movement_date"],
        unique=False,
    )

    connection = op.get_bind()
    now = datetime.now(UTC)
    products = connection.execute(
        sa.text(
            "SELECT id, organization_id, name, unit, stock_quantity "
            "FROM products ORDER BY organization_id, id"
        )
    ).mappings()
    items = sa.table(
        "stock_items",
        sa.column("id", uuid_type),
        sa.column("organization_id", uuid_type),
        sa.column("product_id", uuid_type),
        sa.column("source", sa.String),
        sa.column("name", sa.String),
        sa.column("unit", sa.String),
        sa.column("location", sa.String),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    movements = sa.table(
        "stock_movements",
        sa.column("id", uuid_type),
        sa.column("organization_id", uuid_type),
        sa.column("stock_item_id", uuid_type),
        sa.column("created_by_id", uuid_type),
        sa.column("movement_type", sa.String),
        sa.column("direction", sa.String),
        sa.column("quantity", sa.Numeric(14, 3)),
        sa.column("movement_date", sa.Date()),
        sa.column("reference_type", sa.String),
        sa.column("reference_id", uuid_type),
        sa.column("transfer_id", uuid_type),
        sa.column("note", sa.Text()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    opening_items = []
    opening_movements = []
    for product in products:
        item_id = uuid.uuid4()
        opening_items.append(
            {
                "id": item_id,
                "organization_id": uuid.UUID(str(product["organization_id"])),
                "product_id": uuid.UUID(str(product["id"])),
                "source": "other",
                "name": product["name"],
                "unit": product["unit"],
                "location": "Magasin",
                "created_at": now,
            }
        )
        if product["stock_quantity"] > 0:
            opening_movements.append(
                {
                    "id": uuid.uuid4(),
                    "organization_id": uuid.UUID(str(product["organization_id"])),
                    "stock_item_id": item_id,
                    "created_by_id": None,
                    "movement_type": "opening",
                    "direction": "in",
                    "quantity": product["stock_quantity"],
                    "movement_date": date.today(),
                    "reference_type": "product_opening",
                    "reference_id": uuid.UUID(str(product["id"])),
                    "transfer_id": None,
                    "note": "Reprise du stock existant lors de l’initialisation du registre.",
                    "created_at": now,
                }
            )
    if opening_items:
        connection.execute(items.insert(), opening_items)
    if opening_movements:
        connection.execute(movements.insert(), opening_movements)


def downgrade() -> None:
    op.drop_index("ix_stock_movements_org_item_date", table_name="stock_movements")
    op.drop_table("stock_movements")
    op.drop_index("ix_stock_items_org_source", table_name="stock_items")
    op.drop_table("stock_items")
