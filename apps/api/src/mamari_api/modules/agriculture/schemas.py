import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
AreaHectares = Annotated[Decimal, Field(gt=0, max_digits=8, decimal_places=2)]
QuantityKg = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
HarvestNotes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class CreateParcelRequest(BaseModel):
    name: Name
    crop: Name
    area_hectares: AreaHectares


class ParcelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    crop: str
    area_hectares: Decimal
    is_active: bool
    created_at: datetime


class ParcelPageResponse(BaseModel):
    items: list[ParcelResponse]
    total: int
    page: int
    page_size: int


class CreateHarvestRequest(BaseModel):
    parcel_id: uuid.UUID
    harvest_date: date = Field(default_factory=date.today)
    quantity_kg: QuantityKg
    notes: HarvestNotes | None = None


class HarvestResponse(BaseModel):
    id: uuid.UUID
    parcel_id: uuid.UUID
    parcel_name: str
    crop: str
    harvest_date: date
    quantity_kg: Decimal
    notes: str | None
    created_at: datetime


class HarvestPageResponse(BaseModel):
    items: list[HarvestResponse]
    total: int
    page: int
    page_size: int


class MonthlyProductionResponse(BaseModel):
    month: str
    month_number: int
    quantity_kg: float


class AgricultureDashboardResponse(BaseModel):
    production_kg: float
    harvest_count: int
    parcel_count: int
    monthly_production_kg: list[MonthlyProductionResponse]
