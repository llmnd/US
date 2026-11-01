import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

LivestockName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)
]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
SpeciesName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
RecordType = Literal["health", "reproduction", "production", "feed"]
EventDate = date


class CreateFacilityRequest(BaseModel):
    name: LivestockName
    facility_type: Literal["barn", "coop", "pasture", "pen", "other"] = "other"
    farm_id: uuid.UUID | None = None
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=180)] | None = None


class FacilityResponse(BaseModel):
    id: uuid.UUID
    name: str
    facility_type: str
    farm_id: uuid.UUID | None
    farm_name: str | None
    location: str | None
    photo_url: str | None
    is_active: bool
    created_at: datetime


class CreateGroupRequest(BaseModel):
    name: LivestockName
    species: SpeciesName
    breed: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    facility_id: uuid.UUID | None = None
    head_count: Annotated[int, Field(gt=0, le=1_000_000)]
    entry_date: date = Field(default_factory=date.today)
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None = None


class GroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    species: str
    breed: str | None
    facility_id: uuid.UUID | None
    facility_name: str | None
    head_count: int
    entry_date: date
    notes: str | None
    is_active: bool
    created_at: datetime


class CreateAnimalRequest(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] | None = None
    tag_number: Annotated[
        str, StringConstraints(strip_whitespace=True, max_length=80)
    ] | None = None
    species: SpeciesName
    breed: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    sex: Literal["female", "male", "unknown"] = "unknown"
    facility_id: uuid.UUID | None = None
    group_id: uuid.UUID | None = None
    birth_date: date | None = None
    entry_date: date = Field(default_factory=date.today)
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None = None


class AnimalResponse(BaseModel):
    id: uuid.UUID
    name: str | None
    tag_number: str | None
    species: str
    breed: str | None
    sex: str
    facility_id: uuid.UUID | None
    facility_name: str | None
    group_id: uuid.UUID | None
    group_name: str | None
    birth_date: date | None
    entry_date: date
    photo_url: str | None
    notes: str | None
    status: str
    created_at: datetime


class CreateRecordRequest(BaseModel):
    record_type: RecordType
    category: ShortText
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
    event_date: EventDate = Field(default_factory=date.today)
    animal_id: uuid.UUID | None = None
    group_id: uuid.UUID | None = None
    quantity: Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)] | None = None
    unit: Annotated[str, StringConstraints(strip_whitespace=True, max_length=24)] | None = None
    amount_fcfa: Annotated[int, Field(ge=0, le=9_000_000_000_000_000)] = 0
    next_due_date: date | None = None
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None

    @model_validator(mode="after")
    def validate_subject_and_dates(self) -> "CreateRecordRequest":
        allowed_categories = {
            "health": {"illness", "treatment", "vaccination", "checkup"},
            "reproduction": {"birth", "mating", "pregnancy", "mortality", "sale"},
            "production": {"milk", "eggs", "weight", "other"},
            "feed": {"feed", "water", "supplement"},
        }
        if (self.animal_id is None) == (self.group_id is None):
            raise ValueError("Choisissez un animal ou un lot.")
        if self.category not in allowed_categories[self.record_type]:
            raise ValueError("Le type d’événement ne correspond pas à l’opération.")
        if self.next_due_date is not None and self.record_type != "health":
            raise ValueError("La prochaine échéance ne concerne que les soins.")
        if self.record_type in {"production", "feed"} and (
            self.quantity is None or self.unit is None
        ):
            raise ValueError("La quantité et son unité sont obligatoires pour cette opération.")
        return self


class RecordResponse(BaseModel):
    id: uuid.UUID
    record_type: str
    category: str
    title: str
    event_date: date
    animal_id: uuid.UUID | None
    animal_name: str | None
    group_id: uuid.UUID | None
    group_name: str | None
    facility_id: uuid.UUID | None
    facility_name: str | None
    quantity: Decimal | None
    unit: str | None
    amount_fcfa: int
    finance_transaction_created: bool
    next_due_date: date | None
    is_resolved: bool
    notes: str | None
    created_at: datetime


class MonthlyProductionTotal(BaseModel):
    quantity: Decimal
    unit: str | None


class UpcomingCareResponse(BaseModel):
    id: uuid.UUID
    title: str
    due_date: date
    animal_name: str | None
    group_name: str | None
    category: str
    overdue: bool


class LivestockOverviewResponse(BaseModel):
    animal_count: int
    group_count: int
    facility_count: int
    health_follow_up_count: int
    upcoming_care_count: int
    production_month_totals: list[MonthlyProductionTotal]
    upcoming_care: list[UpcomingCareResponse]
