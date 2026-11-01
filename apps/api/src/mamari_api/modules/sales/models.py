import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from mamari_api.core.base import Base


class OrderStatus(StrEnum):
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class SalesOrder(Base):
    __tablename__ = "sales_orders"
    __table_args__ = (
        UniqueConstraint("organization_id", "reference", name="uq_sales_orders_org_reference"),
        CheckConstraint("amount_fcfa > 0", name="ck_sales_orders_amount_positive"),
        CheckConstraint(
            "status IN ('confirmed', 'preparing', 'delivered', 'cancelled')",
            name="ck_sales_orders_status",
        ),
        Index("ix_sales_orders_org_date", "organization_id", "order_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    reference: Mapped[str] = mapped_column(String(32), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(160), nullable=False)
    order_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    amount_fcfa: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=OrderStatus.CONFIRMED.value
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
