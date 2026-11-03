import uuid
from datetime import date
from decimal import ROUND_FLOOR, Decimal

from fastapi import HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from mamari_api.modules.sales.models import Product
from mamari_api.modules.stocks.models import StockItem, StockMovement


async def get_stock_balance(
    session: AsyncSession,
    organization_id: uuid.UUID,
    stock_item_id: uuid.UUID,
) -> Decimal:
    balance = await session.scalar(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (StockMovement.direction == "in", StockMovement.quantity),
                        else_=-StockMovement.quantity,
                    )
                ),
                0,
            )
        ).where(
            StockMovement.organization_id == organization_id,
            StockMovement.stock_item_id == stock_item_id,
        )
    )
    return Decimal(balance or 0)


async def record_stock_movement(
    session: AsyncSession,
    *,
    organization_id: uuid.UUID,
    stock_item: StockItem,
    movement_type: str,
    direction: str,
    quantity: Decimal,
    movement_date: date,
    created_by_id: uuid.UUID | None,
    note: str | None = None,
    reference_type: str | None = None,
    reference_id: uuid.UUID | None = None,
    transfer_id: uuid.UUID | None = None,
) -> StockMovement:
    if reference_type is not None and reference_id is not None:
        existing = await session.scalar(
            select(StockMovement).where(
                StockMovement.organization_id == organization_id,
                StockMovement.reference_type == reference_type,
                StockMovement.reference_id == reference_id,
            )
        )
        if existing is not None:
            return existing

    quantity = Decimal(quantity)
    if direction == "out":
        current_balance = await get_stock_balance(session, organization_id, stock_item.id)
        if current_balance < quantity:
            raise HTTPException(
                status_code=409,
                detail=f"Stock insuffisant pour « {stock_item.name} » à {stock_item.location}.",
            )

    movement = StockMovement(
        organization_id=organization_id,
        stock_item_id=stock_item.id,
        created_by_id=created_by_id,
        movement_type=movement_type,
        direction=direction,
        quantity=quantity,
        movement_date=movement_date,
        reference_type=reference_type,
        reference_id=reference_id,
        transfer_id=transfer_id,
        note=note,
    )
    session.add(movement)
    await session.flush()
    await synchronize_product_stock(session, organization_id, stock_item)
    return movement


async def synchronize_product_stock(
    session: AsyncSession,
    organization_id: uuid.UUID,
    stock_item: StockItem | None = None,
    *,
    product_id: uuid.UUID | None = None,
) -> None:
    linked_product_id = product_id or (stock_item.product_id if stock_item is not None else None)
    if linked_product_id is None:
        return
    product = await session.scalar(
        select(Product)
        .where(
            Product.id == linked_product_id,
            Product.organization_id == organization_id,
        )
        .with_for_update()
    )
    if product is None:
        return
    balance = await session.scalar(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (StockMovement.direction == "in", StockMovement.quantity),
                        else_=-StockMovement.quantity,
                    )
                ),
                0,
            )
        )
        .select_from(StockMovement)
        .join(
            StockItem,
            (StockItem.id == StockMovement.stock_item_id)
            & (StockItem.organization_id == StockMovement.organization_id),
        )
        .where(
            StockItem.organization_id == organization_id,
            StockItem.product_id == linked_product_id,
        )
    )
    balance = Decimal(balance or 0)
    product.stock_quantity = max(0, int(balance.to_integral_value(rounding=ROUND_FLOOR)))


async def get_or_create_production_item(
    session: AsyncSession,
    *,
    organization_id: uuid.UUID,
    source: str,
    name: str,
    unit: str,
    location: str,
) -> StockItem:
    candidates = await session.scalars(
        select(StockItem)
        .where(
            StockItem.organization_id == organization_id,
            StockItem.source == source,
            StockItem.name == name,
            StockItem.unit == unit,
        )
        .order_by(StockItem.created_at)
    )
    items = list(candidates.all())
    item = next((candidate for candidate in items if candidate.location == location), None)
    if item is not None:
        return item
    item = StockItem(
        organization_id=organization_id,
        source=source,
        name=name,
        unit=unit,
        location=location,
    )
    session.add(item)
    await session.flush()
    return item
