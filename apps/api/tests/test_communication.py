from datetime import date, timedelta
from types import SimpleNamespace

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
async def test_communication_planning_media_and_publication_history(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    from mamari_api.modules.communication import router as communication_router

    monkeypatch.setattr(
        communication_router,
        "get_settings",
        lambda: SimpleNamespace(upload_directory=tmp_path),
    )
    organization_id = await admin_session(client)
    headers = {"X-Organization-ID": organization_id}
    scheduled_date = date.today() + timedelta(days=5)
    reader = await client.post(
        "/api/v1/organizations/users",
        headers=headers,
        json={
            "username": "lecteur-communication",
            "full_name": "Lecteur Communication",
            "password": "secret6",
            "role": "reader",
        },
    )
    assert reader.status_code == 201, reader.text

    invalid_schedule = await client.post(
        "/api/v1/communication/posts",
        headers=headers,
        json={
            "title": "Nouvelle récolte",
            "caption": "Découvrez notre prochaine récolte.",
            "platform": "tiktok",
            "content_format": "video",
            "status": "scheduled",
        },
    )
    assert invalid_schedule.status_code == 422
    past_schedule = await client.post(
        "/api/v1/communication/posts",
        headers=headers,
        json={
            "title": "Ancienne récolte",
            "caption": "Une date déjà passée.",
            "platform": "tiktok",
            "content_format": "video",
            "status": "scheduled",
            "scheduled_date": (date.today() - timedelta(days=1)).isoformat(),
        },
    )
    assert past_schedule.status_code == 422
    assert (
        await client.get(
            "/api/v1/communication/posts",
            headers={"X-Organization-ID": "00000000-0000-0000-0000-000000000001"},
        )
    ).status_code == 403

    draft = await client.post(
        "/api/v1/communication/posts",
        headers=headers,
        json={
            "title": "Présentation Mamari",
            "caption": "Découvrez les activités de Mamari.",
            "hashtags": "#Mamari #Agriculture",
            "platform": "both",
            "content_format": "video",
        },
    )
    assert draft.status_code == 201, draft.text
    assert draft.json()["status"] == "draft"

    needs_date = await client.patch(
        f"/api/v1/communication/posts/{draft.json()['id']}",
        headers=headers,
        json={"status": "scheduled"},
    )
    assert needs_date.status_code == 422

    scheduled = await client.patch(
        f"/api/v1/communication/posts/{draft.json()['id']}",
        headers=headers,
        json={"status": "scheduled", "scheduled_date": scheduled_date.isoformat()},
    )
    assert scheduled.status_code == 200, scheduled.text
    assert scheduled.json()["scheduled_date"] == scheduled_date.isoformat()

    invalid_media = await client.post(
        f"/api/v1/communication/posts/{draft.json()['id']}/media",
        headers=headers,
        files={"media": ("script.svg", b"<svg/>", "image/svg+xml")},
    )
    assert invalid_media.status_code == 415

    image = b"\x89PNG\r\n\x1a\nmamari"
    uploaded = await client.post(
        f"/api/v1/communication/posts/{draft.json()['id']}/media",
        headers=headers,
        files={"media": ("publication.png", image, "image/png")},
    )
    assert uploaded.status_code == 200, uploaded.text
    post = uploaded.json()
    assert post["media_url"]
    assert post["media_mime_type"] == "image/png"

    media_response = await client.get(
        f"/api/v1{post['media_url']}",
        headers=headers,
    )
    assert media_response.status_code == 200
    assert media_response.content == image
    assert media_response.headers["x-content-type-options"] == "nosniff"

    summary = await client.get("/api/v1/communication/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["total"] == 1
    assert summary.json()["scheduled"] == 1
    assert summary.json()["upcoming"] == 1

    month_posts = await client.get(
        f"/api/v1/communication/posts?platform=both&month={scheduled_date.month}&year={scheduled_date.year}",
        headers=headers,
    )
    assert month_posts.status_code == 200
    assert month_posts.json()["total"] == 1

    published = await client.post(
        f"/api/v1/communication/posts/{draft.json()['id']}/mark-published",
        headers=headers,
        json={"published_url": "https://www.tiktok.com/@mamari/video/123456"},
    )
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "published"
    assert published.json()["published_url"].startswith("https://www.tiktok.com/")
    assert (
        await client.patch(
            f"/api/v1/communication/posts/{draft.json()['id']}",
            headers=headers,
            json={"title": "Changer après publication"},
        )
    ).status_code == 409
    assert (
        await client.delete(
            f"/api/v1/communication/posts/{draft.json()['id']}",
            headers=headers,
        )
    ).status_code == 409
    assert (
        await client.delete(
            f"/api/v1/communication/posts/{draft.json()['id']}/media",
            headers=headers,
        )
    ).status_code == 409

    client.cookies.clear()
    reader_login = await client.post(
        "/api/v1/auth/login",
        json={"username": "lecteur-communication", "password": "secret6"},
    )
    assert reader_login.status_code == 200
    forbidden = await client.get("/api/v1/communication/posts", headers=headers)
    assert forbidden.status_code == 403
