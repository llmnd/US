from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select

from mamari_api.modules.agriculture.models import Harvest, Parcel
from mamari_api.modules.dashboard.schemas import (
    DashboardOverviewResponse,
    MonthlyProductionResponse,
    MonthlySalesResponse,
    RecentHarvestResponse,
)
from mamari_api.modules.identity.dependencies import (
    CurrentMembership,
    SessionDep,
    get_current_membership,
)
from mamari_api.modules.sales.models import OrderStatus, SalesOrder

router = APIRouter(prefix="/dashboard")
CurrentOrganizationDep = Annotated[
    CurrentMembership,
    Depends(get_current_membership),
]
MONTH_LABELS = (
    "Jan",
    "Fév",
    "Mar",
    "Avr",
    "Mai",
    "Jun",
    "Jul",
    "Aoû",
    "Sep",
    "Oct",
    "Nov",
    "Déc",
)
REVENUE_STATUSES = (
    OrderStatus.CONFIRMED.value,
    OrderStatus.PREPARING.value,
    OrderStatus.DELIVERED.value,
)


@router.get(
    "/overview",
    response_model=DashboardOverviewResponse,
    summary="Indicateurs réels du tableau de bord",
)
async def read_dashboard_overview(
    session: SessionDep,
    context: CurrentOrganizationDep,
    year: Annotated[int, Query(ge=2000, le=2100)] = date.today().year,
) -> DashboardOverviewResponse:
    year_start = date(year, 1, 1)
    year_end = date(year + 1, 1, 1)
    organization_id = context.organization.id
    order_filters = (
        SalesOrder.organization_id == organization_id,
        SalesOrder.order_date >= year_start,
        SalesOrder.order_date < year_end,
    )
    harvest_filters = (
        Harvest.organization_id == organization_id,
        Harvest.harvest_date >= year_start,
        Harvest.harvest_date < year_end,
    )

    revenue_by_month = [0] * 12
    sales_months = await session.execute(
        select(
            func.extract("month", SalesOrder.order_date),
            func.sum(SalesOrder.amount_fcfa),
        )
        .where(
            *order_filters,
            SalesOrder.status.in_(REVENUE_STATUSES),
        )
        .group_by(func.extract("month", SalesOrder.order_date))
    )
    for month_number, amount in sales_months:
        revenue_by_month[int(month_number) - 1] = int(amount or 0)

    active_order = SalesOrder.status != OrderStatus.CANCELLED.value
    revenue_order = SalesOrder.status.in_(REVENUE_STATUSES)
    sales_stats = (
        await session.execute(
            select(
                func.count(case((active_order, 1), else_=None)),
                func.count(
                    case(
                        (
                            SalesOrder.status.in_(
                                (OrderStatus.CONFIRMED.value, OrderStatus.PREPARING.value)
                            ),
                            1,
                        ),
                        else_=None,
                    )
                ),
                func.count(
                    func.distinct(
                        case(
                            (active_order, func.lower(SalesOrder.customer_name)),
                            else_=None,
                        )
                    )
                ),
                func.avg(case((revenue_order, SalesOrder.amount_fcfa), else_=None)),
            ).where(*order_filters)
        )
    ).one()
    recent_orders = await session.scalars(
        select(SalesOrder)
        .where(*order_filters)
        .order_by(SalesOrder.order_date.desc(), SalesOrder.created_at.desc())
        .limit(5)
    )

    production_by_month = [0.0] * 12
    harvest_months = await session.execute(
        select(
            func.extract("month", Harvest.harvest_date),
            func.sum(Harvest.quantity_kg),
        )
        .where(*harvest_filters)
        .group_by(func.extract("month", Harvest.harvest_date))
    )
    for month_number, quantity in harvest_months:
        production_by_month[int(month_number) - 1] = float(quantity or 0)

    production_stats = (
        await session.execute(
            select(
                func.coalesce(func.sum(Harvest.quantity_kg), 0),
                func.count(Harvest.id),
            ).where(*harvest_filters)
        )
    ).one()
    parcel_count = await session.scalar(
        select(func.count())
        .select_from(Parcel)
        .where(
            Parcel.organization_id == organization_id,
            Parcel.is_active.is_(True),
        )
    )
    recent_harvests = await session.execute(
        select(Harvest, Parcel)
        .join(
            Parcel,
            (Parcel.id == Harvest.parcel_id) & (Parcel.organization_id == Harvest.organization_id),
        )
        .where(*harvest_filters)
        .order_by(Harvest.harvest_date.desc(), Harvest.created_at.desc())
        .limit(5)
    )

    return DashboardOverviewResponse(
        year=year,
        revenue_fcfa=sum(revenue_by_month),
        order_count=sales_stats[0],
        pending_order_count=sales_stats[1],
        customer_count=sales_stats[2],
        average_order_fcfa=round(float(sales_stats[3] or 0)),
        production_kg=float(production_stats[0] or 0),
        harvest_count=production_stats[1],
        parcel_count=parcel_count or 0,
        monthly_revenue=[
            MonthlySalesResponse(
                month=label,
                month_number=index + 1,
                amount_fcfa=amount,
            )
            for index, (label, amount) in enumerate(
                zip(MONTH_LABELS, revenue_by_month, strict=True)
            )
        ],
        monthly_production_kg=[
            MonthlyProductionResponse(
                month=label,
                month_number=index + 1,
                quantity_kg=quantity,
            )
            for index, (label, quantity) in enumerate(
                zip(MONTH_LABELS, production_by_month, strict=True)
            )
        ],
        recent_orders=list(recent_orders.all()),
        recent_harvests=[
            RecentHarvestResponse(
                id=harvest.id,
                parcel_name=parcel.name,
                crop=parcel.crop,
                harvest_date=harvest.harvest_date,
                quantity_kg=float(harvest.quantity_kg),
            )
            for harvest, parcel in recent_harvests.all()
        ],
    )
