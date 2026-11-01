"""Add organization-scoped livestock management.

Revision ID: 0009_livestock
Revises: 0008_seed_crop_catalog
Create Date: 2026-11-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009_livestock"
down_revision: str | None = "0008_seed_crop_catalog"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.create_table(
        "livestock_facilities",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("farm_id", uuid_type, nullable=True),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("facility_type", sa.String(length=24), nullable=False),
        sa.Column("location", sa.String(length=180), nullable=True),
        sa.Column("photo_filename", sa.String(length=80), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_livestock_facilities_organization",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_livestock_facilities_creator",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "farm_id"],
            ["agriculture_farms.organization_id", "agriculture_farms.id"],
            name="fk_livestock_facilities_org_farm",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "id", name="uq_livestock_facilities_org_id"),
        sa.UniqueConstraint("organization_id", "name", name="uq_livestock_facilities_org_name"),
    )
    op.create_index(
        "ix_livestock_facilities_org_active",
        "livestock_facilities",
        ["organization_id", "is_active"],
    )

    op.create_table(
        "livestock_groups",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("facility_id", uuid_type, nullable=True),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("species", sa.String(length=60), nullable=False),
        sa.Column("breed", sa.String(length=100), nullable=True),
        sa.Column("head_count", sa.Integer(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("head_count > 0", name="ck_livestock_groups_head_count_positive"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_livestock_groups_organization",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_livestock_groups_creator",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "facility_id"],
            ["livestock_facilities.organization_id", "livestock_facilities.id"],
            name="fk_livestock_groups_org_facility",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "id", name="uq_livestock_groups_org_id"),
    )
    op.create_index(
        "ix_livestock_groups_org_species",
        "livestock_groups",
        ["organization_id", "species"],
    )

    op.create_table(
        "livestock_animals",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("facility_id", uuid_type, nullable=True),
        sa.Column("group_id", uuid_type, nullable=True),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("tag_number", sa.String(length=80), nullable=True),
        sa.Column("species", sa.String(length=60), nullable=False),
        sa.Column("breed", sa.String(length=100), nullable=True),
        sa.Column("sex", sa.String(length=12), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("photo_filename", sa.String(length=80), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "sex IN ('female', 'male', 'unknown')",
            name="ck_livestock_animals_sex",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'sold', 'deceased')",
            name="ck_livestock_animals_status",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_livestock_animals_organization",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_livestock_animals_creator",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "facility_id"],
            ["livestock_facilities.organization_id", "livestock_facilities.id"],
            name="fk_livestock_animals_org_facility",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "group_id"],
            ["livestock_groups.organization_id", "livestock_groups.id"],
            name="fk_livestock_animals_org_group",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "id", name="uq_livestock_animals_org_id"),
        sa.UniqueConstraint("organization_id", "tag_number", name="uq_livestock_animals_org_tag"),
    )
    op.create_index(
        "ix_livestock_animals_org_status",
        "livestock_animals",
        ["organization_id", "status"],
    )
    op.create_index(
        "ix_livestock_animals_org_species",
        "livestock_animals",
        ["organization_id", "species"],
    )

    op.create_table(
        "livestock_records",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("animal_id", uuid_type, nullable=True),
        sa.Column("group_id", uuid_type, nullable=True),
        sa.Column("facility_id", uuid_type, nullable=True),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("record_type", sa.String(length=16), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=True),
        sa.Column("unit", sa.String(length=24), nullable=True),
        sa.Column("amount_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("next_due_date", sa.Date(), nullable=True),
        sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "record_type IN ('health', 'reproduction', 'production', 'feed')",
            name="ck_livestock_records_type",
        ),
        sa.CheckConstraint(
            "(animal_id IS NOT NULL AND group_id IS NULL) OR "
            "(animal_id IS NULL AND group_id IS NOT NULL)",
            name="ck_livestock_records_one_subject",
        ),
        sa.CheckConstraint(
            "quantity IS NULL OR quantity > 0",
            name="ck_livestock_records_quantity",
        ),
        sa.CheckConstraint("amount_fcfa >= 0", name="ck_livestock_records_amount"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_livestock_records_organization",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_livestock_records_creator",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "animal_id"],
            ["livestock_animals.organization_id", "livestock_animals.id"],
            name="fk_livestock_records_org_animal",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "group_id"],
            ["livestock_groups.organization_id", "livestock_groups.id"],
            name="fk_livestock_records_org_group",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "facility_id"],
            ["livestock_facilities.organization_id", "livestock_facilities.id"],
            name="fk_livestock_records_org_facility",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_livestock_records_org_type_date",
        "livestock_records",
        ["organization_id", "record_type", "event_date"],
    )
    op.create_index(
        "ix_livestock_records_org_due_date",
        "livestock_records",
        ["organization_id", "next_due_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_livestock_records_org_due_date", table_name="livestock_records")
    op.drop_index("ix_livestock_records_org_type_date", table_name="livestock_records")
    op.drop_table("livestock_records")
    op.drop_index("ix_livestock_animals_org_species", table_name="livestock_animals")
    op.drop_index("ix_livestock_animals_org_status", table_name="livestock_animals")
    op.drop_table("livestock_animals")
    op.drop_index("ix_livestock_groups_org_species", table_name="livestock_groups")
    op.drop_table("livestock_groups")
    op.drop_index("ix_livestock_facilities_org_active", table_name="livestock_facilities")
    op.drop_table("livestock_facilities")
