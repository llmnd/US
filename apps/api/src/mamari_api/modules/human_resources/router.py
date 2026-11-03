import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError

from mamari_api.modules.human_resources.models import AbsenceRequest, PayrollRecord
from mamari_api.modules.human_resources.schemas import (
    AbsencePageResponse,
    AbsenceResponse,
    CreateAbsenceRequest,
    CreatePayrollRecordRequest,
    EmploymentStatus,
    HumanResourceEmployeePageResponse,
    HumanResourceEmployeeResponse,
    HumanResourceSummaryResponse,
    PayrollRecordPageResponse,
    PayrollRecordResponse,
    ReviewAbsenceRequest,
    UpdateHumanResourceEmployeeRequest,
)
from mamari_api.modules.identity.dependencies import (
    CurrentMembership,
    SessionDep,
    get_current_membership,
    require_roles,
)
from mamari_api.modules.identity.models import Membership, User

router = APIRouter(prefix="/human-resources")
CanManageHumanResourcesDep = Annotated[
    CurrentMembership,
    Depends(require_roles("owner", "admin", "manager")),
]
CurrentHumanResourcesMemberDep = Annotated[CurrentMembership, Depends(get_current_membership)]
CanManagePayrollDep = Annotated[
    CurrentMembership,
    Depends(require_roles("owner", "admin")),
]


def _employee_response(
    user: User,
    membership: Membership,
) -> HumanResourceEmployeeResponse:
    return HumanResourceEmployeeResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=membership.role,
        phone=membership.phone,
        photo_url=(f"/organizations/users/{user.id}/photo" if membership.photo_filename else None),
        is_active=membership.is_active and user.is_active,
        job_title=membership.job_title,
        department=membership.department,
        hire_date=membership.hire_date,
        employment_type=membership.employment_type,
        employment_status=membership.employment_status,
    )


def _payroll_response(
    record: PayrollRecord,
    user: User,
    membership: Membership,
) -> PayrollRecordResponse:
    return PayrollRecordResponse(
        id=record.id,
        user_id=user.id,
        employee_name=user.full_name,
        department=membership.department,
        pay_year=record.pay_year,
        pay_month=record.pay_month,
        gross_pay_fcfa=record.gross_pay_fcfa,
        bonus_fcfa=record.bonus_fcfa,
        deductions_fcfa=record.deductions_fcfa,
        net_pay_fcfa=record.net_pay_fcfa,
        payment_status=record.payment_status,
        paid_at=record.paid_at,
        note=record.note,
        created_at=record.created_at,
    )


def _absence_response(
    absence: AbsenceRequest,
    user: User,
    membership: Membership,
) -> AbsenceResponse:
    return AbsenceResponse(
        id=absence.id,
        user_id=user.id,
        employee_name=user.full_name,
        department=membership.department,
        absence_type=absence.absence_type,
        start_date=absence.start_date,
        end_date=absence.end_date,
        reason=absence.reason,
        status=absence.status,
        reviewer_note=absence.reviewer_note,
        reviewed_at=absence.reviewed_at,
        created_at=absence.created_at,
    )


@router.get("/employees", response_model=HumanResourceEmployeePageResponse)
async def list_employees(
    session: SessionDep,
    context: CanManageHumanResourcesDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    search: Annotated[str | None, Query(min_length=2, max_length=100)] = None,
    status: EmploymentStatus | None = None,
) -> HumanResourceEmployeePageResponse:
    base_filters = [Membership.organization_id == context.organization.id]
    filters = list(base_filters)
    if status is not None:
        filters.append(Membership.employment_status == status)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                User.full_name.ilike(pattern),
                User.username.ilike(pattern),
                Membership.department.ilike(pattern),
                Membership.job_title.ilike(pattern),
            )
        )

    total = await session.scalar(
        select(func.count())
        .select_from(Membership)
        .join(User, User.id == Membership.user_id)
        .where(*filters)
    )
    result = await session.execute(
        select(User, Membership)
        .join(Membership, Membership.user_id == User.id)
        .where(*filters)
        .order_by(
            case(
                (Membership.employment_status == "active", 0),
                (Membership.employment_status == "on_leave", 1),
                else_=2,
            ),
            User.full_name,
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    summary_row = await session.execute(
        select(
            func.count().label("total"),
            func.sum(case((Membership.employment_status == "active", 1), else_=0)).label("active"),
            func.sum(case((Membership.employment_status == "on_leave", 1), else_=0)).label(
                "on_leave"
            ),
            func.sum(case((Membership.employment_status == "ended", 1), else_=0)).label("ended"),
        )
        .select_from(Membership)
        .where(*base_filters)
    )
    summary = summary_row.one()
    return HumanResourceEmployeePageResponse(
        items=[_employee_response(user, membership) for user, membership in result.all()],
        total=total or 0,
        page=page,
        page_size=page_size,
        summary=HumanResourceSummaryResponse(
            total=summary.total or 0,
            active=summary.active or 0,
            on_leave=summary.on_leave or 0,
            ended=summary.ended or 0,
        ),
    )


@router.patch("/employees/{user_id}", response_model=HumanResourceEmployeeResponse)
async def update_employee(
    user_id: uuid.UUID,
    data: UpdateHumanResourceEmployeeRequest,
    session: SessionDep,
    context: CanManageHumanResourcesDep,
) -> HumanResourceEmployeeResponse:
    result = await session.execute(
        select(User, Membership)
        .join(Membership, Membership.user_id == User.id)
        .where(
            User.id == user_id,
            Membership.organization_id == context.organization.id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Collaborateur introuvable.")

    user, membership = row
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(membership, field, value)
    await session.commit()
    await session.refresh(membership)
    return _employee_response(user, membership)


@router.get("/payroll", response_model=PayrollRecordPageResponse)
async def list_payroll_records(
    session: SessionDep,
    context: CurrentHumanResourcesMemberDep,
    year: Annotated[int, Query(ge=2000, le=2100)],
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PayrollRecordPageResponse:
    filters = [
        PayrollRecord.organization_id == context.organization.id,
        PayrollRecord.pay_year == year,
    ]
    if month is not None:
        filters.append(PayrollRecord.pay_month == month)
    if context.membership.role not in {"owner", "admin"}:
        filters.append(PayrollRecord.user_id == context.user.id)

    total = await session.scalar(select(func.count()).select_from(PayrollRecord).where(*filters))
    rows = await session.execute(
        select(PayrollRecord, User, Membership)
        .join(User, User.id == PayrollRecord.user_id)
        .join(
            Membership,
            (Membership.user_id == PayrollRecord.user_id)
            & (Membership.organization_id == PayrollRecord.organization_id),
        )
        .where(*filters)
        .order_by(PayrollRecord.pay_year.desc(), PayrollRecord.pay_month.desc(), User.full_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return PayrollRecordPageResponse(
        items=[_payroll_response(record, user, member) for record, user, member in rows.all()],
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.post("/payroll", response_model=PayrollRecordResponse, status_code=201)
async def create_payroll_record(
    data: CreatePayrollRecordRequest,
    session: SessionDep,
    context: CanManagePayrollDep,
) -> PayrollRecordResponse:
    result = await session.execute(
        select(User, Membership)
        .join(Membership, Membership.user_id == User.id)
        .where(
            User.id == data.user_id,
            User.is_active.is_(True),
            Membership.organization_id == context.organization.id,
            Membership.is_active.is_(True),
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Collaborateur actif introuvable.")
    user, membership = row
    record = PayrollRecord(
        organization_id=context.organization.id,
        user_id=user.id,
        created_by_id=context.user.id,
        pay_year=data.pay_year,
        pay_month=data.pay_month,
        gross_pay_fcfa=data.gross_pay_fcfa,
        bonus_fcfa=data.bonus_fcfa,
        deductions_fcfa=data.deductions_fcfa,
        net_pay_fcfa=data.gross_pay_fcfa + data.bonus_fcfa - data.deductions_fcfa,
        note=data.note,
    )
    session.add(record)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Une fiche de paie existe déjà pour ce membre et cette période.",
        ) from None
    await session.refresh(record)
    return _payroll_response(record, user, membership)


@router.post("/payroll/{record_id}/mark-paid", response_model=PayrollRecordResponse)
async def mark_payroll_paid(
    record_id: uuid.UUID,
    session: SessionDep,
    context: CanManagePayrollDep,
) -> PayrollRecordResponse:
    result = await session.execute(
        select(PayrollRecord, User, Membership)
        .join(User, User.id == PayrollRecord.user_id)
        .join(
            Membership,
            (Membership.user_id == PayrollRecord.user_id)
            & (Membership.organization_id == PayrollRecord.organization_id),
        )
        .where(
            PayrollRecord.id == record_id,
            PayrollRecord.organization_id == context.organization.id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Fiche de paie introuvable.")
    record, user, membership = row
    if record.payment_status == "pending":
        record.payment_status = "paid"
        record.paid_at = date.today()
        await session.commit()
        await session.refresh(record)
    return _payroll_response(record, user, membership)


@router.get("/absences", response_model=AbsencePageResponse)
async def list_absences(
    session: SessionDep,
    context: CurrentHumanResourcesMemberDep,
    status: Annotated[str | None, Query(pattern="^(pending|approved|rejected|cancelled)$")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AbsencePageResponse:
    filters = [AbsenceRequest.organization_id == context.organization.id]
    if context.membership.role not in {"owner", "admin", "manager"}:
        filters.append(AbsenceRequest.user_id == context.user.id)
    if status is not None:
        filters.append(AbsenceRequest.status == status)
    total = await session.scalar(select(func.count()).select_from(AbsenceRequest).where(*filters))
    rows = await session.execute(
        select(AbsenceRequest, User, Membership)
        .join(User, User.id == AbsenceRequest.user_id)
        .join(
            Membership,
            (Membership.user_id == AbsenceRequest.user_id)
            & (Membership.organization_id == AbsenceRequest.organization_id),
        )
        .where(*filters)
        .order_by(AbsenceRequest.start_date.desc(), AbsenceRequest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return AbsencePageResponse(
        items=[_absence_response(absence, user, member) for absence, user, member in rows.all()],
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.post("/absences", response_model=AbsenceResponse, status_code=201)
async def create_absence_request(
    data: CreateAbsenceRequest,
    session: SessionDep,
    context: CurrentHumanResourcesMemberDep,
) -> AbsenceResponse:
    if context.membership.role not in {"owner", "admin", "manager", "operator"}:
        raise HTTPException(
            status_code=403,
            detail="Votre rôle ne permet pas de demander une absence.",
        )
    if context.membership.employment_status != "active":
        raise HTTPException(
            status_code=403,
            detail="Seuls les membres en activité peuvent demander une absence.",
        )
    overlap = await session.scalar(
        select(AbsenceRequest.id).where(
            AbsenceRequest.organization_id == context.organization.id,
            AbsenceRequest.user_id == context.user.id,
            AbsenceRequest.status.in_(("pending", "approved")),
            AbsenceRequest.start_date <= data.end_date,
            AbsenceRequest.end_date >= data.start_date,
        )
    )
    if overlap is not None:
        raise HTTPException(
            status_code=409,
            detail="Une demande en attente ou approuvée chevauche déjà ces dates.",
        )

    absence = AbsenceRequest(
        organization_id=context.organization.id,
        user_id=context.user.id,
        absence_type=data.absence_type,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
    )
    session.add(absence)
    await session.commit()
    await session.refresh(absence)
    return _absence_response(absence, context.user, context.membership)


@router.patch("/absences/{absence_id}", response_model=AbsenceResponse)
async def review_absence_request(
    absence_id: uuid.UUID,
    data: ReviewAbsenceRequest,
    session: SessionDep,
    context: CanManageHumanResourcesDep,
) -> AbsenceResponse:
    result = await session.execute(
        select(AbsenceRequest, User, Membership)
        .join(User, User.id == AbsenceRequest.user_id)
        .join(
            Membership,
            (Membership.user_id == AbsenceRequest.user_id)
            & (Membership.organization_id == AbsenceRequest.organization_id),
        )
        .where(
            AbsenceRequest.id == absence_id,
            AbsenceRequest.organization_id == context.organization.id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Demande d’absence introuvable.")
    absence, user, membership = row
    if absence.status != "pending":
        raise HTTPException(status_code=409, detail="Cette demande a déjà été traitée.")
    absence.status = data.status
    absence.reviewer_note = data.reviewer_note
    absence.reviewed_by_id = context.user.id
    absence.reviewed_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(absence)
    return _absence_response(absence, user, membership)


@router.post("/absences/{absence_id}/cancel", response_model=AbsenceResponse)
async def cancel_absence_request(
    absence_id: uuid.UUID,
    session: SessionDep,
    context: CurrentHumanResourcesMemberDep,
) -> AbsenceResponse:
    result = await session.execute(
        select(AbsenceRequest, User, Membership)
        .join(User, User.id == AbsenceRequest.user_id)
        .join(
            Membership,
            (Membership.user_id == AbsenceRequest.user_id)
            & (Membership.organization_id == AbsenceRequest.organization_id),
        )
        .where(
            AbsenceRequest.id == absence_id,
            AbsenceRequest.organization_id == context.organization.id,
            AbsenceRequest.user_id == context.user.id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Demande d’absence introuvable.")
    absence, user, membership = row
    if absence.status != "pending":
        raise HTTPException(
            status_code=409,
            detail="Seules les demandes en attente peuvent être annulées.",
        )
    absence.status = "cancelled"
    await session.commit()
    await session.refresh(absence)
    return _absence_response(absence, user, membership)
