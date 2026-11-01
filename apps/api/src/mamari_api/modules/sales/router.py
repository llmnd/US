import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select

from mamari_api.modules.identity.dependencies import (
    CurrentMembership,
    SessionDep,
    get_current_membership,
    require_roles,
)
from mamari_api.modules.sales.models import OrderStatus, SalesOrder
from mamari_api.modules.sales.schemas import (
    CreateOrderRequest,
    SalesOrderPageResponse,
    SalesOrderResponse,
    UpdateOrderStatusRequest,
)

router = APIRouter()
CurrentOrganizationDep = Annotated[CurrentMembership, Depends(get_current_membership)]
CanManageSalesDep = Annotated[
    CurrentMembership,
    Depends(require_roles("owner", "admin", "manager", "operator")),
]


@router.get(
    "/sales/orders",
    response_model=SalesOrderPageResponse,
    summary="Lister les commandes de l'organisation",
)
async def list_orders(
    session: SessionDep,
    context: CurrentOrganizationDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    status_filter: Annotated[OrderStatus | None, Query(alias="status")] = None,
) -> SalesOrderPageResponse:
    filters = [SalesOrder.organization_id == context.organization.id]
    if search is not None:
        normalized_search = search.strip()
        if normalized_search:
            contains_search = f"%{normalized_search}%"
            filters.append(
                or_(
                    SalesOrder.customer_name.ilike(contains_search),
                    SalesOrder.reference.ilike(contains_search),
                )
            )
    if status_filter is not None:
        filters.append(SalesOrder.status == status_filter.value)

    total = await session.scalar(select(func.count()).select_from(SalesOrder).where(*filters))
    result = await session.scalars(
        select(SalesOrder)
        .where(*filters)
        .order_by(SalesOrder.order_date.desc(), SalesOrder.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return SalesOrderPageResponse(
        items=list(result.all()),
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/sales/orders",
    response_model=SalesOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enregistrer une commande",
)
async def create_order(
    data: CreateOrderRequest,
    session: SessionDep,
    context: CanManageSalesDep,
) -> SalesOrder:
    order_id = uuid.uuid4()
    order = SalesOrder(
        id=order_id,
        organization_id=context.organization.id,
        created_by_id=context.user.id,
        reference=f"CMD-{date.today().year}-{order_id.hex[:8].upper()}",
        customer_name=data.customer_name,
        order_date=data.order_date,
        amount_fcfa=data.amount_fcfa,
        status=OrderStatus.CONFIRMED.value,
    )
    session.add(order)
    await session.commit()
    await session.refresh(order)
    return order


@router.patch(
    "/sales/orders/{order_id}/status",
    response_model=SalesOrderResponse,
    summary="Modifier le statut d'une commande",
)
async def update_order_status(
    order_id: uuid.UUID,
    data: UpdateOrderStatusRequest,
    session: SessionDep,
    context: CanManageSalesDep,
) -> SalesOrder:
    order = await session.scalar(
        select(SalesOrder).where(
            SalesOrder.id == order_id,
            SalesOrder.organization_id == context.organization.id,
        )
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Commande introuvable.")
    order.status = data.status
    await session.commit()
    await session.refresh(order)
    return order
