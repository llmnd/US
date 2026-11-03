import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

FinanceSource = Literal["agriculture", "elevage", "payroll"]
FinanceType = Literal["income", "expense"]


class FinanceTransactionResponse(BaseModel):
    id: uuid.UUID
    source: FinanceSource
    transaction_type: FinanceType
    category: str
    label: str
    amount_fcfa: int
    transaction_date: date
    location: str
    detail: str | None
    counterparty: str | None
    quantity: Decimal | None
    unit: str | None
    notes: str | None
    created_at: datetime


class FinanceTransactionPageResponse(BaseModel):
    items: list[FinanceTransactionResponse]
    total: int
    page: int
    page_size: int


class MonthlyFinanceResponse(BaseModel):
    month: str
    month_number: int
    income_fcfa: int
    expenses_fcfa: int


class FinanceSourceSummaryResponse(BaseModel):
    source: FinanceSource
    income_fcfa: int
    expenses_fcfa: int
    balance_fcfa: int
    transaction_count: int


class FinanceSummaryResponse(BaseModel):
    year: int
    income_fcfa: int
    expenses_fcfa: int
    balance_fcfa: int
    transaction_count: int
    monthly: list[MonthlyFinanceResponse]
    by_source: list[FinanceSourceSummaryResponse]
