import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, model_validator

OrderState = Literal["pending", "confirmed", "preparing", "delivered", "cancelled"]
CustomerType = Literal["individual", "professional"]
CustomerName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=160),
]


class CreateOrderRequest(BaseModel):
    customer_id: uuid.UUID | None = None
    customer_name: CustomerName | None = None
    order_date: date = Field(default_factory=date.today)
    amount_fcfa: Annotated[int, Field(gt=0, le=9_000_000_000_000_000)]

    @model_validator(mode="after")
    def validate_customer(self) -> "CreateOrderRequest":
        if self.customer_id is None and self.customer_name is None:
            raise ValueError("Sélectionnez un client ou indiquez son nom.")
        return self


class CreateCustomerRequest(BaseModel):
    customer_type: CustomerType = "individual"
    name: CustomerName
    company_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
        | None
    ) = None
    phone: Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=32)]
    email: EmailStr | None = None
    address: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    city: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None


class UpdateCustomerRequest(CreateCustomerRequest):
    pass


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_type: CustomerType
    name: str
    company_name: str | None
    phone: str
    email: str | None
    address: str | None
    city: str | None
    notes: str | None
    created_at: datetime


class CustomerPageResponse(BaseModel):
    items: list[CustomerResponse]
    total: int
    page: int
    page_size: int


class UpdateOrderStatusRequest(BaseModel):
    status: OrderState


class SalesOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID | None = None
    reference: str
    customer_name: str
    customer_phone: str | None
    customer_email: str | None
    delivery_address: str | None
    order_date: date
    amount_fcfa: int
    status: OrderState
    created_at: datetime
    items: list["SalesOrderItemResponse"] = Field(default_factory=list)


class SalesOrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: uuid.UUID | None
    product_name: str
    unit: str
    quantity: int
    unit_price_fcfa: int


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    category: str | None
    unit: str
    price_fcfa: int
    stock_quantity: int
    is_published: bool
    is_active: bool
    photo_url: str | None = None
    created_at: datetime
    updated_at: datetime


class StoreProductPageResponse(BaseModel):
    organization_name: str
    items: list[ProductResponse]


class StoreOrderItemRequest(BaseModel):
    product_id: uuid.UUID
    quantity: Annotated[int, Field(ge=1, le=999)]


class CreateStoreOrderRequest(BaseModel):
    customer_name: CustomerName
    customer_phone: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=6, max_length=32),
    ]
    customer_email: EmailStr | None = None
    delivery_address: (
        Annotated[
            str,
            StringConstraints(strip_whitespace=True, max_length=500),
        ]
        | None
    ) = None
    items: Annotated[list[StoreOrderItemRequest], Field(min_length=1, max_length=50)]


class SalesOrderPageResponse(BaseModel):
    items: list[SalesOrderResponse]
    total: int
    page: int
    page_size: int
