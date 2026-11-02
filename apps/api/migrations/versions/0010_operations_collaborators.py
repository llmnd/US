"""Extend operation tasks and organization member profiles.

Revision ID: 0010_operations_collaborators
Revises: 0009_livestock
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010_operations_collaborators"
down_revision: str | None = "0009_livestock"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.add_column("memberships", sa.Column("phone", sa.String(length=32), nullable=True))
    op.add_column("memberships", sa.Column("photo_filename", sa.String(length=80), nullable=True))
    op.add_column("operation_tasks", sa.Column("progress_note", sa.Text(), nullable=True))
    op.add_column("operation_tasks", sa.Column("delay_reason", sa.Text(), nullable=True))
    op.create_table(
        "operation_task_updates",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("task_id", uuid_type, nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("status", sa.String(length=16), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("delay_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_operation_task_updates_organization",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["operation_tasks.id"],
            name="fk_operation_task_updates_task",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_operation_task_updates_user",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_operation_task_updates_task_created",
        "operation_task_updates",
        ["task_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_operation_task_updates_task_created", table_name="operation_task_updates")
    op.drop_table("operation_task_updates")
    op.drop_column("operation_tasks", "delay_reason")
    op.drop_column("operation_tasks", "progress_note")
    op.drop_column("memberships", "photo_filename")
    op.drop_column("memberships", "phone")
