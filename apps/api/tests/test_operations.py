from datetime import date, timedelta
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
async def test_tasks_can_be_planned_assigned_searched_and_completed(
    client: AsyncClient,
) -> None:
    organization_id = await admin_organization(client)
    headers = {"X-Organization-ID": organization_id}
    member = await client.post(
        "/api/v1/organizations/users",
        headers=headers,
        json={
            "username": "operations-user",
            "full_name": "Awa Diop",
            "password": "secret6",
            "role": "operator",
        },
    )
    assert member.status_code == 201, member.text
    member_id = member.json()["id"]

    created = await client.post(
        "/api/v1/operations/tasks",
        headers=headers,
        json={
            "title": "Préparer les commandes",
            "description": "Vérifier les quantités avant le départ.",
            "priority": "urgent",
            "due_date": (date.today() - timedelta(days=1)).isoformat(),
            "assigned_user_id": member_id,
        },
    )
    assert created.status_code == 201, created.text
    task = created.json()
    assert task["status"] == "todo"
    assert task["assigned_user_name"] == "Awa Diop"

    second = await client.post(
        "/api/v1/operations/tasks",
        headers=headers,
        json={
            "title": "Ranger les équipements",
            "priority": "normal",
            "due_date": (date.today() + timedelta(days=3)).isoformat(),
        },
    )
    assert second.status_code == 201, second.text
    in_progress = await client.patch(
        f"/api/v1/operations/tasks/{second.json()['id']}",
        headers=headers,
        json={"status": "in_progress"},
    )
    assert in_progress.status_code == 200

    filtered = await client.get(
        "/api/v1/operations/tasks?search=commandes&priority=urgent",
        headers=headers,
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["id"] == task["id"]

    summary = await client.get("/api/v1/operations/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json() == {
        "total": 2,
        "todo": 1,
        "in_progress": 1,
        "done": 0,
        "overdue": 1,
        "due_soon": 1,
    }

    completed = await client.patch(
        f"/api/v1/operations/tasks/{task['id']}",
        headers=headers,
        json={"status": "done"},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "done"
    summary = await client.get("/api/v1/operations/summary", headers=headers)
    assert summary.json()["overdue"] == 0
    assert summary.json()["done"] == 1

    archived = await client.patch(
        f"/api/v1/operations/tasks/{task['id']}",
        headers=headers,
        json={"status": "archived"},
    )
    assert archived.status_code == 200
    normal_list = await client.get("/api/v1/operations/tasks", headers=headers)
    assert normal_list.json()["total"] == 1
    archived_list = await client.get(
        "/api/v1/operations/tasks?status=archived",
        headers=headers,
    )
    assert archived_list.json()["total"] == 1


@pytest.mark.asyncio
async def test_task_assignments_and_permissions_are_organization_scoped(
    client: AsyncClient,
) -> None:
    organization_id = await admin_organization(client)
    headers = {"X-Organization-ID": organization_id}

    invalid_assignee = await client.post(
        "/api/v1/operations/tasks",
        headers=headers,
        json={"title": "Tâche hors organisation", "assigned_user_id": str(uuid4())},
    )
    assert invalid_assignee.status_code == 404

    created = await client.post(
        "/api/v1/operations/tasks",
        headers=headers,
        json={"title": "Tâche en lecture seule"},
    )
    assert created.status_code == 201

    reader = await client.post(
        "/api/v1/organizations/users",
        headers=headers,
        json={
            "username": "operations-reader",
            "full_name": "Lecteur opérations",
            "password": "secret6",
            "role": "reader",
        },
    )
    assert reader.status_code == 201
    client.cookies.clear()
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "operations-reader", "password": "secret6"},
    )
    assert login.status_code == 200

    assert (await client.get("/api/v1/operations/tasks", headers=headers)).status_code == 200
    forbidden_create = await client.post(
        "/api/v1/operations/tasks",
        headers=headers,
        json={"title": "Création interdite"},
    )
    assert forbidden_create.status_code == 403
    forbidden_update = await client.patch(
        f"/api/v1/operations/tasks/{created.json()['id']}",
        headers=headers,
        json={"status": "done"},
    )
    assert forbidden_update.status_code == 403
