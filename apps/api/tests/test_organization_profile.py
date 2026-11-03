from httpx import AsyncClient


async def login(client: AsyncClient, username: str = "mamari") -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "username": username,
            "password": "passer123m" if username == "mamari" else "secret6",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["memberships"][0]["organization_id"]


async def create_member(
    client: AsyncClient,
    organization_id: str,
    username: str,
    role: str,
) -> None:
    response = await client.post(
        "/api/v1/organizations/users",
        headers={"X-Organization-ID": organization_id},
        json={
            "username": username,
            "full_name": f"Membre {username}",
            "password": "secret6",
            "role": role,
        },
    )
    assert response.status_code == 201, response.text


async def test_organization_profile_is_editable_by_admins_only(
    client: AsyncClient,
) -> None:
    organization_id = await login(client)
    headers = {"X-Organization-ID": organization_id}
    await create_member(client, organization_id, "responsable-entreprise", "manager")
    await create_member(client, organization_id, "lecture-entreprise", "reader")

    initial = await client.get("/api/v1/organizations/current", headers=headers)
    assert initial.status_code == 200, initial.text
    assert initial.json()["name"] == "Mamari"
    assert initial.json()["description"] is None

    updated = await client.patch(
        "/api/v1/organizations/current",
        headers=headers,
        json={
            "name": "Mamari Agriculture",
            "description": "Exploitation agricole et élevage.",
            "legal_form": "Entreprise individuelle",
            "phone": "+235 66 12 34 56",
            "email": "contact@mamari.example",
            "address": "N'Djamena, Tchad",
            "website": "https://mamari.example",
            "facebook_url": "https://www.facebook.com/mamari",
            "tiktok_url": "https://www.tiktok.com/@hamid.mamari1",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Mamari Agriculture"
    assert updated.json()["legal_form"] == "Entreprise individuelle"
    assert updated.json()["email"] == "contact@mamari.example"
    assert updated.json()["tiktok_url"] == "https://www.tiktok.com/@hamid.mamari1"

    invalid_email = await client.patch(
        "/api/v1/organizations/current",
        headers=headers,
        json={"email": "adresse-invalide"},
    )
    assert invalid_email.status_code == 422
    missing_name = await client.patch(
        "/api/v1/organizations/current",
        headers=headers,
        json={"name": None},
    )
    assert missing_name.status_code == 422
    empty_update = await client.patch(
        "/api/v1/organizations/current",
        headers=headers,
        json={},
    )
    assert empty_update.status_code == 422

    updated_after_invalid = await client.get(
        "/api/v1/organizations/current",
        headers=headers,
    )
    assert updated_after_invalid.json()["name"] == "Mamari Agriculture"
    assert updated_after_invalid.json()["email"] == "contact@mamari.example"

    await login(client, "responsable-entreprise")
    manager_headers = {"X-Organization-ID": organization_id}
    manager_read = await client.get(
        "/api/v1/organizations/current",
        headers=manager_headers,
    )
    assert manager_read.status_code == 200
    manager_write = await client.patch(
        "/api/v1/organizations/current",
        headers=manager_headers,
        json={"description": "Modification interdite."},
    )
    assert manager_write.status_code == 403

    await login(client, "lecture-entreprise")
    reader_write = await client.patch(
        "/api/v1/organizations/current",
        headers=manager_headers,
        json={"description": "Modification interdite."},
    )
    assert reader_write.status_code == 403
