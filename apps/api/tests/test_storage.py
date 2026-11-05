from pathlib import Path
from types import SimpleNamespace

import pytest
from vercel import blob

from mamari_api.core import storage


@pytest.mark.asyncio
async def test_local_file_storage_round_trip(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("BLOB_STORE_ID", raising=False)
    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    monkeypatch.delenv("VERCEL_BLOB_READ_WRITE_TOKEN", raising=False)
    path = tmp_path / "organization" / "photo.png"

    await storage.store_file(path, b"photo", "image/png")

    assert await storage.read_file(path) == b"photo"
    await storage.delete_file(path)
    assert await storage.read_file(path) is None


@pytest.mark.asyncio
async def test_blob_file_storage_round_trip(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    objects: dict[str, bytes] = {}
    settings = SimpleNamespace(
        upload_directory=tmp_path,
        blob_store_id="store-id",
        blob_read_write_token=None,
    )
    monkeypatch.setattr(storage, "get_settings", lambda: settings)
    monkeypatch.setenv("BLOB_STORE_ID", "store-id")

    async def put_blob(
        pathname: str,
        body: bytes,
        *,
        access: str,
        content_type: str,
    ) -> None:
        assert access == "private"
        assert content_type == "image/png"
        objects[pathname] = body

    async def get_blob(pathname: str, *, access: str) -> SimpleNamespace:
        assert access == "private"
        if pathname not in objects:
            raise blob.BlobNotFoundError()
        return SimpleNamespace(body=objects[pathname])

    async def delete_blob(pathname: str) -> None:
        objects.pop(pathname, None)

    monkeypatch.setattr(storage.blob, "put_blob", put_blob)
    monkeypatch.setattr(storage.blob, "get_blob", get_blob)
    monkeypatch.setattr(storage.blob, "delete_blob", delete_blob)
    path = tmp_path / "organization" / "photo.png"

    await storage.store_file(path, b"photo", "image/png")

    assert objects == {"uploads/organization/photo.png": b"photo"}
    assert await storage.read_file(path) == b"photo"
    await storage.delete_file(path)
    assert await storage.read_file(path) is None


def test_upload_limit_is_capped_on_vercel(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VERCEL", "1")

    assert storage.upload_limit(25 * 1024 * 1024) == 4 * 1024 * 1024
    assert storage.upload_limit(2 * 1024 * 1024) == 2 * 1024 * 1024


def test_upload_limit_is_unchanged_off_vercel(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VERCEL", raising=False)

    assert storage.upload_limit(25 * 1024 * 1024) == 25 * 1024 * 1024
