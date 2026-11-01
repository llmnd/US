from datetime import date
from uuid import uuid4

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
async def test_sales_orders_feed_real_dashboard_metrics(client: AsyncClient) -> None:
    organization_id = await admin_session(client)
    headers = {"X-Organization-ID": organization_id}
    created = await client.post(
        "/api/v1/sales/orders",
        headers=headers,
        json={
            "customer_name": "Marché Central",
            "order_date": date.today().isoformat(),
            "amount_fcfa": 485000,
        },
    )

    assert created.status_code == 201
    order = created.json()
    assert order["reference"].startswith(f"CMD-{date.today().year}-")
    assert order["status"] == "confirmed"

    overview = await client.get(
        f"/api/v1/dashboard/overview?year={date.today().year}",
        headers=headers,
    )
    assert overview.status_code == 200
    body = overview.json()
    assert body["revenue_fcfa"] == 485000
    assert body["order_count"] == 1
    assert body["average_order_fcfa"] == 485000
    assert len(body["monthly_revenue"]) == 12
    assert body["monthly_revenue"][date.today().month - 1]["amount_fcfa"] == 485000
    assert body["recent_orders"][0]["id"] == order["id"]


@pytest.mark.asyncio
async def test_empty_dashboard_does_not_invent_business_figures(
    client: AsyncClient,
) -> None:
    organization_id = await admin_session(client)
    response = await client.get(
        f"/api/v1/dashboard/overview?year={date.today().year}",
        headers={"X-Organization-ID": organization_id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["revenue_fcfa"] == 0
    assert body["order_count"] == 0
    assert body["customer_count"] == 0
    assert len(body["monthly_revenue"]) == 12
    assert all(month["amount_fcfa"] == 0 for month in body["monthly_revenue"])


@pytest.mark.asyncio
async def test_cancelled_order_is_excluded_from_revenue(client: AsyncClient) -> None:
    organization_id = await admin_session(client)
    headers = {"X-Organization-ID": organization_id}
    created = await client.post(
        "/api/v1/sales/orders",
        headers=headers,
        json={"customer_name": "Client A", "amount_fcfa": 12000},
    )
    order_id = created.json()["id"]

    cancelled = await client.patch(
        f"/api/v1/sales/orders/{order_id}/status",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert cancelled.status_code == 200

    overview = await client.get(
        f"/api/v1/dashboard/overview?year={date.today().year}",
        headers=headers,
    )
    assert overview.json()["revenue_fcfa"] == 0
    assert overview.json()["order_count"] == 0
    assert overview.json()["pending_order_count"] == 0
    assert overview.json()["customer_count"] == 0
    assert overview.json()["average_order_fcfa"] == 0
    assert overview.json()["recent_orders"][0]["status"] == "cancelled"


@pytest.mark.asyncio
async def test_sales_orders_are_searchable_filterable_and_paginated(
    client: AsyncClient,
) -> None:
    organization_id = await admin_session(client)
    headers = {"X-Organization-ID": organization_id}
    for index in range(3):
        created = await client.post(
            "/api/v1/sales/orders",
            headers=headers,
            json={
                "customer_name": f"Marché {index}",
                "amount_fcfa": 1000 + index,
            },
        )
        assert created.status_code == 201
    cancelled_id = created.json()["id"]
    await client.patch(
        f"/api/v1/sales/orders/{cancelled_id}/status",
        headers=headers,
        json={"status": "cancelled"},
    )

    page = await client.get(
        "/api/v1/sales/orders?page=1&page_size=2",
        headers=headers,
    )
    assert page.status_code == 200
    assert page.json()["total"] == 3
    assert len(page.json()["items"]) == 2
    assert page.json()["page"] == 1

    filtered = await client.get(
        "/api/v1/sales/orders?search=Marché%202&status=cancelled",
        headers=headers,
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["customer_name"] == "Marché 2"


@pytest.mark.asyncio
async def test_sales_data_requires_membership_and_valid_input(client: AsyncClient) -> None:
    await admin_session(client)
    bad_scope = {"X-Organization-ID": str(uuid4())}
    forbidden = await client.get("/api/v1/sales/orders", headers=bad_scope)
    assert forbidden.status_code == 403

    organization_id = await admin_session(client)
    invalid = await client.post(
        "/api/v1/sales/orders",
        headers={"X-Organization-ID": organization_id},
        json={"customer_name": "A", "amount_fcfa": -1},
    )
    assert invalid.status_code == 422


@pytest.mark.asyncio
async def test_reader_can_view_but_cannot_create_orders(client: AsyncClient) -> None:
    organization_id = await admin_session(client)
    headers = {"X-Organization-ID": organization_id}
    user = await client.post(
        "/api/v1/organizations/users",
        headers=headers,
        json={
            "username": "lecteur",
            "full_name": "Utilisateur lecture",
            "password": "secret6",
            "role": "reader",
        },
    )
    assert user.status_code == 201
    client.cookies.clear()
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"username": "lecteur", "password": "secret6"},
        )
    ).status_code == 200

    assert (await client.get("/api/v1/sales/orders", headers=headers)).status_code == 200
    create = await client.post(
        "/api/v1/sales/orders",
        headers=headers,
        json={"customer_name": "Client B", "amount_fcfa": 5000},
    )
    assert create.status_code == 403
