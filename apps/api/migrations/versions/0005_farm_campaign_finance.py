"""Add farm hierarchy, campaigns, finance and crop catalog.

Revision ID: 0005_farm_campaign_finance
Revises: 0004_agriculture
Create Date: 2026-11-03
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_farm_campaign_finance"
down_revision: str | None = "0004_agriculture"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_CROPS = (
    "Maïs",
    "Riz",
    "Arachide",
    "Mil",
    "Sorgho",
    "Manioc",
    "Niébé",
    "Tomate",
    "Oignon",
    "Coton",
    "Banane",
    "Mangue",
)


def upgrade() -> None:
    bind = op.get_bind()
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    now = datetime.now(UTC)

    def database_uuid(value: uuid.UUID | str) -> uuid.UUID | str:
        return str(value) if bind.dialect.name == "sqlite" else value

    op.create_table(
        "agriculture_farms",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("location", sa.String(length=180), nullable=True),
        sa.Column("photo_filename", sa.String(length=80), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_agriculture_farms_created_by_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_agriculture_farms_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "id", name="uq_agriculture_farms_org_id"),
        sa.UniqueConstraint("organization_id", "name", name="uq_agriculture_farms_org_name"),
    )
    op.create_index(
        "ix_agriculture_farms_org_active",
        "agriculture_farms",
        ["organization_id", "is_active"],
    )
    op.create_table(
        "agriculture_crops",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_agriculture_crops_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "id", name="uq_agriculture_crops_org_id"),
        sa.UniqueConstraint("organization_id", "name", name="uq_agriculture_crops_org_name"),
    )
    op.create_index(
        "ix_agriculture_crops_org_active",
        "agriculture_crops",
        ["organization_id", "is_active"],
    )

    op.add_column(
        "agriculture_parcels",
        sa.Column("farm_id", uuid_type, nullable=True),
    )
    op.add_column(
        "agriculture_parcels",
        sa.Column("crop_id", uuid_type, nullable=True),
    )

    organization_rows = bind.execute(
        sa.text(
            """
            SELECT organizations.id, memberships.user_id
            FROM organizations
            LEFT JOIN memberships ON memberships.organization_id = organizations.id
            ORDER BY organizations.id, memberships.created_at
            """
        )
    ).all()
    creators: dict[uuid.UUID | str, uuid.UUID | str] = {}
    for organization_id, user_id in organization_rows:
        if user_id is None:
            raise RuntimeError(
                f"Organization {organization_id} has no member to own its default farm."
            )
        creators.setdefault(organization_id, user_id)

    farm_by_org: dict[uuid.UUID | str, uuid.UUID] = {}
    crops_by_org: dict[uuid.UUID | str, dict[str, uuid.UUID]] = {}
    for organization_id, creator_id in creators.items():
        farm_id = uuid.uuid4()
        farm_by_org[organization_id] = farm_id
        bind.execute(
            sa.text(
                """
                INSERT INTO agriculture_farms
                    (id, organization_id, created_by_id, name, location,
                     photo_filename, is_active, created_at)
                VALUES (:id, :organization_id, :created_by_id, :name, NULL, NULL, TRUE, :created_at)
                """
            ),
            {
                "id": database_uuid(farm_id),
                "organization_id": database_uuid(organization_id),
                "created_by_id": database_uuid(creator_id),
                "name": "Ferme principale",
                "created_at": now,
            },
        )
        crop_names = list(DEFAULT_CROPS)
        legacy_names = bind.execute(
            sa.text(
                "SELECT DISTINCT crop FROM agriculture_parcels "
                "WHERE organization_id = :organization_id ORDER BY crop"
            ),
            {"organization_id": organization_id},
        ).scalars()
        known_names = {name.casefold() for name in crop_names}
        for legacy_name in legacy_names:
            if legacy_name.casefold() not in known_names:
                crop_names.append(legacy_name)
                known_names.add(legacy_name.casefold())

        crops_by_org[organization_id] = {}
        for crop_name in crop_names:
            crop_id = uuid.uuid4()
            bind.execute(
                sa.text(
                    """
                    INSERT INTO agriculture_crops
                        (id, organization_id, name, is_active, created_at)
                    VALUES (:id, :organization_id, :name, TRUE, :created_at)
                    """
                ),
                {
                    "id": database_uuid(crop_id),
                    "organization_id": database_uuid(organization_id),
                    "name": crop_name,
                    "created_at": now,
                },
            )
            crops_by_org[organization_id][crop_name.casefold()] = crop_id

    parcels = bind.execute(
        sa.text("SELECT id, organization_id, crop FROM agriculture_parcels")
    ).all()
    for parcel_id, organization_id, crop_name in parcels:
        bind.execute(
            sa.text(
                """
                UPDATE agriculture_parcels
                SET farm_id = :farm_id, crop_id = :crop_id
                WHERE id = :parcel_id
                """
            ),
            {
                "farm_id": database_uuid(farm_by_org[organization_id]),
                "crop_id": database_uuid(crops_by_org[organization_id][crop_name.casefold()]),
                "parcel_id": database_uuid(parcel_id),
            },
        )

    with op.batch_alter_table("agriculture_parcels") as batch:
        batch.alter_column("farm_id", existing_type=uuid_type, nullable=False)
        batch.alter_column("crop_id", existing_type=uuid_type, nullable=False)
        batch.create_foreign_key(
            "fk_agriculture_parcels_org_farm",
            "agriculture_farms",
            ["organization_id", "farm_id"],
            ["organization_id", "id"],
            ondelete="RESTRICT",
        )
        batch.create_foreign_key(
            "fk_agriculture_parcels_org_crop",
            "agriculture_crops",
            ["organization_id", "crop_id"],
            ["organization_id", "id"],
            ondelete="RESTRICT",
        )
        batch.create_index("ix_agriculture_parcels_org_farm", ["organization_id", "farm_id"])

    op.create_table(
        "agriculture_campaigns",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("parcel_id", uuid_type, nullable=False),
        sa.Column("crop_id", uuid_type, nullable=False),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("season", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("expected_harvest_date", sa.Date(), nullable=False),
        sa.Column("area_hectares", sa.Numeric(precision=8, scale=2), nullable=False),
        sa.Column(
            "expected_yield_kg_per_hectare",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
        ),
        sa.Column(
            "expected_price_fcfa_per_kg",
            sa.Numeric(precision=14, scale=2),
            nullable=False,
        ),
        sa.Column("estimated_input_cost_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("estimated_other_cost_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("simulated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('planned', 'simulated', 'active', 'closed', 'archived')",
            name="ck_agriculture_campaigns_status",
        ),
        sa.CheckConstraint("area_hectares > 0", name="ck_agriculture_campaigns_area_positive"),
        sa.CheckConstraint(
            "expected_yield_kg_per_hectare >= 0",
            name="ck_agriculture_campaigns_yield_nonnegative",
        ),
        sa.CheckConstraint(
            "expected_price_fcfa_per_kg >= 0",
            name="ck_agriculture_campaigns_price_nonnegative",
        ),
        sa.CheckConstraint(
            "estimated_input_cost_fcfa >= 0 AND estimated_other_cost_fcfa >= 0",
            name="ck_agriculture_campaigns_costs_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_agriculture_campaigns_created_by_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_agriculture_campaigns_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "parcel_id"],
            ["agriculture_parcels.organization_id", "agriculture_parcels.id"],
            name="fk_agriculture_campaigns_org_parcel",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "crop_id"],
            ["agriculture_crops.organization_id", "agriculture_crops.id"],
            name="fk_agriculture_campaigns_org_crop",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "id", name="uq_agriculture_campaigns_org_id"),
    )
    op.create_index(
        "ix_agriculture_campaigns_org_status",
        "agriculture_campaigns",
        ["organization_id", "status"],
    )

    op.add_column(
        "agriculture_harvests",
        sa.Column("campaign_id", uuid_type, nullable=True),
    )
    with op.batch_alter_table("agriculture_harvests") as batch:
        batch.create_foreign_key(
            "fk_agriculture_harvests_org_campaign",
            "agriculture_campaigns",
            ["organization_id", "campaign_id"],
            ["organization_id", "id"],
            ondelete="RESTRICT",
        )

    op.create_table(
        "agriculture_finance_transactions",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("farm_id", uuid_type, nullable=False),
        sa.Column("campaign_id", uuid_type, nullable=True),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("transaction_type", sa.String(length=8), nullable=False),
        sa.Column("category", sa.String(length=24), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("amount_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("unit", sa.String(length=24), nullable=True),
        sa.Column("customer_name", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "transaction_type IN ('income', 'expense')",
            name="ck_agriculture_finance_type",
        ),
        sa.CheckConstraint("amount_fcfa > 0", name="ck_agriculture_finance_amount_positive"),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_agriculture_finance_transactions_created_by_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_agri_finance_org",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "farm_id"],
            ["agriculture_farms.organization_id", "agriculture_farms.id"],
            name="fk_agriculture_finance_org_farm",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "campaign_id"],
            ["agriculture_campaigns.organization_id", "agriculture_campaigns.id"],
            name="fk_agriculture_finance_org_campaign",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_agriculture_finance_org_date",
        "agriculture_finance_transactions",
        ["organization_id", "transaction_date"],
    )
    op.create_index(
        "ix_agriculture_finance_org_farm",
        "agriculture_finance_transactions",
        ["organization_id", "farm_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_agriculture_finance_org_farm", table_name="agriculture_finance_transactions")
    op.drop_index("ix_agriculture_finance_org_date", table_name="agriculture_finance_transactions")
    op.drop_table("agriculture_finance_transactions")
    with op.batch_alter_table("agriculture_harvests") as batch:
        batch.drop_constraint("fk_agriculture_harvests_org_campaign", type_="foreignkey")
        batch.drop_column("campaign_id")
    op.drop_index("ix_agriculture_campaigns_org_status", table_name="agriculture_campaigns")
    op.drop_table("agriculture_campaigns")
    with op.batch_alter_table("agriculture_parcels") as batch:
        batch.drop_index("ix_agriculture_parcels_org_farm")
        batch.drop_constraint("fk_agriculture_parcels_org_crop", type_="foreignkey")
        batch.drop_constraint("fk_agriculture_parcels_org_farm", type_="foreignkey")
        batch.drop_column("crop_id")
        batch.drop_column("farm_id")
    op.drop_index("ix_agriculture_crops_org_active", table_name="agriculture_crops")
    op.drop_table("agriculture_crops")
    op.drop_index("ix_agriculture_farms_org_active", table_name="agriculture_farms")
    op.drop_table("agriculture_farms")
