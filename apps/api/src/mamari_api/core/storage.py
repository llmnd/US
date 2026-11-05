import asyncio
import mimetypes
import os
from pathlib import Path

from fastapi import HTTPException, Response
from vercel import blob

from mamari_api.core.config import get_settings

VERCEL_FUNCTION_UPLOAD_LIMIT = 4 * 1024 * 1024


def upload_limit(configured_limit: int) -> int:
    if os.getenv("VERCEL") == "1":
        return min(configured_limit, VERCEL_FUNCTION_UPLOAD_LIMIT)
    return configured_limit


def _blob_enabled() -> bool:
    settings = get_settings()
    if settings.blob_store_id:
        os.environ.setdefault("BLOB_STORE_ID", settings.blob_store_id)
    if settings.blob_read_write_token:
        token = settings.blob_read_write_token.get_secret_value()
        os.environ.setdefault("BLOB_READ_WRITE_TOKEN", token)
    return any(
        os.getenv(name)
        for name in (
            "BLOB_STORE_ID",
            "BLOB_READ_WRITE_TOKEN",
            "VERCEL_BLOB_READ_WRITE_TOKEN",
        )
    )


def _blob_path(path: Path) -> str:
    upload_root = get_settings().upload_directory.resolve()
    relative_path = path.resolve().relative_to(upload_root)
    return f"uploads/{relative_path.as_posix()}"


async def store_file(path: Path, content: bytes, content_type: str | None = None) -> None:
    if _blob_enabled():
        await blob.put_blob(
            _blob_path(path),
            content,
            access="private",
            content_type=content_type
            or mimetypes.guess_type(path.name)[0]
            or "application/octet-stream",
        )
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    await asyncio.to_thread(path.write_bytes, content)


async def read_file(path: Path) -> bytes | None:
    if _blob_enabled():
        try:
            result = await blob.get_blob(_blob_path(path), access="private")
        except blob.BlobNotFoundError:
            return None
        return result.body

    if not path.is_file():
        return None
    return await asyncio.to_thread(path.read_bytes)


async def delete_file(path: Path) -> None:
    if _blob_enabled():
        try:
            await blob.delete_blob(_blob_path(path))
        except blob.BlobNotFoundError:
            return
        return

    await asyncio.to_thread(path.unlink, missing_ok=True)


async def stored_file_response(
    path: Path,
    *,
    media_type: str | None = None,
    headers: dict[str, str] | None = None,
    not_found_detail: str = "Fichier introuvable.",
) -> Response:
    content = await read_file(path)
    if content is None:
        raise HTTPException(status_code=404, detail=not_found_detail)
    return Response(
        content,
        media_type=media_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream",
        headers=headers,
    )
