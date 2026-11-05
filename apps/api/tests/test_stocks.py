import pytest
from httpx import AsyncClient


async def admin_session(client: AsyncClient) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "oulumata", "password": "passer123m"},
    )
    assert response.status_code == 200
    return response.json()["memberships"][0]["organization_id"]


@pytest.mark.asyncio
async def test_stock_movements_keep_balances_and_link_private_sales(
    client: AsyncClient,
) -> None:
    organization_id = await admin_session(client)
    headers = {"X-Organization-ID": organization_id}
    product_response = await client.post(
        "/api/v1/sales/products",
        headers=headers,
        data={
            "name": "Miel de forêt",
            "price_fcfa": "3500",
            "stock_quantity": "5",
            "unit": "pot",
        },
    )
    assert product_response.status_code == 201
    product = product_response.json()

    items = await client.get("/api/v1/stocks/items?source=other", headers=headers)
    assert items.status_code == 200
    product_item = next(item for item in items.json() if item["product_id"] == product["id"])
    assert product_item["balance"] == "5.000"
    assert product_item["movement_count"] == 1

    oversell = await client.post(
        "/api/v1/sales/orders",
        headers=headers,
        json={
            "customer_name": "Client comptoir",
            "items": [{"product_id": product["id"], "quantity": 6}],
        },
    )
    assert oversell.status_code == 409
    unchanged_product = await client.get("/api/v1/sales/products", headers=headers)
    assert unchanged_product.json()[0]["stock_quantity"] == 5

    sale = await client.post(
        "/api/v1/sales/orders",
        headers=headers,
        json={
            "customer_name": "Client comptoir",
            "items": [{"product_id": product["id"], "quantity": 2}],
        },
    )
    assert sale.status_code == 201
    assert sale.json()["amount_fcfa"] == 7000
    assert sale.json()["items"][0]["quantity"] == 2
    updated_products = await client.get("/api/v1/sales/products", headers=headers)
    assert updated_products.json()[0]["stock_quantity"] == 3

    history = await client.get(
        f"/api/v1/stocks/movements?item_id={product_item['id']}",
        headers=headers,
    )
    assert history.status_code == 200
    assert [movement["movement_type"] for movement in history.json()["items"]] == [
        "sale",
        "opening",
    ]

    cancellation = await client.patch(
        f"/api/v1/sales/orders/{sale.json()['id']}/status",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert cancellation.status_code == 200
    updated_products = await client.get("/api/v1/sales/products", headers=headers)
    assert updated_products.json()[0]["stock_quantity"] == 5

    repeated_cancellation = await client.patch(
        f"/api/v1/sales/orders/{sale.json()['id']}/status",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert repeated_cancellation.status_code == 200
    history = await client.get(
        f"/api/v1/stocks/movements?item_id={product_item['id']}",
        headers=headers,
    )
    assert [movement["movement_type"] for movement in history.json()["items"]] == [
        "cancellation",
        "sale",
        "opening",
    ]


@pytest.mark.asyncio
async def test_stock_loss_consumption_and_transfer_preserve_auditable_balances(
    client: AsyncClient,
) -> None:
    organization_id = await admin_session(client)
    headers = {"X-Organization-ID": organization_id}
    source_response = await client.post(
        "/api/v1/stocks/items",
        headers=headers,
        json={
            "source": "agriculture",
            "name": "Maïs",
            "unit": "kg",
            "location": "Silo principal",
            "opening_quantity": 50,
            "note": "Inventaire initial",
        },
    )
    assert source_response.status_code == 201
    source = source_response.json()
    destination_response = await client.post(
        "/api/v1/stocks/items",
        headers=headers,
        json={
            "source": "agriculture",
            "name": "Maïs",
            "unit": "kg",
            "location": "Réserve",
            "opening_quantity": 0,
        },
    )
    assert destination_response.status_code == 201
    destination = destination_response.json()

    loss = await client.post(
        f"/api/v1/stocks/items/{source['id']}/movements",
        headers=headers,
        json={
            "movement_type": "loss",
            "quantity": 4,
            "movement_date": "2026-11-03",
            "note": "Sac endommagé",
        },
    )
    assert loss.status_code == 201
    consumption = await client.post(
        f"/api/v1/stocks/items/{source['id']}/movements",
        headers=headers,
        json={
            "movement_type": "consumption",
            "quantity": 6,
            "movement_date": "2026-11-03",
            "note": "Semences de la campagne",
        },
    )
    assert consumption.status_code == 201
    transfer = await client.post(
        f"/api/v1/stocks/items/{source['id']}/transfers",
        headers=headers,
        json={
            "destination_item_id": destination["id"],
            "quantity": 10,
            "movement_date": "2026-11-03",
            "note": "Réapprovisionnement de la réserve",
        },
    )
    assert transfer.status_code == 201
    assert {item["id"]: item["balance"] for item in transfer.json()} == {
        source["id"]: "30.000",
        destination["id"]: "10.000",
    }

    insufficient = await client.post(
        f"/api/v1/stocks/items/{source['id']}/movements",
        headers=headers,
        json={
            "movement_type": "loss",
            "quantity": 31,
            "note": "Dépasse le stock disponible",
        },
    )
    assert insufficient.status_code == 409
    current_source = await client.get("/api/v1/stocks/items?source=agriculture", headers=headers)
    balances = {item["id"]: item["balance"] for item in current_source.json()}
    assert balances[source["id"]] == "30.000"
    assert balances[destination["id"]] == "10.000"
