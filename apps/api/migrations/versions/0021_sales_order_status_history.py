"""Track order status changes for customer updates.

Revision ID: 0021_sales_order_status_history
Revises: 0020_agriculture_finance_source
Create Date: 2026-11-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0021_sales_order_status_history"
down_revision: str | None = "0020_agriculture_finance_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.create_table(
        "sales_order_status_events",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("order_id", uuid_type, nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("actor_id", uuid_type, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending', 'confirmed', 'preparing', 'delivered', 'cancelled')",
            name="ck_sales_order_status_events_status",
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            name="fk_sales_order_status_events_actor_id_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["sales_orders.id"],
            name="fk_sales_order_status_events_order_id_sales_orders",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_sales_order_status_events_order_created",
        "sales_order_status_events",
        ["order_id", "created_at"],
    )
    op.execute(
        sa.text(
            """
            INSERT INTO sales_order_status_events (id, order_id, status, actor_id, created_at)
            SELECT id, id, status, created_by_id, created_at
            FROM sales_orders
            """
        )
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sales_order_status_events_order_created",
        table_name="sales_order_status_events",
    )
    op.drop_table("sales_order_status_events")
