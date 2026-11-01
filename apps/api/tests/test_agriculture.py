from datetime import date
from decimal import Decimal
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


async def setup_farm(client: AsyncClient) -> tuple[str, dict, dict]:
    organization_id = await admin_organization(client)
    farm_response = await client.post(
        "/api/v1/agriculture/farms",
        headers={"X-Organization-ID": organization_id},
        data={"name": "Ferme des Collines", "location": "Thiès"},
    )
    assert farm_response.status_code == 201
    crops_response = await client.get(
        "/api/v1/agriculture/crops",
        headers={"X-Organization-ID": organization_id},
    )
    assert crops_response.status_code == 200
    crop = next((item for item in crops_response.json() if item["name"] == "Maïs"), None)
    if crop is None:
        crop_response = await client.post(
            "/api/v1/agriculture/crops",
            headers={"X-Organization-ID": organization_id},
            json={"name": "Maïs"},
        )
        assert crop_response.status_code == 201
        crop = crop_response.json()
    return organization_id, farm_response.json(), crop


async def create_parcel(
    client: AsyncClient,
    organization_id: str,
    farm_id: str,
    crop_id: str,
    name: str = "Parcelle Nord",
    area: float = 2.5,
) -> dict:
    response = await client.post(
        "/api/v1/agriculture/parcels",
        headers={"X-Organization-ID": organization_id},
        json={
            "farm_id": farm_id,
            "crop_id": crop_id,
            "name": name,
            "area_hectares": area,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_parcels_and_harvests_feed_real_dashboard_metrics(
    client: AsyncClient,
) -> None:
    organization_id, farm, crop = await setup_farm(client)
    headers = {"X-Organization-ID": organization_id}
    parcel = await create_parcel(client, organization_id, farm["id"], crop["id"])
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
async def test_campaign_planning_simulation_start_close_and_sale(
    client: AsyncClient,
) -> None:
    organization_id, farm, crop = await setup_farm(client)
    headers = {"X-Organization-ID": organization_id}
    parcel = await create_parcel(client, organization_id, farm["id"], crop["id"])
    other_crop_response = await client.post(
        "/api/v1/agriculture/crops",
        headers=headers,
        json={"name": "Riz"},
    )
    assert other_crop_response.status_code == 201
    campaign_payload = {
        "parcel_id": parcel["id"],
        "crop_id": crop["id"],
        "name": "Maïs saison des pluies",
        "season": "2026-Hivernage",
        "start_date": "2026-06-01",
        "expected_harvest_date": "2026-10-30",
        "area_hectares": 2,
        "expected_yield_kg_per_hectare": 1000,
        "expected_price_fcfa_per_kg": 1000,
        "estimated_input_cost_fcfa": 500000,
        "estimated_other_cost_fcfa": 100000,
    }
    mismatch = await client.post(
        "/api/v1/agriculture/campaigns",
        headers=headers,
        json={**campaign_payload, "crop_id": other_crop_response.json()["id"]},
    )
    assert mismatch.status_code == 422
    campaign_response = await client.post(
        "/api/v1/agriculture/campaigns",
        headers=headers,
        json=campaign_payload,
    )
    assert campaign_response.status_code == 201, campaign_response.text
    campaign = campaign_response.json()
    assert campaign["status"] == "planned"
    assert Decimal(campaign["expected_production_kg"]) == Decimal("2000")
    assert campaign["expected_revenue_fcfa"] == 2_000_000
    assert campaign["estimated_margin_fcfa"] == 1_400_000

    simulation = await client.post(
        f"/api/v1/agriculture/campaigns/{campaign['id']}/simulate",
        headers=headers,
    )
    assert simulation.status_code == 200, simulation.text
    assert Decimal(simulation.json()["margin_rate_percent"]) == Decimal("70")
    assert simulation.json()["campaign"]["status"] == "simulated"

    started = await client.patch(
        f"/api/v1/agriculture/campaigns/{campaign['id']}/start",
        headers=headers,
    )
    assert started.status_code == 200
    assert started.json()["status"] == "active"
    harvest = await client.post(
        "/api/v1/agriculture/harvests",
        headers=headers,
        json={
            "parcel_id": parcel["id"],
            "campaign_id": campaign["id"],
            "quantity_kg": 1800,
        },
    )
    assert harvest.status_code == 201
    assert harvest.json()["campaign_name"] == "Maïs saison des pluies"

    expense = await client.post(
        "/api/v1/agriculture/finance/transactions",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "campaign_id": campaign["id"],
            "transaction_type": "expense",
            "category": "input",
            "label": "Engrais NPK",
            "amount_fcfa": 250000,
            "quantity": 50,
            "unit": "kg",
        },
    )
    assert expense.status_code == 201, expense.text

    closed = await client.patch(
        f"/api/v1/agriculture/campaigns/{campaign['id']}/close",
        headers=headers,
    )
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"
    sale = await client.post(
        f"/api/v1/agriculture/campaigns/{campaign['id']}/sales",
        headers=headers,
        json={
            "customer_name": "Marché Central",
            "quantity_kg": 900,
            "unit_price_fcfa_per_kg": 1200,
        },
    )
    assert sale.status_code == 201, sale.text
    assert sale.json()["amount_fcfa"] == 1_080_000

    summary = await client.get(
        f"/api/v1/agriculture/finance/summary?year={date.today().year}",
        headers=headers,
    )
    assert summary.status_code == 200
    assert summary.json()["income_fcfa"] == 1_080_000
    assert summary.json()["expenses_fcfa"] == 250_000
    assert summary.json()["input_expenses_fcfa"] == 250_000
    assert summary.json()["balance_fcfa"] == 830_000

    campaign_list = await client.get(
        "/api/v1/agriculture/campaigns?status=closed",
        headers=headers,
    )
    campaign_result = campaign_list.json()["items"][0]
    assert Decimal(campaign_result["actual_production_kg"]) == Decimal("1800")
    assert campaign_result["actual_revenue_fcfa"] == 1_080_000
    assert campaign_result["actual_expenses_fcfa"] == 250_000

    too_much = await client.post(
        f"/api/v1/agriculture/campaigns/{campaign['id']}/sales",
        headers=headers,
        json={"customer_name": "Client B", "quantity_kg": 1000, "unit_price_fcfa_per_kg": 1000},
    )
    assert too_much.status_code == 422
    premature_archive = await client.patch(
        f"/api/v1/agriculture/campaigns/{campaign['id']}/archive",
        headers=headers,
    )
    assert premature_archive.status_code == 409
    remaining_sale = await client.post(
        f"/api/v1/agriculture/campaigns/{campaign['id']}/sales",
        headers=headers,
        json={
            "customer_name": "Marché Central",
            "quantity_kg": 900,
            "unit_price_fcfa_per_kg": 1200,
        },
    )
    assert remaining_sale.status_code == 201
    archived = await client.patch(
        f"/api/v1/agriculture/campaigns/{campaign['id']}/archive",
        headers=headers,
    )
    assert archived.status_code == 200
    active_campaigns = await client.get(
        "/api/v1/agriculture/campaigns?archived=false",
        headers=headers,
    )
    archived_campaigns = await client.get(
        "/api/v1/agriculture/campaigns?archived=true",
        headers=headers,
    )
    assert active_campaigns.json()["total"] == 0
    assert archived_campaigns.json()["total"] == 1


@pytest.mark.asyncio
async def test_farm_photo_is_validated_private_and_archiveable(
    client: AsyncClient,
) -> None:
    organization_id = await admin_organization(client)
    headers = {"X-Organization-ID": organization_id}
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
    created = await client.post(
        "/api/v1/agriculture/farms",
        headers=headers,
        data={"name": "Ferme photo"},
        files={"photo": ("farm.png", png, "image/png")},
    )
    assert created.status_code == 201, created.text
    farm = created.json()
    assert farm["photo_url"] == f"/agriculture/farms/{farm['id']}/photo"
    photo = await client.get(f"/api/v1{farm['photo_url']}", headers=headers)
    assert photo.status_code == 200
    assert photo.content == png

    bad_photo = await client.post(
        "/api/v1/agriculture/farms",
        headers=headers,
        data={"name": "Format refusé"},
        files={"photo": ("farm.svg", b"<svg/>", "image/svg+xml")},
    )
    assert bad_photo.status_code == 415

    archived = await client.patch(
        f"/api/v1/agriculture/farms/{farm['id']}/archive",
        headers=headers,
    )
    assert archived.status_code == 200
    assert archived.json()["is_active"] is False
    active_farms = await client.get("/api/v1/agriculture/farms?active=true", headers=headers)
    archived_farms = await client.get("/api/v1/agriculture/farms?active=false", headers=headers)
    assert active_farms.json()["total"] == 0
    assert archived_farms.json()["total"] == 1
    restored = await client.patch(
        f"/api/v1/agriculture/farms/{farm['id']}/restore",
        headers=headers,
    )
    assert restored.status_code == 200
    assert restored.json()["is_active"] is True


@pytest.mark.asyncio
async def test_agriculture_validates_inputs_and_organization_access(
    client: AsyncClient,
) -> None:
    organization_id, farm, crop = await setup_farm(client)
    headers = {"X-Organization-ID": organization_id}

    invalid_parcel = await client.post(
        "/api/v1/agriculture/parcels",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "crop_id": crop["id"],
            "name": "Parcelle",
            "area_hectares": 0,
        },
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
    organization_id, farm, crop = await setup_farm(client)
    headers = {"X-Organization-ID": organization_id}
    parcel_data = {
        "farm_id": farm["id"],
        "crop_id": crop["id"],
        "name": "Parcelle Est",
        "area_hectares": 1.25,
    }
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
        json={
            **parcel_data,
            "name": "Parcelle Sud",
        },
    )
    assert forbidden.status_code == 403
