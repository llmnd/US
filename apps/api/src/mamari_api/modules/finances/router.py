from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, extract, func, literal, select, union_all

from mamari_api.modules.agriculture.models import (
    Campaign,
    Farm,
    FinanceTransaction,
)
from mamari_api.modules.finances.schemas import (
    FinanceSource,
    FinanceSourceSummaryResponse,
    FinanceSummaryResponse,
    FinanceTransactionPageResponse,
    FinanceTransactionResponse,
    FinanceType,
    MonthlyFinanceResponse,
)
from mamari_api.modules.human_resources.models import PayrollRecord
from mamari_api.modules.identity.dependencies import (
    CurrentMembership,
    SessionDep,
    get_current_membership,
)
from mamari_api.modules.identity.models import User
from mamari_api.modules.livestock.models import (
    LivestockAnimal,
    LivestockFacility,
    LivestockFinanceTransaction,
    LivestockGroup,
)

router = APIRouter(prefix="/finance")
CurrentOrganizationDep = Annotated[CurrentMembership, Depends(get_current_membership)]
MONTHS = (
    "Jan",
    "Fév",
    "Mar",
    "Avr",
    "Mai",
    "Juin",
    "Juil",
    "Août",
    "Sep",
    "Oct",
    "Nov",
    "Déc",
)


def _transaction_union(organization_id, include_payroll: bool):
    agriculture = (
        select(
            FinanceTransaction.id.label("id"),
            FinanceTransaction.organization_id.label("organization_id"),
            literal("agriculture").label("source"),
            FinanceTransaction.transaction_type.label("transaction_type"),
            FinanceTransaction.category.label("category"),
            FinanceTransaction.label.label("label"),
            FinanceTransaction.amount_fcfa.label("amount_fcfa"),
            FinanceTransaction.transaction_date.label("transaction_date"),
            Farm.name.label("location"),
            Campaign.name.label("detail"),
            FinanceTransaction.customer_name.label("counterparty"),
            FinanceTransaction.quantity.label("quantity"),
            FinanceTransaction.unit.label("unit"),
            FinanceTransaction.notes.label("notes"),
            FinanceTransaction.created_at.label("created_at"),
        )
        .join(
            Farm,
            (Farm.id == FinanceTransaction.farm_id)
            & (Farm.organization_id == FinanceTransaction.organization_id),
        )
        .outerjoin(
            Campaign,
            (Campaign.id == FinanceTransaction.campaign_id)
            & (Campaign.organization_id == FinanceTransaction.organization_id),
        )
        .where(FinanceTransaction.organization_id == organization_id)
    )
    animal_name = func.coalesce(LivestockAnimal.name, LivestockAnimal.tag_number)
    livestock = (
        select(
            LivestockFinanceTransaction.id.label("id"),
            LivestockFinanceTransaction.organization_id.label("organization_id"),
            literal("elevage").label("source"),
            LivestockFinanceTransaction.transaction_type.label("transaction_type"),
            LivestockFinanceTransaction.category.label("category"),
            LivestockFinanceTransaction.label.label("label"),
            LivestockFinanceTransaction.amount_fcfa.label("amount_fcfa"),
            LivestockFinanceTransaction.transaction_date.label("transaction_date"),
            func.coalesce(LivestockFacility.name, literal("Élevage")).label("location"),
            func.coalesce(animal_name, LivestockGroup.name).label("detail"),
            literal(None, type_=FinanceTransaction.customer_name.type).label("counterparty"),
            LivestockFinanceTransaction.quantity.label("quantity"),
            LivestockFinanceTransaction.unit.label("unit"),
            LivestockFinanceTransaction.notes.label("notes"),
            LivestockFinanceTransaction.created_at.label("created_at"),
        )
        .outerjoin(
            LivestockAnimal,
            (LivestockAnimal.id == LivestockFinanceTransaction.animal_id)
            & (LivestockAnimal.organization_id == LivestockFinanceTransaction.organization_id),
        )
        .outerjoin(
            LivestockGroup,
            (LivestockGroup.id == LivestockFinanceTransaction.group_id)
            & (LivestockGroup.organization_id == LivestockFinanceTransaction.organization_id),
        )
        .outerjoin(
            LivestockFacility,
            (LivestockFacility.id == LivestockFinanceTransaction.facility_id)
            & (LivestockFacility.organization_id == LivestockFinanceTransaction.organization_id),
        )
        .where(LivestockFinanceTransaction.organization_id == organization_id)
    )
    payroll = (
        select(
            PayrollRecord.id.label("id"),
            PayrollRecord.organization_id.label("organization_id"),
            literal("payroll").label("source"),
            literal("expense").label("transaction_type"),
            literal("salary").label("category"),
            (literal("Salaire - ") + User.full_name).label("label"),
            PayrollRecord.net_pay_fcfa.label("amount_fcfa"),
            PayrollRecord.paid_at.label("transaction_date"),
            literal("Ressources humaines").label("location"),
            literal("Paie").label("detail"),
            User.full_name.label("counterparty"),
            literal(None, type_=FinanceTransaction.quantity.type).label("quantity"),
            literal(None, type_=FinanceTransaction.unit.type).label("unit"),
            PayrollRecord.note.label("notes"),
            PayrollRecord.created_at.label("created_at"),
        )
        .join(User, User.id == PayrollRecord.user_id)
        .where(
            PayrollRecord.organization_id == organization_id,
            PayrollRecord.payment_status == "paid",
            PayrollRecord.paid_at.is_not(None),
            PayrollRecord.net_pay_fcfa > 0,
        )
    )
    sources = (agriculture, livestock, payroll) if include_payroll else (agriculture, livestock)
    return union_all(*sources).subquery("finance_transactions")


def _finance_filters(
    transactions,
    year: int,
    transaction_type: FinanceType | None,
    source: FinanceSource | None,
):
    filters = [
        transactions.c.transaction_date >= date(year, 1, 1),
        transactions.c.transaction_date < date(year + 1, 1, 1),
    ]
    if transaction_type is not None:
        filters.append(transactions.c.transaction_type == transaction_type)
    if source is not None:
        filters.append(transactions.c.source == source)
    return filters


@router.get("/transactions", response_model=FinanceTransactionPageResponse)
async def list_finance_transactions(
    session: SessionDep,
    context: CurrentOrganizationDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    year: Annotated[int, Query(ge=2000, le=2100)] = date.today().year,
    transaction_type: Annotated[FinanceType | None, Query(alias="type")] = None,
    source: FinanceSource | None = None,
) -> FinanceTransactionPageResponse:
    transactions = _transaction_union(
        context.organization.id,
        context.membership.role in {"owner", "admin"},
    )
    filters = _finance_filters(transactions, year, transaction_type, source)
    total = await session.scalar(select(func.count()).select_from(transactions).where(*filters))
    rows = await session.execute(
        select(transactions)
        .where(*filters)
        .order_by(
            transactions.c.transaction_date.desc(),
            transactions.c.created_at.desc(),
            transactions.c.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return FinanceTransactionPageResponse(
        items=[FinanceTransactionResponse.model_validate(row) for row in rows.mappings()],
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.get("/summary", response_model=FinanceSummaryResponse)
async def read_finance_summary(
    session: SessionDep,
    context: CurrentOrganizationDep,
    year: Annotated[int, Query(ge=2000, le=2100)] = date.today().year,
) -> FinanceSummaryResponse:
    transactions = _transaction_union(
        context.organization.id,
        context.membership.role in {"owner", "admin"},
    )
    year_filters = _finance_filters(transactions, year, None, None)
    source_rows = await session.execute(
        select(
            transactions.c.source,
            func.coalesce(
                func.sum(
                    case(
                        (transactions.c.transaction_type == "income", transactions.c.amount_fcfa),
                        else_=0,
                    )
                ),
                0,
            ).label("income_fcfa"),
            func.coalesce(
                func.sum(
                    case(
                        (transactions.c.transaction_type == "expense", transactions.c.amount_fcfa),
                        else_=0,
                    )
                ),
                0,
            ).label("expenses_fcfa"),
            func.count().label("transaction_count"),
        )
        .where(*year_filters)
        .group_by(transactions.c.source)
    )
    by_source = {
        row.source: FinanceSourceSummaryResponse(
            source=row.source,
            income_fcfa=row.income_fcfa,
            expenses_fcfa=row.expenses_fcfa,
            balance_fcfa=row.income_fcfa - row.expenses_fcfa,
            transaction_count=row.transaction_count,
        )
        for row in source_rows
    }
    source_summaries = [
        by_source.get(
            source,
            FinanceSourceSummaryResponse(
                source=source,
                income_fcfa=0,
                expenses_fcfa=0,
                balance_fcfa=0,
                transaction_count=0,
            ),
        )
        for source in ("agriculture", "elevage", "payroll")
    ]
    monthly_rows = await session.execute(
        select(
            extract("month", transactions.c.transaction_date).label("month_number"),
            func.coalesce(
                func.sum(
                    case(
                        (transactions.c.transaction_type == "income", transactions.c.amount_fcfa),
                        else_=0,
                    )
                ),
                0,
            ).label("income_fcfa"),
            func.coalesce(
                func.sum(
                    case(
                        (transactions.c.transaction_type == "expense", transactions.c.amount_fcfa),
                        else_=0,
                    )
                ),
                0,
            ).label("expenses_fcfa"),
        )
        .where(*year_filters)
        .group_by(extract("month", transactions.c.transaction_date))
    )
    monthly_values = {
        int(row.month_number): (row.income_fcfa, row.expenses_fcfa) for row in monthly_rows
    }
    monthly = [
        MonthlyFinanceResponse(
            month=label,
            month_number=index,
            income_fcfa=monthly_values.get(index, (0, 0))[0],
            expenses_fcfa=monthly_values.get(index, (0, 0))[1],
        )
        for index, label in enumerate(MONTHS, start=1)
    ]
    income = sum(item.income_fcfa for item in source_summaries)
    expenses = sum(item.expenses_fcfa for item in source_summaries)
    return FinanceSummaryResponse(
        year=year,
        income_fcfa=income,
        expenses_fcfa=expenses,
        balance_fcfa=income - expenses,
        transaction_count=sum(item.transaction_count for item in source_summaries),
        monthly=monthly,
        by_source=source_summaries,
    )
