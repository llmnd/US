import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

EmploymentStatus = Literal["active", "on_leave", "ended"]
EmploymentType = Literal["permanent", "fixed_term", "seasonal", "intern", "contractor"]
PayrollStatus = Literal["pending", "paid"]
AbsenceType = Literal["annual_leave", "sick_leave", "family_event", "unpaid", "other"]
AbsenceStatus = Literal["pending", "approved", "rejected", "cancelled"]
FcfaAmount = Annotated[int, Field(ge=0, le=9_000_000_000_000_000)]


class HumanResourceEmployeeResponse(BaseModel):
    id: uuid.UUID
    username: str
    full_name: str
    role: Literal["owner", "admin", "manager", "operator", "reader"]
    phone: str | None
    photo_url: str | None
    is_active: bool
    job_title: str | None
    department: str | None
    hire_date: date | None
    employment_type: EmploymentType | None
    employment_status: EmploymentStatus


class HumanResourceSummaryResponse(BaseModel):
    total: int
    active: int
    on_leave: int
    ended: int


class HumanResourceEmployeePageResponse(BaseModel):
    items: list[HumanResourceEmployeeResponse]
    total: int
    page: int
    page_size: int
    summary: HumanResourceSummaryResponse


class UpdateHumanResourceEmployeeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_title: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
        | None
    ) = None
    department: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
        | None
    ) = None
    hire_date: date | None = None
    employment_type: EmploymentType | None = None
    employment_status: EmploymentStatus | None = None

    @model_validator(mode="after")
    def require_changes(self) -> "UpdateHumanResourceEmployeeRequest":
        if not self.model_fields_set:
            raise ValueError("Indiquez au moins une information à mettre à jour.")
        return self


class CreatePayrollRecordRequest(BaseModel):
    user_id: uuid.UUID
    pay_year: Annotated[int, Field(ge=2000, le=2100)]
    pay_month: Annotated[int, Field(ge=1, le=12)]
    gross_pay_fcfa: Annotated[int, Field(gt=0, le=9_000_000_000_000_000)]
    bonus_fcfa: FcfaAmount = 0
    deductions_fcfa: FcfaAmount = 0
    note: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=2000)]
        | None
    ) = None

    @model_validator(mode="after")
    def validate_net_pay(self) -> "CreatePayrollRecordRequest":
        if self.deductions_fcfa > self.gross_pay_fcfa + self.bonus_fcfa:
            raise ValueError("Les retenues ne peuvent pas dépasser le brut et les primes.")
        return self


class PayrollRecordResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    employee_name: str
    department: str | None
    pay_year: int
    pay_month: int
    gross_pay_fcfa: int
    bonus_fcfa: int
    deductions_fcfa: int
    net_pay_fcfa: int
    payment_status: PayrollStatus
    paid_at: date | None
    note: str | None
    created_at: datetime


class PayrollRecordPageResponse(BaseModel):
    items: list[PayrollRecordResponse]
    total: int
    page: int
    page_size: int


class CreateAbsenceRequest(BaseModel):
    absence_type: AbsenceType
    start_date: date
    end_date: date
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=1000)]

    @model_validator(mode="after")
    def validate_date_range(self) -> "CreateAbsenceRequest":
        if self.end_date < self.start_date:
            raise ValueError("La date de fin doit être égale ou postérieure à la date de début.")
        return self


class ReviewAbsenceRequest(BaseModel):
    status: Literal["approved", "rejected"]
    reviewer_note: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=1000)]
        | None
    ) = None


class AbsenceResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    employee_name: str
    department: str | None
    absence_type: AbsenceType
    start_date: date
    end_date: date
    reason: str
    status: AbsenceStatus
    reviewer_note: str | None
    reviewed_at: datetime | None
    created_at: datetime


class AbsencePageResponse(BaseModel):
    items: list[AbsenceResponse]
    total: int
    page: int
    page_size: int
