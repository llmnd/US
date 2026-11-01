from datetime import date, timedelta

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
async def test_livestock_groups_animals_care_production_feed_and_finance(
    client: AsyncClient,
) -> None:
    organization_id = await admin_organization(client)
    headers = {"X-Organization-ID": organization_id}

    farm_response = await client.post(
        "/api/v1/agriculture/farms",
        headers=headers,
        data={"name": "Ferme élevage"},
    )
    assert farm_response.status_code == 201, farm_response.text
    farm = farm_response.json()

    facility_response = await client.post(
        "/api/v1/livestock/facilities",
        headers=headers,
        json={
            "name": "Poulailler des collines",
            "facility_type": "coop",
            "farm_id": farm["id"],
            "location": "Thiès",
        },
    )
    assert facility_response.status_code == 201, facility_response.text
    facility = facility_response.json()
    assert facility["farm_name"] == farm["name"]

    group_response = await client.post(
        "/api/v1/livestock/groups",
        headers=headers,
        json={
            "name": "Pondeuses lot 1",
            "species": "Volaille",
            "head_count": 40,
            "facility_id": facility["id"],
        },
    )
    assert group_response.status_code == 201, group_response.text
    group = group_response.json()
    assert group["facility_name"] == facility["name"]

    animal_response = await client.post(
        "/api/v1/livestock/animals",
        headers=headers,
        json={
            "name": "Nala",
            "tag_number": "BOV-001",
            "species": "Bovin",
            "sex": "female",
            "birth_date": (date.today() - timedelta(days=500)).isoformat(),
            "facility_id": facility["id"],
        },
    )
    assert animal_response.status_code == 201, animal_response.text
    animal = animal_response.json()
    assert animal["facility_name"] == facility["name"]

    due_date = date.today() - timedelta(days=1)
    care_response = await client.post(
        "/api/v1/livestock/records",
        headers=headers,
        json={
            "record_type": "health",
            "category": "illness",
            "title": "Traitement antiparasitaire",
            "animal_id": animal["id"],
            "event_date": date.today().isoformat(),
            "next_due_date": due_date.isoformat(),
            "notes": "Contrôle vétérinaire",
        },
    )
    assert care_response.status_code == 201, care_response.text
    assert care_response.json()["animal_name"] == animal["name"]

    production_response = await client.post(
        "/api/v1/livestock/records",
        headers=headers,
        json={
            "record_type": "production",
            "category": "milk",
            "title": "Collecte du matin",
            "animal_id": animal["id"],
            "quantity": 8.5,
            "unit": "litres",
            "amount_fcfa": 6000,
        },
    )
    assert production_response.status_code == 201, production_response.text
    assert production_response.json()["finance_transaction_created"] is True

    eggs_response = await client.post(
        "/api/v1/livestock/records",
        headers=headers,
        json={
            "record_type": "production",
            "category": "eggs",
            "title": "Collecte des œufs",
            "group_id": group["id"],
            "quantity": 12,
            "unit": "œufs",
        },
    )
    assert eggs_response.status_code == 201, eggs_response.text

    feed_response = await client.post(
        "/api/v1/livestock/records",
        headers=headers,
        json={
            "record_type": "feed",
            "category": "feed",
            "title": "Aliment pondeuse",
            "group_id": group["id"],
            "quantity": 25,
            "unit": "kg",
            "amount_fcfa": 15000,
        },
    )
    assert feed_response.status_code == 201, feed_response.text
    assert feed_response.json()["facility_name"] == facility["name"]
    assert feed_response.json()["finance_transaction_created"] is True

    overview = await client.get("/api/v1/livestock/overview", headers=headers)
    assert overview.status_code == 200, overview.text
    assert overview.json()["animal_count"] == 1
    assert overview.json()["group_count"] == 1
    assert overview.json()["facility_count"] == 1
    assert overview.json()["health_follow_up_count"] == 1
    assert overview.json()["upcoming_care"][0]["overdue"] is True
    production_totals = {
        row["unit"]: float(row["quantity"])
        for row in overview.json()["production_month_totals"]
    }
    assert production_totals == {"litres": 8.5, "œufs": 12}

    resolved = await client.patch(
        f"/api/v1/livestock/records/{care_response.json()['id']}/resolve",
        headers=headers,
    )
    assert resolved.status_code == 200
    assert resolved.json()["is_resolved"] is True
    updated_overview = await client.get("/api/v1/livestock/overview", headers=headers)
    assert updated_overview.json()["health_follow_up_count"] == 0
    assert updated_overview.json()["upcoming_care_count"] == 0

    records = await client.get("/api/v1/livestock/records?type=feed", headers=headers)
    assert records.status_code == 200
    assert records.json()[0]["group_name"] == group["name"]

    transactions = await client.get(
        f"/api/v1/agriculture/finance/transactions?year={date.today().year}",
        headers=headers,
    )
    assert transactions.status_code == 200, transactions.text
    assert transactions.json()["total"] == 2
    transactions_by_label = {item["label"]: item for item in transactions.json()["items"]}
    assert transactions_by_label["Aliment pondeuse"]["amount_fcfa"] == 15000
    assert transactions_by_label["Aliment pondeuse"]["transaction_type"] == "expense"
    assert transactions_by_label["Collecte du matin"]["amount_fcfa"] == 6000
    assert transactions_by_label["Collecte du matin"]["transaction_type"] == "income"

    sold = await client.patch(
        f"/api/v1/livestock/animals/{animal['id']}/status?status=sold",
        headers=headers,
    )
    assert sold.status_code == 200
    assert sold.json()["status"] == "sold"

    deceased = await client.patch(
        f"/api/v1/livestock/animals/{animal['id']}/status?status=deceased",
        headers=headers,
    )
    assert deceased.status_code == 200
    mortality = await client.get(
        "/api/v1/livestock/records?type=reproduction",
        headers=headers,
    )
    assert mortality.status_code == 200
    assert any(item["category"] == "mortality" for item in mortality.json())


@pytest.mark.asyncio
async def test_livestock_rejects_invalid_record_subjects(client: AsyncClient) -> None:
    organization_id = await admin_organization(client)
    headers = {"X-Organization-ID": organization_id}
    invalid_subject = await client.post(
        "/api/v1/livestock/records",
        headers=headers,
        json={
            "record_type": "health",
            "category": "checkup",
            "title": "Contrôle",
            "animal_id": None,
            "group_id": None,
        },
    )
    assert invalid_subject.status_code == 422

    invalid_group = await client.post(
        "/api/v1/livestock/animals",
        headers=headers,
        json={"species": "Bovin", "group_id": "00000000-0000-0000-0000-000000000001"},
    )
    assert invalid_group.status_code == 404


@pytest.mark.asyncio
async def test_animal_photos_are_private_and_retrievable(
    client: AsyncClient,
    tmp_path,
    monkeypatch,
) -> None:
    organization_id = await admin_organization(client)
    headers = {"X-Organization-ID": organization_id}
    animal_response = await client.post(
        "/api/v1/livestock/animals",
        headers=headers,
        json={"name": "Awa", "species": "Bovin"},
    )
    assert animal_response.status_code == 201, animal_response.text
    animal = animal_response.json()

    from types import SimpleNamespace

    monkeypatch.setattr(
        "mamari_api.modules.livestock.router.get_settings",
        lambda: SimpleNamespace(upload_directory=tmp_path),
    )
    image = b"\x89PNG\r\n\x1a\nlivestock-photo"
    uploaded = await client.post(
        f"/api/v1/livestock/animals/{animal['id']}/photo",
        headers=headers,
        files={"photo": ("animal.png", image, "image/png")},
    )
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json()["photo_url"] == f"/livestock/animals/{animal['id']}/photo"

    photo_path = f"/api/v1{uploaded.json()['photo_url']}"
    private_photo = await client.get(photo_path, headers=headers)
    assert private_photo.status_code == 200
    assert private_photo.content == image

    unauthorized = await client.get(
        photo_path,
        headers={"X-Organization-ID": "00000000-0000-0000-0000-000000000001"},
    )
    assert unauthorized.status_code == 403
