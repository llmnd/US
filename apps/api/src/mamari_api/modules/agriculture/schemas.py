import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
AreaHectares = Annotated[Decimal, Field(gt=0, max_digits=8, decimal_places=2)]
QuantityKg = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
HarvestNotes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
CampaignStatusValue = Literal["planned", "simulated", "active", "closed", "archived"]
FinanceTypeValue = Literal["income", "expense"]
FinanceCategory = Literal[
    "input",
    "labor",
    "equipment",
    "transport",
    "maintenance",
    "commercialization",
    "other",
]


class CreateFarmRequest(BaseModel):
    name: Name
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=180)] | None = None


class FarmResponse(BaseModel):
    id: uuid.UUID
    name: str
    location: str | None
    is_active: bool
    photo_url: str | None
    parcel_count: int
    area_hectares: Decimal
    created_at: datetime


class FarmPageResponse(BaseModel):
    items: list[FarmResponse]
    total: int
    page: int
    page_size: int


class CropResponse(BaseModel):
    id: uuid.UUID
    name: str
    is_active: bool


class CreateCropRequest(BaseModel):
    name: Name


class CreateParcelRequest(BaseModel):
    farm_id: uuid.UUID
    name: Name
    crop_id: uuid.UUID
    area_hectares: AreaHectares


class ParcelResponse(BaseModel):
    id: uuid.UUID
    farm_id: uuid.UUID
    farm_name: str
    name: str
    crop: str
    crop_id: uuid.UUID
    area_hectares: Decimal
    is_active: bool
    photo_url: str | None
    created_at: datetime


class UpdateParcelRequest(BaseModel):
    name: Name
    area_hectares: AreaHectares


class ParcelPageResponse(BaseModel):
    items: list[ParcelResponse]
    total: int
    page: int
    page_size: int


class CreateHarvestRequest(BaseModel):
    parcel_id: uuid.UUID
    campaign_id: uuid.UUID | None = None
    harvest_date: date = Field(default_factory=date.today)
    quantity_kg: QuantityKg
    notes: HarvestNotes | None = None


class HarvestResponse(BaseModel):
    id: uuid.UUID
    parcel_id: uuid.UUID
    parcel_name: str
    crop: str
    campaign_id: uuid.UUID | None
    campaign_name: str | None = None
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


class CreateCampaignRequest(BaseModel):
    parcel_id: uuid.UUID
    crop_id: uuid.UUID
    name: Name
    season: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    start_date: date
    expected_harvest_date: date
    area_hectares: AreaHectares | None = None
    expected_yield_kg_per_hectare: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
    expected_price_fcfa_per_kg: Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]
    estimated_input_cost_fcfa: Annotated[int, Field(ge=0, le=9_000_000_000_000_000)] = 0
    estimated_other_cost_fcfa: Annotated[int, Field(ge=0, le=9_000_000_000_000_000)] = 0

    @model_validator(mode="after")
    def validate_dates(self) -> "CreateCampaignRequest":
        if self.expected_harvest_date < self.start_date:
            raise ValueError("La récolte prévisionnelle doit être après le début de campagne.")
        return self


class CampaignResponse(BaseModel):
    id: uuid.UUID
    parcel_id: uuid.UUID
    parcel_name: str
    farm_id: uuid.UUID
    farm_name: str
    crop_id: uuid.UUID
    crop: str
    name: str
    season: str
    status: CampaignStatusValue
    start_date: date
    expected_harvest_date: date
    area_hectares: Decimal
    expected_yield_kg_per_hectare: Decimal
    expected_price_fcfa_per_kg: Decimal
    estimated_input_cost_fcfa: int
    estimated_other_cost_fcfa: int
    simulated_at: datetime | None
    started_at: datetime | None
    closed_at: datetime | None
    archived_at: datetime | None
    expected_production_kg: Decimal
    expected_revenue_fcfa: int
    estimated_total_cost_fcfa: int
    estimated_margin_fcfa: int
    actual_production_kg: Decimal
    actual_sold_kg: Decimal
    actual_revenue_fcfa: int
    actual_expenses_fcfa: int
    created_at: datetime


class CampaignPageResponse(BaseModel):
    items: list[CampaignResponse]
    total: int
    page: int
    page_size: int


class CreateFinanceTransactionRequest(BaseModel):
    farm_id: uuid.UUID
    campaign_id: uuid.UUID | None = None
    transaction_type: FinanceTypeValue
    category: FinanceCategory
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
    amount_fcfa: Annotated[int, Field(gt=0, le=9_000_000_000_000_000)]
    transaction_date: date = Field(default_factory=date.today)
    quantity: Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)] | None = None
    unit: Annotated[str, StringConstraints(strip_whitespace=True, max_length=24)] | None = None
    customer_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
        | None
    ) = None
    notes: HarvestNotes | None = None

    @model_validator(mode="after")
    def validate_commercialization(self) -> "CreateFinanceTransactionRequest":
        if self.category == "commercialization" and self.transaction_type != "income":
            raise ValueError("La commercialisation doit être une recette.")
        return self


class FinanceTransactionResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID | None
    farm_id: uuid.UUID
    farm_name: str
    campaign_id: uuid.UUID | None
    campaign_name: str | None
    transaction_type: FinanceTypeValue
    category: FinanceCategory
    label: str
    amount_fcfa: int
    transaction_date: date
    quantity: Decimal | None
    unit: str | None
    customer_name: str | None
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
    amount_fcfa: int


class FinanceSummaryResponse(BaseModel):
    year: int
    income_fcfa: int
    expenses_fcfa: int
    balance_fcfa: int
    input_expenses_fcfa: int
    monthly_income: list[MonthlyFinanceResponse]
    monthly_expenses: list[MonthlyFinanceResponse]


class CampaignSaleRequest(BaseModel):
    customer_id: uuid.UUID | None = None
    customer_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
        | None
    ) = None
    quantity_kg: QuantityKg
    unit_price_fcfa_per_kg: Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2)]
    transaction_date: date = Field(default_factory=date.today)
    notes: HarvestNotes | None = None

    @model_validator(mode="after")
    def validate_customer(self) -> "CampaignSaleRequest":
        if self.customer_id is None and self.customer_name is None:
            raise ValueError("Sélectionnez un client ou indiquez son nom.")
        return self


class CampaignSimulationResponse(BaseModel):
    campaign: CampaignResponse
    assumptions: dict[str, Decimal | int]
    expected_production_kg: Decimal
    expected_revenue_fcfa: int
    estimated_total_cost_fcfa: int
    estimated_margin_fcfa: int
    margin_rate_percent: Decimal
