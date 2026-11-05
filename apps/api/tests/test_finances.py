from datetime import date

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_finances_consolidate_filter_and_paginate_activity_transactions(
    client: AsyncClient,
) -> None:
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "oulumata", "password": "passer123m"},
    )
    assert login.status_code == 200
    organization_id = login.json()["memberships"][0]["organization_id"]
    headers = {"X-Organization-ID": organization_id}

    farm_response = await client.post(
        "/api/v1/agriculture/farms",
        headers=headers,
        data={"name": "Ferme financière"},
    )
    assert farm_response.status_code == 201, farm_response.text
    farm = farm_response.json()

    agriculture_expense = await client.post(
        "/api/v1/agriculture/finance/transactions",
        headers=headers,
        json={
            "farm_id": farm["id"],
            "transaction_type": "expense",
            "category": "input",
            "label": "Semences",
            "amount_fcfa": 2500,
            "transaction_date": date.today().isoformat(),
        },
    )
    assert agriculture_expense.status_code == 201, agriculture_expense.text
    facility_response = await client.post(
        "/api/v1/livestock/facilities",
        headers=headers,
        json={
            "name": "Poulailler financier",
            "facility_type": "coop",
            "farm_id": farm["id"],
        },
    )
    assert facility_response.status_code == 201, facility_response.text
    facility_id = facility_response.json()["id"]
    livestock_income = await client.post(
        "/api/v1/livestock/finance/transactions",
        headers=headers,
        json={
            "transaction_type": "income",
            "category": "production",
            "label": "Vente de production",
            "amount_fcfa": 9000,
            "facility_id": facility_id,
            "transaction_date": date.today().isoformat(),
        },
    )
    assert livestock_income.status_code == 201, livestock_income.text
    livestock_expense = await client.post(
        "/api/v1/livestock/finance/transactions",
        headers=headers,
        json={
            "transaction_type": "expense",
            "category": "health",
            "label": "Soins vétérinaires",
            "amount_fcfa": 3500,
            "facility_id": facility_id,
            "transaction_date": date.today().isoformat(),
        },
    )
    assert livestock_expense.status_code == 201, livestock_expense.text

    summary = await client.get(
        f"/api/v1/finance/summary?year={date.today().year}",
        headers=headers,
    )
    assert summary.status_code == 200, summary.text
    summary_body = summary.json()
    assert summary_body["income_fcfa"] == 9000
    assert summary_body["expenses_fcfa"] == 6000
    assert summary_body["balance_fcfa"] == 3000
    assert summary_body["transaction_count"] == 3
    assert len(summary_body["monthly"]) == 12
    by_source = {item["source"]: item for item in summary_body["by_source"]}
    assert by_source["agriculture"]["income_fcfa"] == 0
    assert by_source["agriculture"]["expenses_fcfa"] == 2500
    assert by_source["elevage"]["income_fcfa"] == 9000
    assert by_source["elevage"]["expenses_fcfa"] == 3500

    filtered = await client.get(
        f"/api/v1/finance/transactions?year={date.today().year}&source=elevage&type=expense",
        headers=headers,
    )
    assert filtered.status_code == 200, filtered.text
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["label"] == "Soins vétérinaires"

    paginated = await client.get(
        f"/api/v1/finance/transactions?year={date.today().year}&page_size=1",
        headers=headers,
    )
    assert paginated.status_code == 200, paginated.text
    assert paginated.json()["total"] == 3
    assert len(paginated.json()["items"]) == 1

    empty_year = await client.get("/api/v1/finance/summary?year=2000", headers=headers)
    assert empty_year.status_code == 200, empty_year.text
    assert empty_year.json()["transaction_count"] == 0
    assert empty_year.json()["income_fcfa"] == 0
