import asyncio
import uuid
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload

from mamari_api.core.config import get_settings
from mamari_api.modules.agriculture.models import FinanceTransaction
from mamari_api.modules.identity.dependencies import (
    CurrentMembership,
    SessionDep,
    get_current_membership,
    require_roles,
)
from mamari_api.modules.identity.models import Organization
from mamari_api.modules.sales.models import (
    Customer,
    OrderStatus,
    Product,
    SalesOrder,
    SalesOrderItem,
)
from mamari_api.modules.sales.schemas import (
    CreateCustomerRequest,
    CreateOrderRequest,
    CreateStoreOrderRequest,
    CustomerPageResponse,
    CustomerResponse,
    ProductResponse,
    SalesOrderPageResponse,
    SalesOrderResponse,
    StoreProductPageResponse,
    UpdateCustomerRequest,
    UpdateOrderStatusRequest,
)

router = APIRouter()
CurrentOrganizationDep = Annotated[CurrentMembership, Depends(get_current_membership)]
CanManageSalesDep = Annotated[
    CurrentMembership,
    Depends(require_roles("owner", "admin", "manager")),
]
MAX_PRODUCT_PHOTO_BYTES = 5 * 1024 * 1024
PRODUCT_PHOTO_TYPES = {
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (
        ".webp",
        lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
    ),
}


@router.get(
    "/sales/customers",
    response_model=CustomerPageResponse,
    summary="Lister les clients de l'organisation",
)
async def list_customers(
    session: SessionDep,
    context: CurrentOrganizationDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(min_length=2, max_length=100)] = None,
) -> CustomerPageResponse:
    filters = [Customer.organization_id == context.organization.id]
    if search:
        normalized_search = f"%{search.strip()}%"
        filters.append(
            or_(
                Customer.name.ilike(normalized_search),
                Customer.company_name.ilike(normalized_search),
                Customer.phone.ilike(normalized_search),
                Customer.email.ilike(normalized_search),
            )
        )
    total = await session.scalar(select(func.count()).select_from(Customer).where(*filters))
    result = await session.scalars(
        select(Customer)
        .where(*filters)
        .order_by(Customer.name, Customer.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return CustomerPageResponse(
        items=list(result.all()),
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/sales/customers",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une fiche client",
)
async def create_customer(
    data: CreateCustomerRequest,
    session: SessionDep,
    context: CanManageSalesDep,
) -> Customer:
    customer = Customer(
        organization_id=context.organization.id,
        customer_type=data.customer_type,
        name=data.name,
        company_name=data.company_name,
        phone=data.phone,
        email=str(data.email) if data.email else None,
        address=data.address,
        city=data.city,
        notes=data.notes,
    )
    session.add(customer)
    await session.commit()
    await session.refresh(customer)
    return customer


@router.put(
    "/sales/customers/{customer_id}",
    response_model=CustomerResponse,
    summary="Modifier une fiche client",
)
async def update_customer(
    customer_id: uuid.UUID,
    data: UpdateCustomerRequest,
    session: SessionDep,
    context: CanManageSalesDep,
) -> Customer:
    customer = await session.scalar(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.organization_id == context.organization.id,
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Client introuvable.")
    customer.customer_type = data.customer_type
    customer.name = data.name
    customer.company_name = data.company_name
    customer.phone = data.phone
    customer.email = str(data.email) if data.email else None
    customer.address = data.address
    customer.city = data.city
    customer.notes = data.notes
    await session.commit()
    await session.refresh(customer)
    return customer


@router.delete(
    "/sales/customers/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une fiche client",
)
async def delete_customer(
    customer_id: uuid.UUID,
    session: SessionDep,
    context: CanManageSalesDep,
) -> None:
    customer = await session.scalar(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.organization_id == context.organization.id,
        )
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Client introuvable.")
    await session.execute(
        update(SalesOrder)
        .where(
            SalesOrder.customer_id == customer.id,
            SalesOrder.organization_id == context.organization.id,
        )
        .values(customer_id=None)
    )
    await session.execute(
        update(FinanceTransaction)
        .where(
            FinanceTransaction.customer_id == customer.id,
            FinanceTransaction.organization_id == context.organization.id,
        )
        .values(customer_id=None)
    )
    await session.delete(customer)
    await session.commit()


def _product_photo_path(organization_id: uuid.UUID, filename: str) -> Path:
    if Path(filename).name != filename or Path(filename).suffix not in {".jpg", ".png", ".webp"}:
        raise HTTPException(status_code=404, detail="Photo introuvable.")
    return get_settings().upload_directory / str(organization_id) / filename


async def _store_product_photo(
    organization_id: uuid.UUID,
    photo: UploadFile,
) -> tuple[str, Path]:
    content = await photo.read(MAX_PRODUCT_PHOTO_BYTES + 1)
    if not content:
        raise HTTPException(status_code=422, detail="Le fichier photo est vide.")
    if len(content) > MAX_PRODUCT_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="La photo ne doit pas dépasser 5 Mo.")
    photo_type = PRODUCT_PHOTO_TYPES.get(photo.content_type or "")
    if photo_type is None or not photo_type[1](content):
        raise HTTPException(
            status_code=415,
            detail="Format photo invalide. Utilisez une image JPEG, PNG ou WebP.",
        )
    filename = f"product-{uuid.uuid4().hex}{photo_type[0]}"
    path = _product_photo_path(organization_id, filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    await asyncio.to_thread(path.write_bytes, content)
    return filename, path


def _product_response(product: Product, *, public_photo: bool = False) -> ProductResponse:
    photo_path = (
        f"/store/products/{product.id}/photo"
        if public_photo
        else f"/sales/products/{product.id}/photo"
    )
    return ProductResponse(
        id=product.id,
        name=product.name,
        description=product.description,
        category=product.category,
        unit=product.unit,
        price_fcfa=product.price_fcfa,
        stock_quantity=product.stock_quantity,
        is_published=product.is_published,
        is_active=product.is_active,
        photo_url=photo_path if product.photo_filename else None,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


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


@router.get(
    "/sales/products",
    response_model=list[ProductResponse],
    summary="Lister les produits de l'organisation",
)
async def list_products(
    session: SessionDep,
    context: CurrentOrganizationDep,
) -> list[ProductResponse]:
    products = await session.scalars(
        select(Product)
        .where(Product.organization_id == context.organization.id)
        .order_by(Product.is_active.desc(), Product.created_at.desc())
    )
    return [_product_response(product) for product in products.all()]


@router.post(
    "/sales/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un produit",
)
async def create_product(
    session: SessionDep,
    context: CanManageSalesDep,
    name: Annotated[str, Form(min_length=2, max_length=160)],
    price_fcfa: Annotated[int, Form(gt=0, le=9_000_000_000_000_000)],
    stock_quantity: Annotated[int, Form(ge=0, le=2_000_000_000)],
    unit: Annotated[str, Form(min_length=1, max_length=40)] = "unité",
    description: Annotated[str | None, Form(max_length=4000)] = None,
    category: Annotated[str | None, Form(max_length=80)] = None,
    is_published: Annotated[bool, Form()] = False,
    photo: Annotated[UploadFile | None, File()] = None,
) -> ProductResponse:
    product = Product(
        organization_id=context.organization.id,
        name=name.strip(),
        description=description.strip() if description and description.strip() else None,
        category=category.strip() if category and category.strip() else None,
        unit=unit.strip(),
        price_fcfa=price_fcfa,
        stock_quantity=stock_quantity,
        is_published=is_published,
    )
    if len(product.name) < 2 or not product.unit:
        raise HTTPException(status_code=422, detail="Le nom et l’unité sont obligatoires.")
    photo_path = None
    if photo is not None:
        product.photo_filename, photo_path = await _store_product_photo(
            context.organization.id,
            photo,
        )
    session.add(product)
    try:
        await session.commit()
        await session.refresh(product)
    except SQLAlchemyError:
        await session.rollback()
        if photo_path is not None:
            photo_path.unlink(missing_ok=True)
        raise
    return _product_response(product)


@router.patch(
    "/sales/products/{product_id}",
    response_model=ProductResponse,
    summary="Modifier un produit",
)
async def update_product(
    product_id: uuid.UUID,
    session: SessionDep,
    context: CanManageSalesDep,
    name: Annotated[str, Form(min_length=2, max_length=160)],
    price_fcfa: Annotated[int, Form(gt=0, le=9_000_000_000_000_000)],
    stock_quantity: Annotated[int, Form(ge=0, le=2_000_000_000)],
    unit: Annotated[str, Form(min_length=1, max_length=40)],
    description: Annotated[str | None, Form(max_length=4000)] = None,
    category: Annotated[str | None, Form(max_length=80)] = None,
    is_published: Annotated[bool, Form()] = False,
    is_active: Annotated[bool, Form()] = True,
    photo: Annotated[UploadFile | None, File()] = None,
    remove_photo: Annotated[bool, Form()] = False,
) -> ProductResponse:
    product = await session.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.organization_id == context.organization.id,
        )
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Produit introuvable.")
    if photo is not None and remove_photo:
        raise HTTPException(
            status_code=422,
            detail="Choisissez une nouvelle photo ou la suppression, pas les deux.",
        )
    name = name.strip()
    unit = unit.strip()
    if len(name) < 2 or not unit:
        raise HTTPException(status_code=422, detail="Le nom et l’unité sont obligatoires.")

    previous_filename = product.photo_filename
    new_photo_path = None
    if photo is not None:
        product.photo_filename, new_photo_path = await _store_product_photo(
            context.organization.id,
            photo,
        )
    elif remove_photo:
        product.photo_filename = None
    product.name = name
    product.description = description.strip() if description and description.strip() else None
    product.category = category.strip() if category and category.strip() else None
    product.unit = unit
    product.price_fcfa = price_fcfa
    product.stock_quantity = stock_quantity
    product.is_published = is_published
    product.is_active = is_active
    try:
        await session.commit()
        await session.refresh(product)
    except SQLAlchemyError:
        await session.rollback()
        if new_photo_path is not None:
            new_photo_path.unlink(missing_ok=True)
        raise
    if previous_filename and product.photo_filename != previous_filename:
        _product_photo_path(context.organization.id, previous_filename).unlink(missing_ok=True)
    return _product_response(product)


@router.get(
    "/sales/products/{product_id}/photo",
    response_class=FileResponse,
    include_in_schema=False,
)
async def read_product_photo(
    product_id: uuid.UUID,
    session: SessionDep,
    context: CurrentOrganizationDep,
) -> FileResponse:
    product = await session.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.organization_id == context.organization.id,
        )
    )
    if product is None or product.photo_filename is None:
        raise HTTPException(status_code=404, detail="Photo du produit introuvable.")
    path = _product_photo_path(context.organization.id, product.photo_filename)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier photo introuvable sur le serveur.")
    return FileResponse(path, headers={"Cache-Control": "private, max-age=3600"})


@router.get(
    "/store/products",
    response_model=StoreProductPageResponse,
    summary="Consulter le catalogue public",
)
async def list_store_products(session: SessionDep) -> StoreProductPageResponse:
    organization = await session.scalar(
        select(Organization).where(
            Organization.slug == get_settings().public_store_slug,
            Organization.is_active.is_(True),
        )
    )
    if organization is None:
        raise HTTPException(status_code=404, detail="La boutique Mamari est indisponible.")
    products = await session.scalars(
        select(Product)
        .where(
            Product.organization_id == organization.id,
            Product.is_active.is_(True),
            Product.is_published.is_(True),
        )
        .order_by(Product.category, Product.name)
    )
    return StoreProductPageResponse(
        organization_name=organization.name,
        items=[_product_response(product, public_photo=True) for product in products.all()],
    )


@router.get(
    "/store/products/{product_id}/photo",
    response_class=FileResponse,
    include_in_schema=False,
)
async def read_store_product_photo(
    product_id: uuid.UUID,
    session: SessionDep,
) -> FileResponse:
    product = await session.scalar(
        select(Product)
        .join(Organization, Product.organization_id == Organization.id)
        .where(
            Product.id == product_id,
            Product.is_active.is_(True),
            Product.is_published.is_(True),
            Organization.slug == get_settings().public_store_slug,
            Organization.is_active.is_(True),
        )
    )
    if product is None or product.photo_filename is None:
        raise HTTPException(status_code=404, detail="Photo du produit introuvable.")
    path = _product_photo_path(product.organization_id, product.photo_filename)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier photo introuvable sur le serveur.")
    return FileResponse(path, headers={"Cache-Control": "public, max-age=3600"})


@router.post(
    "/store/orders",
    response_model=SalesOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Passer une commande dans la boutique",
)
async def create_store_order(
    data: CreateStoreOrderRequest,
    session: SessionDep,
) -> SalesOrderResponse:
    organization = await session.scalar(
        select(Organization).where(
            Organization.slug == get_settings().public_store_slug,
            Organization.is_active.is_(True),
        )
    )
    if organization is None:
        raise HTTPException(status_code=404, detail="La boutique Mamari est indisponible.")

    customer = await session.scalar(
        select(Customer).where(
            Customer.organization_id == organization.id,
            Customer.phone == data.customer_phone,
        )
    )
    if customer is None:
        customer = Customer(
            organization_id=organization.id,
            customer_type="individual",
            name=data.customer_name,
            phone=data.customer_phone,
            email=str(data.customer_email) if data.customer_email else None,
            address=data.delivery_address,
        )
        session.add(customer)
        await session.flush()
    else:
        customer.name = data.customer_name
        if data.customer_email:
            customer.email = str(data.customer_email)
        if data.delivery_address:
            customer.address = data.delivery_address

    quantities: dict[uuid.UUID, int] = {}
    for item in data.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity
    if any(quantity > 999 for quantity in quantities.values()):
        raise HTTPException(
            status_code=422,
            detail="La quantité maximale par produit est dépassée.",
        )

    products = await session.scalars(
        select(Product)
        .where(
            Product.organization_id == organization.id,
            Product.id.in_(quantities),
            Product.is_active.is_(True),
            Product.is_published.is_(True),
        )
        .with_for_update()
    )
    product_by_id = {product.id: product for product in products.all()}
    if len(product_by_id) != len(quantities):
        raise HTTPException(
            status_code=409,
            detail="Un ou plusieurs produits ne sont plus disponibles.",
        )

    amount_fcfa = sum(
        product_by_id[product_id].price_fcfa * quantity
        for product_id, quantity in quantities.items()
    )
    if amount_fcfa > 9_000_000_000_000_000:
        raise HTTPException(
            status_code=422,
            detail="Le montant total de la commande est trop élevé.",
        )

    order_items: list[SalesOrderItem] = []
    for product_id, quantity in quantities.items():
        product = product_by_id[product_id]
        stock_update = await session.execute(
            update(Product)
            .where(
                Product.id == product_id,
                Product.organization_id == organization.id,
                Product.is_active.is_(True),
                Product.is_published.is_(True),
                Product.stock_quantity >= quantity,
            )
            .values(stock_quantity=Product.stock_quantity - quantity)
        )
        if stock_update.rowcount != 1:
            await session.rollback()
            raise HTTPException(
                status_code=409,
                detail=f"Le stock de « {product.name} » vient de changer.",
            )
        order_items.append(
            SalesOrderItem(
                product_id=product.id,
                product_name=product.name,
                unit=product.unit,
                quantity=quantity,
                unit_price_fcfa=product.price_fcfa,
            )
        )

    order_id = uuid.uuid4()
    order = SalesOrder(
        id=order_id,
        organization_id=organization.id,
        created_by_id=None,
        reference=f"CMD-{date.today().year}-{order_id.hex[:8].upper()}",
        customer_id=customer.id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_email=str(data.customer_email) if data.customer_email else None,
        delivery_address=data.delivery_address,
        order_date=date.today(),
        amount_fcfa=amount_fcfa,
        status=OrderStatus.PENDING.value,
        items=order_items,
    )
    session.add(order)
    try:
        await session.commit()
    except SQLAlchemyError:
        await session.rollback()
        raise
    saved_order = await session.scalar(
        select(SalesOrder).options(selectinload(SalesOrder.items)).where(SalesOrder.id == order.id)
    )
    if saved_order is None:
        raise HTTPException(status_code=500, detail="La commande enregistrée est introuvable.")
    return SalesOrderResponse.model_validate(saved_order)


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
    customer = None
    if data.customer_id is not None:
        customer = await session.scalar(
            select(Customer).where(
                Customer.id == data.customer_id,
                Customer.organization_id == context.organization.id,
            )
        )
        if customer is None:
            raise HTTPException(status_code=404, detail="Client introuvable.")
    customer_name = customer.name if customer else data.customer_name
    if customer_name is None:
        raise HTTPException(status_code=422, detail="Sélectionnez un client.")
    order_id = uuid.uuid4()
    order = SalesOrder(
        id=order_id,
        organization_id=context.organization.id,
        created_by_id=context.user.id,
        reference=f"CMD-{date.today().year}-{order_id.hex[:8].upper()}",
        customer_id=customer.id if customer else None,
        customer_name=customer_name,
        customer_phone=customer.phone if customer else None,
        customer_email=customer.email if customer else None,
        delivery_address=customer.address if customer else None,
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
    if order.status == OrderStatus.CANCELLED.value and data.status != OrderStatus.CANCELLED.value:
        raise HTTPException(
            status_code=409,
            detail="Une commande annulée ne peut pas être réactivée.",
        )
    if data.status == OrderStatus.CANCELLED.value and order.status != OrderStatus.CANCELLED.value:
        for item in order.items:
            if item.product_id is not None:
                await session.execute(
                    update(Product)
                    .where(
                        Product.id == item.product_id,
                        Product.organization_id == context.organization.id,
                    )
                    .values(stock_quantity=Product.stock_quantity + item.quantity)
                )
    order.status = data.status
    await session.commit()
    await session.refresh(order)
    return order
