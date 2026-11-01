"""Add organization-scoped agriculture parcels and harvests.

Revision ID: 0004_agriculture
Revises: 0003_sales_orders
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_agriculture"
down_revision: str | None = "0003_sales_orders"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.create_table(
        "agriculture_parcels",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("crop", sa.String(length=120), nullable=False),
        sa.Column("area_hectares", sa.Numeric(precision=8, scale=2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("area_hectares > 0", name="ck_agriculture_parcels_area_positive"),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_agriculture_parcels_created_by_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_agriculture_parcels_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "id",
            name="uq_agriculture_parcels_org_id",
        ),
        sa.UniqueConstraint(
            "organization_id",
            "name",
            name="uq_agriculture_parcels_org_name",
        ),
    )
    op.create_index(
        "ix_agriculture_parcels_org_active",
        "agriculture_parcels",
        ["organization_id", "is_active"],
        unique=False,
    )
    op.create_table(
        "agriculture_harvests",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("parcel_id", uuid_type, nullable=False),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("harvest_date", sa.Date(), nullable=False),
        sa.Column("quantity_kg", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "quantity_kg > 0",
            name="ck_agriculture_harvests_quantity_positive",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_agriculture_harvests_created_by_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_agriculture_harvests_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "parcel_id"],
            ["agriculture_parcels.organization_id", "agriculture_parcels.id"],
            name="fk_agriculture_harvests_org_parcel",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_agriculture_harvests_org_date",
        "agriculture_harvests",
        ["organization_id", "harvest_date"],
        unique=False,
    )
    op.create_index(
        "ix_agriculture_harvests_org_parcel",
        "agriculture_harvests",
        ["organization_id", "parcel_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_agriculture_harvests_org_parcel", table_name="agriculture_harvests")
    op.drop_index("ix_agriculture_harvests_org_date", table_name="agriculture_harvests")
    op.drop_table("agriculture_harvests")
    op.drop_index("ix_agriculture_parcels_org_active", table_name="agriculture_parcels")
    op.drop_table("agriculture_parcels")
