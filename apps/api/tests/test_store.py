import base64
from types import SimpleNamespace

import pytest
from httpx import AsyncClient


async def admin_session(client: AsyncClient) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "mamari", "password": "passer123m"},
    )
    assert response.status_code == 200
    return response.json()["memberships"][0]["organization_id"]


@pytest.mark.asyncio
async def test_public_store_checkout_creates_order_and_reserves_stock(
    client: AsyncClient,
) -> None:
    organization_id = await admin_session(client)
    headers = {"X-Organization-ID": organization_id}
    product = await client.post(
        "/api/v1/sales/products",
        headers=headers,
        data={
            "name": "Miel de saison",
            "description": "Miel récolté localement.",
            "category": "Épicerie",
            "unit": "pot",
            "price_fcfa": "3500",
            "stock_quantity": "8",
            "is_published": "true",
        },
    )
    assert product.status_code == 201
    product_id = product.json()["id"]

    client.cookies.clear()
    catalog = await client.get("/api/v1/store/products")
    assert catalog.status_code == 200
    assert catalog.json()["organization_name"] == "Mamari"
    assert [item["id"] for item in catalog.json()["items"]] == [product_id]

    registration = await client.post(
        "/api/v1/auth/customer/register",
        json={
            "full_name": "Aminata Diallo",
            "phone": "+221 77 123 45 67",
            "email": "aminata@example.com",
            "password": "secret123",
        },
    )
    assert registration.status_code == 201
    assert registration.json()["customer_account"] is True

    checkout = await client.post(
        "/api/v1/store/orders",
        json={
            "delivery_address": "Dakar, Sénégal",
            "items": [
                {"product_id": product_id, "quantity": 2},
                {"product_id": product_id, "quantity": 1},
            ],
        },
    )
    assert checkout.status_code == 201
    order = checkout.json()
    assert order["customer_id"]
    assert order["customer_name"] == "Aminata Diallo"
    assert order["customer_phone"] == "+221 77 123 45 67"
    assert order["customer_email"] == "aminata@example.com"
    assert order["delivery_address"] == "Dakar, Sénégal"
    assert order["amount_fcfa"] == 10_500
    assert order["status"] == "pending"
    assert order["items"] == [
        {
            "product_id": product_id,
            "product_name": "Miel de saison",
            "unit": "pot",
            "quantity": 3,
            "unit_price_fcfa": 3500,
        }
    ]

    await admin_session(client)
    customer_page = await client.get("/api/v1/sales/customers", headers=headers)
    assert customer_page.status_code == 200
    assert customer_page.json()["total"] == 1
    assert customer_page.json()["items"][0]["id"] == order["customer_id"]
    customer_purchases = await client.get(
        f"/api/v1/sales/customers/{order['customer_id']}/orders",
        headers=headers,
    )
    assert customer_purchases.status_code == 200
    assert [item["id"] for item in customer_purchases.json()["items"]] == [order["id"]]
    customer_transactions = await client.get(
        f"/api/v1/sales/customers/{order['customer_id']}/transactions",
        headers=headers,
    )
    assert customer_transactions.status_code == 200
    assert customer_transactions.json() == []
    assert customer_page.json()["items"][0]["has_account"] is True
    sales_orders = await client.get("/api/v1/sales/orders", headers=headers)
    assert sales_orders.status_code == 200
    assert sales_orders.json()["items"][0]["id"] == order["id"]
    dashboard = await client.get("/api/v1/dashboard/overview", headers=headers)
    assert dashboard.status_code == 200
    assert dashboard.json()["pending_order_count"] == 1
    assert dashboard.json()["revenue_fcfa"] == 0

    customer_login = await client.post(
        "/api/v1/auth/login",
        json={"username": "AMINATA@example.com", "password": "secret123"},
    )
    assert customer_login.status_code == 200
    customer_orders = await client.get("/api/v1/store/my-orders")
    assert customer_orders.status_code == 200
    assert [item["id"] for item in customer_orders.json()["items"]] == [order["id"]]
    second_checkout = await client.post(
        "/api/v1/store/orders",
        json={
            "delivery_address": "Dakar, Sénégal",
            "items": [{"product_id": product_id, "quantity": 1}],
        },
    )
    assert second_checkout.status_code == 201
    first_order_page = await client.get("/api/v1/store/my-orders?page=1&page_size=1")
    second_order_page = await client.get("/api/v1/store/my-orders?page=2&page_size=1")
    assert first_order_page.status_code == second_order_page.status_code == 200
    assert first_order_page.json()["total"] == 2
    assert first_order_page.json()["items"][0]["id"] != second_order_page.json()["items"][0]["id"]
    confirmed_orders = await client.get("/api/v1/store/my-orders?status=confirmed")
    assert confirmed_orders.status_code == 200
    assert confirmed_orders.json()["items"] == []

    other_registration = await client.post(
        "/api/v1/auth/customer/register",
        json={
            "full_name": "Autre client",
            "phone": "771111111",
            "email": "autre@example.com",
            "password": "secret123",
        },
    )
    assert other_registration.status_code == 201
    other_orders = await client.get("/api/v1/store/my-orders")
    assert other_orders.status_code == 200
    assert other_orders.json()["items"] == []

    await admin_session(client)
    cancelled = await client.patch(
        f"/api/v1/sales/orders/{order['id']}/status",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert cancelled.status_code == 200
    await client.post(
        "/api/v1/auth/login",
        json={"username": "aminata@example.com", "password": "secret123"},
    )
    updated_customer_orders = await client.get("/api/v1/store/my-orders?status=cancelled")
    assert updated_customer_orders.status_code == 200
    assert updated_customer_orders.json()["items"][0]["status"] == "cancelled"

    await admin_session(client)
    products = await client.get("/api/v1/sales/products", headers=headers)
    assert products.status_code == 200
    assert products.json()[0]["stock_quantity"] == 7
    reactivated = await client.patch(
        f"/api/v1/sales/orders/{order['id']}/status",
        headers=headers,
        json={"status": "confirmed"},
    )
    assert reactivated.status_code == 409


@pytest.mark.asyncio
async def test_public_store_rejects_unavailable_products_and_exposes_only_published(
    client: AsyncClient,
) -> None:
    organization_id = await admin_session(client)
    headers = {"X-Organization-ID": organization_id}
    product = await client.post(
        "/api/v1/sales/products",
        headers=headers,
        data={
            "name": "Produit privé",
            "price_fcfa": "1000",
            "stock_quantity": "2",
            "is_published": "false",
        },
    )
    assert product.status_code == 201
    product_id = product.json()["id"]

    client.cookies.clear()
    catalog = await client.get("/api/v1/store/products")
    assert catalog.status_code == 200
    assert catalog.json()["items"] == []
    unauthenticated_order = await client.post(
        "/api/v1/store/orders",
        json={
            "items": [{"product_id": product_id, "quantity": 1}],
        },
    )
    assert unauthenticated_order.status_code == 401
    registration = await client.post(
        "/api/v1/auth/customer/register",
        json={
            "full_name": "Client Mamari",
            "phone": "771234567",
            "email": "client-mamari@example.com",
            "password": "secret123",
        },
    )
    assert registration.status_code == 201
    unavailable_order = await client.post(
        "/api/v1/store/orders",
        json={"items": [{"product_id": product_id, "quantity": 1}]},
    )
    assert unavailable_order.status_code == 409


@pytest.mark.asyncio
async def test_product_photos_are_available_to_the_store_and_authorized_admins(
    client: AsyncClient,
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from mamari_api.modules.sales import router as sales_router

    monkeypatch.setattr(
        sales_router,
        "get_settings",
        lambda: SimpleNamespace(upload_directory=tmp_path, public_store_slug="mamari"),
    )
    organization_id = await admin_session(client)
    headers = {"X-Organization-ID": organization_id}
    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/"
        "l7sAAAAASUVORK5CYII="
    )
    created = await client.post(
        "/api/v1/sales/products",
        headers=headers,
        data={
            "name": "Produit illustré",
            "price_fcfa": "1500",
            "stock_quantity": "5",
            "is_published": "true",
        },
        files={"photo": ("produit.png", png, "image/png")},
    )
    assert created.status_code == 201
    private_photo_url = created.json()["photo_url"]
    private_photo = await client.get(
        f"/api/v1{private_photo_url}",
        headers=headers,
    )
    assert private_photo.status_code == 200
    assert private_photo.content == png

    client.cookies.clear()
    public_catalog = await client.get("/api/v1/store/products")
    assert public_catalog.status_code == 200
    public_photo_url = public_catalog.json()["items"][0]["photo_url"]
    public_photo = await client.get(f"/api/v1{public_photo_url}")
    assert public_photo.status_code == 200
    assert public_photo.content == png

    unauthorized_private_photo = await client.get(f"/api/v1{private_photo_url}")
    assert unauthorized_private_photo.status_code == 401
