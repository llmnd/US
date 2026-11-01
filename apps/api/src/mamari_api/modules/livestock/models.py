import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
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


class LivestockFacility(Base):
    __tablename__ = "livestock_facilities"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_livestock_facilities_org_id"),
        UniqueConstraint("organization_id", "name", name="uq_livestock_facilities_org_name"),
        ForeignKeyConstraint(
            ["organization_id", "farm_id"],
            ["agriculture_farms.organization_id", "agriculture_farms.id"],
            name="fk_livestock_facilities_org_farm",
            ondelete="RESTRICT",
        ),
        Index("ix_livestock_facilities_org_active", "organization_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    farm_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    facility_type: Mapped[str] = mapped_column(String(24), nullable=False)
    location: Mapped[str | None] = mapped_column(String(180), nullable=True)
    photo_filename: Mapped[str | None] = mapped_column(String(80), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class LivestockGroup(Base):
    __tablename__ = "livestock_groups"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_livestock_groups_org_id"),
        ForeignKeyConstraint(
            ["organization_id", "facility_id"],
            ["livestock_facilities.organization_id", "livestock_facilities.id"],
            name="fk_livestock_groups_org_facility",
            ondelete="RESTRICT",
        ),
        CheckConstraint("head_count > 0", name="ck_livestock_groups_head_count_positive"),
        Index("ix_livestock_groups_org_species", "organization_id", "species"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    facility_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    species: Mapped[str] = mapped_column(String(60), nullable=False)
    breed: Mapped[str | None] = mapped_column(String(100), nullable=True)
    head_count: Mapped[int] = mapped_column(nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class LivestockAnimal(Base):
    __tablename__ = "livestock_animals"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_livestock_animals_org_id"),
        UniqueConstraint("organization_id", "tag_number", name="uq_livestock_animals_org_tag"),
        ForeignKeyConstraint(
            ["organization_id", "facility_id"],
            ["livestock_facilities.organization_id", "livestock_facilities.id"],
            name="fk_livestock_animals_org_facility",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["organization_id", "group_id"],
            ["livestock_groups.organization_id", "livestock_groups.id"],
            name="fk_livestock_animals_org_group",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "sex IN ('female', 'male', 'unknown')",
            name="ck_livestock_animals_sex",
        ),
        CheckConstraint(
            "status IN ('active', 'sold', 'deceased')",
            name="ck_livestock_animals_status",
        ),
        Index("ix_livestock_animals_org_status", "organization_id", "status"),
        Index("ix_livestock_animals_org_species", "organization_id", "species"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    facility_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    group_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tag_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    species: Mapped[str] = mapped_column(String(60), nullable=False)
    breed: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sex: Mapped[str] = mapped_column(String(12), nullable=False, default="unknown")
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    entry_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    photo_filename: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class LivestockRecord(Base):
    __tablename__ = "livestock_records"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "animal_id"],
            ["livestock_animals.organization_id", "livestock_animals.id"],
            name="fk_livestock_records_org_animal",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["organization_id", "group_id"],
            ["livestock_groups.organization_id", "livestock_groups.id"],
            name="fk_livestock_records_org_group",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["organization_id", "facility_id"],
            ["livestock_facilities.organization_id", "livestock_facilities.id"],
            name="fk_livestock_records_org_facility",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "record_type IN ('health', 'reproduction', 'production', 'feed')",
            name="ck_livestock_records_type",
        ),
        CheckConstraint(
            "(animal_id IS NOT NULL AND group_id IS NULL) OR "
            "(animal_id IS NULL AND group_id IS NOT NULL)",
            name="ck_livestock_records_one_subject",
        ),
        CheckConstraint("quantity IS NULL OR quantity > 0", name="ck_livestock_records_quantity"),
        CheckConstraint("amount_fcfa >= 0", name="ck_livestock_records_amount"),
        Index("ix_livestock_records_org_type_date", "organization_id", "record_type", "event_date"),
        Index("ix_livestock_records_org_due_date", "organization_id", "next_due_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    animal_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    group_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    facility_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    record_type: Mapped[str] = mapped_column(String(16), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    event_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(24), nullable=True)
    amount_fcfa: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
