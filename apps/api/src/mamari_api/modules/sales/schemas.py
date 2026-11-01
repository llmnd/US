import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

OrderState = Literal["confirmed", "preparing", "delivered", "cancelled"]
CustomerName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=160),
]


class CreateOrderRequest(BaseModel):
    customer_name: CustomerName
    order_date: date = Field(default_factory=date.today)
    amount_fcfa: Annotated[int, Field(gt=0, le=9_000_000_000_000_000)]


class UpdateOrderStatusRequest(BaseModel):
    status: OrderState


class SalesOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reference: str
    customer_name: str
    order_date: date
    amount_fcfa: int
    status: OrderState
    created_at: datetime


class SalesOrderPageResponse(BaseModel):
    items: list[SalesOrderResponse]
    total: int
    page: int
    page_size: int
