"""Add organization-scoped social communication planning.

Revision ID: 0017_communication_planning
Revises: 0016_payroll_and_absences
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017_communication_planning"
down_revision: str | None = "0016_payroll_and_absences"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.create_table(
        "communication_posts",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("caption", sa.Text(), nullable=False),
        sa.Column("hashtags", sa.String(length=1000), nullable=True),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column("content_format", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_url", sa.String(length=1000), nullable=True),
        sa.Column("media_filename", sa.String(length=120), nullable=True),
        sa.Column("media_mime_type", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "platform IN ('tiktok', 'facebook', 'both')",
            name="ck_communication_post_platform",
        ),
        sa.CheckConstraint(
            "content_format IN ('video', 'photo', 'story')",
            name="ck_communication_post_format",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'scheduled', 'published', 'archived')",
            name="ck_communication_post_status",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_communication_posts_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_communication_posts_created_by_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_communication_posts_org_status_date",
        "communication_posts",
        ["organization_id", "status", "scheduled_date"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_communication_posts_org_status_date",
        table_name="communication_posts",
    )
    op.drop_table("communication_posts")
