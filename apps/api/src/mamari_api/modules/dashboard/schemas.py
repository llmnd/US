import uuid
from datetime import date

from pydantic import BaseModel

from mamari_api.modules.sales.schemas import SalesOrderResponse


class MonthlySalesResponse(BaseModel):
    month: str
    month_number: int
    amount_fcfa: int


class MonthlyProductionResponse(BaseModel):
    month: str
    month_number: int
    quantity_kg: float


class RecentHarvestResponse(BaseModel):
    id: uuid.UUID
    parcel_name: str
    crop: str
    harvest_date: date
    quantity_kg: float


class DashboardOverviewResponse(BaseModel):
    year: int
    financial_access: bool
    revenue_fcfa: int | None
    order_count: int
    pending_order_count: int
    customer_count: int
    average_order_fcfa: int | None
    production_kg: float
    harvest_count: int
    parcel_count: int
    monthly_revenue: list[MonthlySalesResponse] | None
    monthly_production_kg: list[MonthlyProductionResponse]
    recent_orders: list[SalesOrderResponse]
    recent_harvests: list[RecentHarvestResponse]
