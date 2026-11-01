from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_default_admin_is_created_on_first_login(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "MAMARI", "password": "passer123m"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "mamari"
    assert body["full_name"] == "Administrateur Mamari"
    assert body["memberships"][0]["role"] == "owner"
    assert body["memberships"][0]["organization_name"] == "Mamari"
    assert "passer123m" not in response.text
    assert "HttpOnly" in response.headers["set-cookie"]

    organization_id = body["memberships"][0]["organization_id"]
    current = await client.get(
        "/api/v1/organizations/current",
        headers={"X-Organization-ID": organization_id},
    )
    assert current.status_code == 200
    assert current.json()["slug"] == "mamari"
    crops = await client.get(
        "/api/v1/agriculture/crops",
        headers={"X-Organization-ID": organization_id},
    )
    assert crops.status_code == 200
    assert "Maïs" in {crop["name"] for crop in crops.json()}


@pytest.mark.asyncio
async def test_login_and_logout_manage_the_session(client: AsyncClient) -> None:
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "mamari", "password": "passer123m"},
    )
    assert login.status_code == 200
    assert (await client.get("/api/v1/auth/me")).status_code == 200

    logout = await client.post("/api/v1/auth/logout")
    assert logout.status_code == 200
    client.cookies.clear()
    assert (await client.get("/api/v1/auth/me")).status_code == 401


@pytest.mark.asyncio
async def test_bad_credentials_and_public_registration_are_rejected(
    client: AsyncClient,
) -> None:
    invalid_password = "wrongpass"
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "mamari", "password": invalid_password},
    )
    assert login.status_code == 401
    assert invalid_password not in login.text
    assert (await client.post("/api/v1/auth/register", json={})).status_code == 404


@pytest.mark.asyncio
async def test_organization_membership_is_required(client: AsyncClient) -> None:
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "mamari", "password": "passer123m"},
    )
    assert login.status_code == 200
    response = await client.get(
        "/api/v1/organizations/current",
        headers={"X-Organization-ID": str(uuid4())},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_create_a_user_for_mamari(client: AsyncClient) -> None:
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "mamari", "password": "passer123m"},
    )
    organization_id = login.json()["memberships"][0]["organization_id"]

    created = await client.post(
        "/api/v1/organizations/users",
        headers={"X-Organization-ID": organization_id},
        json={
            "username": "equipe",
            "full_name": "Membre Mamari",
            "password": "secret6",
            "role": "operator",
        },
    )
    assert created.status_code == 201
    assert created.json()["username"] == "equipe"
    assert created.json()["role"] == "operator"

    client.cookies.clear()
    member_login = await client.post(
        "/api/v1/auth/login",
        json={"username": "equipe", "password": "secret6"},
    )
    assert member_login.status_code == 200
    assert member_login.json()["memberships"][0]["organization_id"] == organization_id
    forbidden = await client.post(
        "/api/v1/organizations/users",
        headers={"X-Organization-ID": organization_id},
        json={
            "username": "autre",
            "full_name": "Autre membre",
            "password": "secret6",
            "role": "reader",
        },
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_user_creation_requires_admin_and_rejects_duplicate_usernames(
    client: AsyncClient,
) -> None:
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "mamari", "password": "passer123m"},
    )
    organization_id = login.json()["memberships"][0]["organization_id"]
    payload = {
        "username": "equipe",
        "full_name": "Membre Mamari",
        "password": "secret6",
        "role": "reader",
    }

    created = await client.post(
        "/api/v1/organizations/users",
        headers={"X-Organization-ID": organization_id},
        json=payload,
    )
    assert created.status_code == 201
    duplicate = await client.post(
        "/api/v1/organizations/users",
        headers={"X-Organization-ID": organization_id},
        json=payload,
    )
    assert duplicate.status_code == 409


@pytest.mark.asyncio
async def test_untrusted_origin_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "mamari", "password": "passer123m"},
        headers={"Origin": "https://attacker.example"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_cors_headers_are_preserved_on_server_errors(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fail_authentication(*args, **kwargs):
        raise RuntimeError("Database unavailable")

    monkeypatch.setattr(
        "mamari_api.modules.identity.router.authenticate_user",
        fail_authentication,
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "mamari", "password": "passer123m"},
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


@pytest.mark.asyncio
async def test_cors_allows_local_frontend_on_auth_response(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "inconnu", "password": "secret6"},
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


@pytest.mark.asyncio
async def test_cors_allows_the_organization_scope_header(client: AsyncClient) -> None:
    response = await client.options(
        "/api/v1/organizations/current",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "x-organization-id",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "x-organization-id" in response.headers["access-control-allow-headers"].lower()


@pytest.mark.asyncio
async def test_password_validation_uses_six_character_minimum(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "mamari", "password": "short"},
    )

    assert response.status_code == 422
    assert '"input":"short"' not in response.text
