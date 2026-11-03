import uuid
from datetime import UTC, date, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from mamari_api.core.base import Base


class PayrollRecord(Base):
    __tablename__ = "hr_payroll_records"
    __table_args__ = (
        CheckConstraint("pay_month BETWEEN 1 AND 12", name="ck_hr_payroll_month"),
        CheckConstraint("pay_year BETWEEN 2000 AND 2100", name="ck_hr_payroll_year"),
        CheckConstraint("gross_pay_fcfa > 0", name="ck_hr_payroll_gross_positive"),
        CheckConstraint("bonus_fcfa >= 0", name="ck_hr_payroll_bonus_nonnegative"),
        CheckConstraint("deductions_fcfa >= 0", name="ck_hr_payroll_deductions_nonnegative"),
        CheckConstraint("net_pay_fcfa >= 0", name="ck_hr_payroll_net_nonnegative"),
        CheckConstraint("payment_status IN ('pending', 'paid')", name="ck_hr_payroll_status"),
        UniqueConstraint(
            "organization_id",
            "user_id",
            "pay_year",
            "pay_month",
            name="uq_hr_payroll_employee_period",
        ),
        Index("ix_hr_payroll_org_period", "organization_id", "pay_year", "pay_month"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    pay_year: Mapped[int] = mapped_column(Integer, nullable=False)
    pay_month: Mapped[int] = mapped_column(Integer, nullable=False)
    gross_pay_fcfa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    bonus_fcfa: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    deductions_fcfa: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    net_pay_fcfa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    payment_status: Mapped[str] = mapped_column(String(12), default="pending", nullable=False)
    paid_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )


class AbsenceRequest(Base):
    __tablename__ = "hr_absence_requests"
    __table_args__ = (
        CheckConstraint(
            "absence_type IN ('annual_leave', 'sick_leave', 'family_event', 'unpaid', 'other')",
            name="ck_hr_absence_type",
        ),
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'cancelled')",
            name="ck_hr_absence_status",
        ),
        CheckConstraint("end_date >= start_date", name="ck_hr_absence_date_order"),
        Index("ix_hr_absence_org_status_date", "organization_id", "status", "start_date"),
        Index("ix_hr_absence_user_date", "user_id", "start_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    absence_type: Mapped[str] = mapped_column(String(20), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="pending", nullable=False)
    reviewer_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
