import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from mamari_api.core.base import Base


class CampaignStatus(StrEnum):
    PLANNED = "planned"
    SIMULATED = "simulated"
    ACTIVE = "active"
    CLOSED = "closed"
    ARCHIVED = "archived"


class FinanceType(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"


class Farm(Base):
    __tablename__ = "agriculture_farms"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_agriculture_farms_org_id"),
        UniqueConstraint("organization_id", "name", name="uq_agriculture_farms_org_name"),
        Index("ix_agriculture_farms_org_active", "organization_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str | None] = mapped_column(String(180), nullable=True)
    photo_filename: Mapped[str | None] = mapped_column(String(80), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class Crop(Base):
    __tablename__ = "agriculture_crops"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_agriculture_crops_org_id"),
        UniqueConstraint("organization_id", "name", name="uq_agriculture_crops_org_name"),
        Index("ix_agriculture_crops_org_active", "organization_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class Parcel(Base):
    __tablename__ = "agriculture_parcels"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_agriculture_parcels_org_name"),
        UniqueConstraint("organization_id", "id", name="uq_agriculture_parcels_org_id"),
        ForeignKeyConstraint(
            ["organization_id", "farm_id"],
            ["agriculture_farms.organization_id", "agriculture_farms.id"],
            name="fk_agriculture_parcels_org_farm",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["organization_id", "crop_id"],
            ["agriculture_crops.organization_id", "agriculture_crops.id"],
            name="fk_agriculture_parcels_org_crop",
            ondelete="RESTRICT",
        ),
        CheckConstraint("area_hectares > 0", name="ck_agriculture_parcels_area_positive"),
        Index("ix_agriculture_parcels_org_active", "organization_id", "is_active"),
        Index("ix_agriculture_parcels_org_farm", "organization_id", "farm_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    farm_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    crop_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    crop: Mapped[str] = mapped_column(String(120), nullable=False)
    photo_filename: Mapped[str | None] = mapped_column(String(80), nullable=True)
    area_hectares: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class Campaign(Base):
    __tablename__ = "agriculture_campaigns"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_agriculture_campaigns_org_id"),
        ForeignKeyConstraint(
            ["organization_id", "parcel_id"],
            ["agriculture_parcels.organization_id", "agriculture_parcels.id"],
            name="fk_agriculture_campaigns_org_parcel",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["organization_id", "crop_id"],
            ["agriculture_crops.organization_id", "agriculture_crops.id"],
            name="fk_agriculture_campaigns_org_crop",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "status IN ('planned', 'simulated', 'active', 'closed', 'archived')",
            name="ck_agriculture_campaigns_status",
        ),
        CheckConstraint("area_hectares > 0", name="ck_agriculture_campaigns_area_positive"),
        CheckConstraint(
            "expected_yield_kg_per_hectare >= 0",
            name="ck_agriculture_campaigns_yield_nonnegative",
        ),
        CheckConstraint(
            "expected_price_fcfa_per_kg >= 0",
            name="ck_agriculture_campaigns_price_nonnegative",
        ),
        CheckConstraint(
            "estimated_input_cost_fcfa >= 0 AND estimated_other_cost_fcfa >= 0",
            name="ck_agriculture_campaigns_costs_nonnegative",
        ),
        Index("ix_agriculture_campaigns_org_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    parcel_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    crop_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    season: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=CampaignStatus.PLANNED.value
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_harvest_date: Mapped[date] = mapped_column(Date, nullable=False)
    area_hectares: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    expected_yield_kg_per_hectare: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    expected_price_fcfa_per_kg: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    estimated_input_cost_fcfa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    estimated_other_cost_fcfa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    simulated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class Harvest(Base):
    __tablename__ = "agriculture_harvests"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "parcel_id"],
            ["agriculture_parcels.organization_id", "agriculture_parcels.id"],
            name="fk_agriculture_harvests_org_parcel",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["organization_id", "campaign_id"],
            ["agriculture_campaigns.organization_id", "agriculture_campaigns.id"],
            name="fk_agriculture_harvests_org_campaign",
            ondelete="RESTRICT",
        ),
        CheckConstraint("quantity_kg > 0", name="ck_agriculture_harvests_quantity_positive"),
        Index("ix_agriculture_harvests_org_date", "organization_id", "harvest_date"),
        Index("ix_agriculture_harvests_org_parcel", "organization_id", "parcel_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    parcel_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    harvest_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    quantity_kg: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class FinanceTransaction(Base):
    __tablename__ = "agriculture_finance_transactions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "farm_id"],
            ["agriculture_farms.organization_id", "agriculture_farms.id"],
            name="fk_agriculture_finance_org_farm",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["organization_id", "campaign_id"],
            ["agriculture_campaigns.organization_id", "agriculture_campaigns.id"],
            name="fk_agriculture_finance_org_campaign",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "transaction_type IN ('income', 'expense')",
            name="ck_agriculture_finance_type",
        ),
        CheckConstraint("amount_fcfa > 0", name="ck_agriculture_finance_amount_positive"),
        Index("ix_agriculture_finance_org_date", "organization_id", "transaction_date"),
        Index("ix_agriculture_finance_org_farm", "organization_id", "farm_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    farm_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    transaction_type: Mapped[str] = mapped_column(String(8), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="agriculture")
    category: Mapped[str] = mapped_column(String(24), nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    amount_fcfa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(24), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("sales_customers.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
