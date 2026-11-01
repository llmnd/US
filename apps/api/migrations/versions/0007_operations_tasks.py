"""Add organization-scoped operation tasks.

Revision ID: 0007_operations_tasks
Revises: 0006_parcel_photos
Create Date: 2026-11-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_operations_tasks"
down_revision: str | None = "0006_parcel_photos"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.create_table(
        "operation_tasks",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("priority", sa.String(length=16), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("assigned_user_id", uuid_type, nullable=True),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('todo', 'in_progress', 'done', 'archived')",
            name="ck_operation_tasks_status",
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')",
            name="ck_operation_tasks_priority",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_operation_tasks_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["assigned_user_id"],
            ["users.id"],
            name="fk_operation_tasks_assigned_user_id_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_operation_tasks_created_by_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_operation_tasks_org_status",
        "operation_tasks",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_operation_tasks_org_due_date",
        "operation_tasks",
        ["organization_id", "due_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_operation_tasks_org_due_date", table_name="operation_tasks")
    op.drop_index("ix_operation_tasks_org_status", table_name="operation_tasks")
    op.drop_table("operation_tasks")
