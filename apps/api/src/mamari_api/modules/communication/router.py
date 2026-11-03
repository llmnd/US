import asyncio
import uuid
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError

from mamari_api.core.config import get_settings
from mamari_api.modules.communication.models import CommunicationPost
from mamari_api.modules.communication.schemas import (
    CommunicationPostPageResponse,
    CommunicationPostResponse,
    CommunicationSummaryResponse,
    CreateCommunicationPostRequest,
    MarkCommunicationPostPublishedRequest,
    PostStatus,
    SocialPlatform,
    UpdateCommunicationPostRequest,
)
from mamari_api.modules.identity.dependencies import (
    CurrentMembership,
    SessionDep,
    get_current_membership,
    require_roles,
)

router = APIRouter(prefix="/communication")
CurrentOrganizationDep = Annotated[CurrentMembership, Depends(get_current_membership)]
CanManageCommunicationDep = Annotated[
    CurrentMembership,
    Depends(require_roles("owner", "admin", "manager")),
]
MAX_MEDIA_BYTES = 25 * 1024 * 1024
MEDIA_TYPES = {
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (
        ".webp",
        lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
    ),
    "video/mp4": (
        ".mp4",
        lambda data: len(data) >= 12 and data[4:8] == b"ftyp",
    ),
}


def _media_path(organization_id: uuid.UUID, filename: str) -> Path:
    if (
        Path(filename).name != filename
        or not filename.startswith("communication-")
        or Path(filename).suffix not in {".jpg", ".png", ".webp", ".mp4"}
    ):
        raise HTTPException(status_code=404, detail="Média introuvable.")
    return get_settings().upload_directory / str(organization_id) / "communication" / filename


def _post_response(post: CommunicationPost) -> CommunicationPostResponse:
    return CommunicationPostResponse(
        id=post.id,
        title=post.title,
        caption=post.caption,
        hashtags=post.hashtags,
        platform=post.platform,
        content_format=post.content_format,
        status=post.status,
        scheduled_date=post.scheduled_date,
        published_at=post.published_at,
        published_url=post.published_url,
        media_url=f"/communication/posts/{post.id}/media" if post.media_filename else None,
        media_mime_type=post.media_mime_type,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


async def _find_post(
    session: SessionDep,
    organization_id: uuid.UUID,
    post_id: uuid.UUID,
) -> CommunicationPost:
    post = await session.scalar(
        select(CommunicationPost).where(
            CommunicationPost.id == post_id,
            CommunicationPost.organization_id == organization_id,
        )
    )
    if post is None:
        raise HTTPException(status_code=404, detail="Publication introuvable.")
    return post


@router.get("/posts", response_model=CommunicationPostPageResponse)
async def list_posts(
    session: SessionDep,
    context: CanManageCommunicationDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(min_length=2, max_length=100)] = None,
    post_status: Annotated[
        PostStatus | None, Query(alias="status")
    ] = None,
    platform: SocialPlatform | None = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> CommunicationPostPageResponse:
    filters = [CommunicationPost.organization_id == context.organization.id]
    if post_status is not None:
        filters.append(CommunicationPost.status == post_status)
    if platform is not None:
        filters.append(CommunicationPost.platform == platform)
    if month is not None and year is not None:
        filters.append(
            func.extract("month", CommunicationPost.scheduled_date) == month
        )
        filters.append(
            func.extract("year", CommunicationPost.scheduled_date) == year
        )
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                CommunicationPost.title.ilike(pattern),
                CommunicationPost.caption.ilike(pattern),
                CommunicationPost.hashtags.ilike(pattern),
            )
        )
    total = await session.scalar(
        select(func.count()).select_from(CommunicationPost).where(*filters)
    )
    rows = await session.scalars(
        select(CommunicationPost)
        .where(*filters)
        .order_by(
            case(
                (CommunicationPost.status == "scheduled", 0),
                (CommunicationPost.status == "draft", 1),
                else_=2,
            ),
            CommunicationPost.scheduled_date.asc().nulls_last(),
            CommunicationPost.created_at.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return CommunicationPostPageResponse(
        items=[_post_response(post) for post in rows.all()],
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.get("/summary", response_model=CommunicationSummaryResponse)
async def read_summary(
    session: SessionDep,
    context: CanManageCommunicationDep,
) -> CommunicationSummaryResponse:
    result = await session.execute(
        select(
            func.count().label("total"),
            func.sum(case((CommunicationPost.status == "draft", 1), else_=0)).label("drafts"),
            func.sum(
                case((CommunicationPost.status == "scheduled", 1), else_=0)
            ).label("scheduled"),
            func.sum(
                case((CommunicationPost.status == "published", 1), else_=0)
            ).label("published"),
            func.sum(
                case(
                    (
                        (CommunicationPost.status == "scheduled")
                        & (CommunicationPost.scheduled_date >= date.today()),
                        1,
                    ),
                    else_=0,
                )
            ).label("upcoming"),
        ).where(CommunicationPost.organization_id == context.organization.id)
    )
    row = result.one()
    return CommunicationSummaryResponse(
        total=row.total or 0,
        drafts=row.drafts or 0,
        scheduled=row.scheduled or 0,
        published=row.published or 0,
        upcoming=row.upcoming or 0,
    )


@router.post(
    "/posts",
    response_model=CommunicationPostResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_post(
    data: CreateCommunicationPostRequest,
    session: SessionDep,
    context: CanManageCommunicationDep,
) -> CommunicationPostResponse:
    post = CommunicationPost(
        organization_id=context.organization.id,
        created_by_id=context.user.id,
        title=data.title,
        caption=data.caption,
        hashtags=data.hashtags,
        platform=data.platform,
        content_format=data.content_format,
        status=data.status,
        scheduled_date=data.scheduled_date,
    )
    session.add(post)
    await session.commit()
    await session.refresh(post)
    return _post_response(post)


@router.patch("/posts/{post_id}", response_model=CommunicationPostResponse)
async def update_post(
    post_id: uuid.UUID,
    data: UpdateCommunicationPostRequest,
    session: SessionDep,
    context: CanManageCommunicationDep,
) -> CommunicationPostResponse:
    post = await _find_post(session, context.organization.id, post_id)
    if post.status == "published":
        raise HTTPException(
            status_code=409,
            detail="Une publication déjà publiée ne peut plus être modifiée.",
        )
    changes = data.model_dump(exclude_unset=True)
    next_status = changes.get("status", post.status)
    next_date = changes.get("scheduled_date", post.scheduled_date)
    if next_status == "scheduled" and next_date is None:
        raise HTTPException(
            status_code=422,
            detail="Choisissez une date pour planifier la publication.",
        )
    if next_status == "scheduled" and next_date < date.today():
        raise HTTPException(
            status_code=422,
            detail="La date de planification ne peut pas être antérieure à aujourd’hui.",
        )
    for field, value in changes.items():
        setattr(post, field, value)
    await session.commit()
    await session.refresh(post)
    return _post_response(post)


@router.post("/posts/{post_id}/mark-published", response_model=CommunicationPostResponse)
async def mark_post_published(
    post_id: uuid.UUID,
    data: MarkCommunicationPostPublishedRequest,
    session: SessionDep,
    context: CanManageCommunicationDep,
) -> CommunicationPostResponse:
    post = await _find_post(session, context.organization.id, post_id)
    if post.status == "published":
        raise HTTPException(
            status_code=409,
            detail="Cette publication est déjà marquée comme publiée.",
        )
    if post.status == "archived":
        raise HTTPException(
            status_code=409,
            detail="Une publication archivée doit d’abord être remise en brouillon.",
        )
    post.status = "published"
    post.published_at = datetime.now(UTC)
    post.published_url = str(data.published_url) if data.published_url else None
    await session.commit()
    await session.refresh(post)
    return _post_response(post)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID,
    session: SessionDep,
    context: CanManageCommunicationDep,
) -> None:
    post = await _find_post(session, context.organization.id, post_id)
    if post.status == "published":
        raise HTTPException(
            status_code=409,
            detail="Les publications déjà publiées sont conservées dans l’historique.",
        )
    media_path = (
        _media_path(context.organization.id, post.media_filename)
        if post.media_filename
        else None
    )
    await session.delete(post)
    await session.commit()
    if media_path is not None:
        await asyncio.to_thread(media_path.unlink, missing_ok=True)


@router.post("/posts/{post_id}/media", response_model=CommunicationPostResponse)
async def upload_post_media(
    post_id: uuid.UUID,
    session: SessionDep,
    context: CanManageCommunicationDep,
    media: Annotated[UploadFile, File()],
) -> CommunicationPostResponse:
    post = await _find_post(session, context.organization.id, post_id)
    if post.status in {"published", "archived"}:
        raise HTTPException(
            status_code=409,
            detail=(
                "Le média ne peut être modifié que sur un brouillon "
                "ou une publication planifiée."
            ),
        )
    content = await media.read(MAX_MEDIA_BYTES + 1)
    if not content:
        raise HTTPException(status_code=422, detail="Le fichier média est vide.")
    if len(content) > MAX_MEDIA_BYTES:
        raise HTTPException(status_code=413, detail="Le fichier média ne doit pas dépasser 25 Mo.")
    media_type = MEDIA_TYPES.get(media.content_type or "")
    if media_type is None or not media_type[1](content):
        raise HTTPException(
            status_code=415,
            detail="Format invalide. Utilisez une image JPEG, PNG, WebP ou une vidéo MP4.",
        )
    if media.content_type == "video/mp4" and post.content_format != "video":
        raise HTTPException(
            status_code=422,
            detail="Choisissez le format vidéo pour joindre une vidéo.",
        )
    filename = f"communication-{post.id.hex}-{uuid.uuid4().hex}{media_type[0]}"
    path = _media_path(context.organization.id, filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    await asyncio.to_thread(path.write_bytes, content)
    previous_filename = post.media_filename
    post.media_filename = filename
    post.media_mime_type = media.content_type
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        await asyncio.to_thread(path.unlink, missing_ok=True)
        raise HTTPException(
            status_code=409,
            detail="Le média n’a pas pu être enregistré. Réessayez.",
        ) from None
    await session.refresh(post)
    if previous_filename:
        await asyncio.to_thread(
            _media_path(context.organization.id, previous_filename).unlink,
            missing_ok=True,
        )
    return _post_response(post)


@router.delete("/posts/{post_id}/media", response_model=CommunicationPostResponse)
async def delete_post_media(
    post_id: uuid.UUID,
    session: SessionDep,
    context: CanManageCommunicationDep,
) -> CommunicationPostResponse:
    post = await _find_post(session, context.organization.id, post_id)
    if post.status in {"published", "archived"}:
        raise HTTPException(
            status_code=409,
            detail=(
                "Le média ne peut être modifié que sur un brouillon "
                "ou une publication planifiée."
            ),
        )
    if post.media_filename is None:
        raise HTTPException(status_code=404, detail="Cette publication n’a pas de média.")
    path = _media_path(context.organization.id, post.media_filename)
    post.media_filename = None
    post.media_mime_type = None
    await session.commit()
    await session.refresh(post)
    await asyncio.to_thread(path.unlink, missing_ok=True)
    return _post_response(post)


@router.get("/posts/{post_id}/media")
async def read_post_media(
    post_id: uuid.UUID,
    session: SessionDep,
    context: CanManageCommunicationDep,
) -> FileResponse:
    post = await _find_post(session, context.organization.id, post_id)
    if post.media_filename is None:
        raise HTTPException(status_code=404, detail="Média introuvable.")
    path = _media_path(context.organization.id, post.media_filename)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier média introuvable.")
    return FileResponse(
        path,
        media_type=post.media_mime_type or "application/octet-stream",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )
