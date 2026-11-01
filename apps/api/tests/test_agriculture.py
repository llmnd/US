from datetime import date
from uuid import uuid4

import pytest
from httpx import AsyncClient


async def admin_organization(client: AsyncClient) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "mamari", "password": "passer123m"},
    )
    assert response.status_code == 200
    return response.json()["memberships"][0]["organization_id"]


@pytest.mark.asyncio
async def test_parcels_and_harvests_feed_real_dashboard_metrics(
    client: AsyncClient,
) -> None:
    organization_id = await admin_organization(client)
    headers = {"X-Organization-ID": organization_id}
    parcel_response = await client.post(
        "/api/v1/agriculture/parcels",
        headers=headers,
        json={"name": "Parcelle Nord", "crop": "Maïs", "area_hectares": 2.5},
    )

    assert parcel_response.status_code == 201
    parcel = parcel_response.json()
    assert parcel["name"] == "Parcelle Nord"
    assert float(parcel["area_hectares"]) == 2.5

    harvest_response = await client.post(
        "/api/v1/agriculture/harvests",
        headers=headers,
        json={
            "parcel_id": parcel["id"],
            "harvest_date": date.today().isoformat(),
            "quantity_kg": 1250.75,
            "notes": "Récolte principale",
        },
    )

    assert harvest_response.status_code == 201
    harvest = harvest_response.json()
    assert harvest["parcel_name"] == "Parcelle Nord"
    assert float(harvest["quantity_kg"]) == 1250.75

    parcel_list = await client.get("/api/v1/agriculture/parcels", headers=headers)
    harvest_list = await client.get("/api/v1/agriculture/harvests", headers=headers)
    assert parcel_list.status_code == 200
    assert parcel_list.json()["total"] == 1
    assert harvest_list.status_code == 200
    assert harvest_list.json()["items"][0]["id"] == harvest["id"]

    overview = await client.get(
        f"/api/v1/dashboard/overview?year={date.today().year}",
        headers=headers,
    )
    assert overview.status_code == 200
    body = overview.json()
    assert body["production_kg"] == 1250.75
    assert body["harvest_count"] == 1
    assert body["parcel_count"] == 1
    assert len(body["monthly_production_kg"]) == 12
    assert body["monthly_production_kg"][date.today().month - 1]["quantity_kg"] == 1250.75
    assert body["recent_harvests"][0]["id"] == harvest["id"]


@pytest.mark.asyncio
async def test_agriculture_validates_inputs_and_organization_access(
    client: AsyncClient,
) -> None:
    organization_id = await admin_organization(client)
    headers = {"X-Organization-ID": organization_id}

    invalid_parcel = await client.post(
        "/api/v1/agriculture/parcels",
        headers=headers,
        json={"name": "Parcelle", "crop": "Maïs", "area_hectares": 0},
    )
    assert invalid_parcel.status_code == 422

    missing_parcel = await client.post(
        "/api/v1/agriculture/harvests",
        headers=headers,
        json={"parcel_id": str(uuid4()), "quantity_kg": 50},
    )
    assert missing_parcel.status_code == 404

    inaccessible_organization = await client.get(
        "/api/v1/agriculture/parcels",
        headers={"X-Organization-ID": str(uuid4())},
    )
    assert inaccessible_organization.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_parcel_name_and_reader_permissions(
    client: AsyncClient,
) -> None:
    organization_id = await admin_organization(client)
    headers = {"X-Organization-ID": organization_id}
    parcel_data = {"name": "Parcelle Est", "crop": "Riz", "area_hectares": 1.25}
    created = await client.post(
        "/api/v1/agriculture/parcels",
        headers=headers,
        json=parcel_data,
    )
    assert created.status_code == 201
    duplicate = await client.post("/api/v1/agriculture/parcels", headers=headers, json=parcel_data)
    assert duplicate.status_code == 409

    user = await client.post(
        "/api/v1/organizations/users",
        headers=headers,
        json={
            "username": "lecteur-agri",
            "full_name": "Lecteur Agriculture",
            "password": "secret6",
            "role": "reader",
        },
    )
    assert user.status_code == 201
    client.cookies.clear()
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "lecteur-agri", "password": "secret6"},
    )
    assert login.status_code == 200
    assert (await client.get("/api/v1/agriculture/parcels", headers=headers)).status_code == 200
    forbidden = await client.post(
        "/api/v1/agriculture/parcels",
        headers=headers,
        json={"name": "Parcelle Sud", "crop": "Riz", "area_hectares": 3},
    )
    assert forbidden.status_code == 403
