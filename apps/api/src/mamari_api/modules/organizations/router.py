import asyncio
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from mamari_api.core.config import get_settings
from mamari_api.modules.identity.dependencies import (
    CurrentMembership,
    SessionDep,
    get_current_membership,
    require_roles,
)
from mamari_api.modules.identity.models import Membership, User
from mamari_api.modules.identity.schemas import (
    CreateUserRequest,
    OrganizationMemberResponse,
    OrganizationResponse,
    OrganizationUserResponse,
    UpdateOrganizationRequest,
    UpdateOrganizationUserRequest,
)
from mamari_api.modules.identity.service import create_organization_user

router = APIRouter(prefix="/organizations")
CurrentOrganizationDep = Annotated[CurrentMembership, Depends(get_current_membership)]
CanManageMembersDep = Annotated[
    CurrentMembership,
    Depends(require_roles("owner", "admin")),
]
MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024
PROFILE_PHOTO_TYPES = {
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (
        ".webp",
        lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
    ),
}


def _profile_photo_path(organization_id: uuid.UUID, filename: str) -> Path:
    if (
        Path(filename).name != filename
        or not filename.startswith("member-")
        or Path(filename).suffix not in {".jpg", ".png", ".webp"}
    ):
        raise HTTPException(status_code=404, detail="Photo introuvable.")
    return get_settings().upload_directory / str(organization_id) / filename


def _member_response(
    user: User,
    membership: Membership,
) -> OrganizationMemberResponse:
    return OrganizationMemberResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=membership.role,
        phone=membership.phone,
        photo_url=(
            f"/organizations/users/{user.id}/photo" if membership.photo_filename else None
        ),
        is_active=membership.is_active and user.is_active,
    )


@router.get(
    "/current",
    response_model=OrganizationResponse,
    summary="Consulter l'organisation active",
)
async def read_current_organization(context: CurrentOrganizationDep) -> OrganizationResponse:
    return OrganizationResponse(
        id=context.organization.id,
        name=context.organization.name,
        slug=context.organization.slug,
        description=context.organization.description,
        legal_form=context.organization.legal_form,
        phone=context.organization.phone,
        email=context.organization.email,
        address=context.organization.address,
        website=context.organization.website,
        facebook_url=context.organization.facebook_url,
        tiktok_url=context.organization.tiktok_url,
        role=context.membership.role,
        created_at=context.organization.created_at,
    )


@router.patch(
    "/current",
    response_model=OrganizationResponse,
    summary="Modifier la fiche de l’entreprise",
)
async def update_current_organization(
    data: UpdateOrganizationRequest,
    session: SessionDep,
    context: CanManageMembersDep,
) -> OrganizationResponse:
    changes = data.model_dump(exclude_unset=True, mode="json")
    for field, value in changes.items():
        setattr(context.organization, field, value)
    await session.commit()
    await session.refresh(context.organization)
    return OrganizationResponse(
        id=context.organization.id,
        name=context.organization.name,
        slug=context.organization.slug,
        description=context.organization.description,
        legal_form=context.organization.legal_form,
        phone=context.organization.phone,
        email=context.organization.email,
        address=context.organization.address,
        website=context.organization.website,
        facebook_url=context.organization.facebook_url,
        tiktok_url=context.organization.tiktok_url,
        role=context.membership.role,
        created_at=context.organization.created_at,
    )


@router.post(
    "/users",
    response_model=OrganizationUserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un compte utilisateur",
)
async def create_user(
    data: CreateUserRequest,
    session: SessionDep,
    context: Annotated[
        CurrentMembership,
        Depends(require_roles("owner", "admin")),
    ],
) -> OrganizationUserResponse:
    user, membership = await create_organization_user(session, context.organization, data)
    return OrganizationUserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=membership.role,
        phone=membership.phone,
        is_active=membership.is_active,
    )


@router.get("/users", response_model=list[OrganizationMemberResponse])
async def list_users(
    session: SessionDep,
    context: CanManageMembersDep,
) -> list[OrganizationMemberResponse]:
    result = await session.execute(
        select(User, Membership)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.organization_id == context.organization.id)
        .order_by(Membership.is_active.desc(), User.full_name, User.username)
    )
    return [_member_response(user, membership) for user, membership in result.all()]


@router.patch("/users/{user_id}", response_model=OrganizationMemberResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UpdateOrganizationUserRequest,
    session: SessionDep,
    context: CanManageMembersDep,
) -> OrganizationMemberResponse:
    result = await session.execute(
        select(User, Membership)
        .join(Membership, Membership.user_id == User.id)
        .where(
            User.id == user_id,
            Membership.organization_id == context.organization.id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Collaborateur introuvable.")
    user, membership = row
    changes = data.model_dump(exclude_unset=True)
    if membership.role == "owner" and "role" in changes:
        raise HTTPException(
            status_code=422,
            detail="Le rôle propriétaire ne peut pas être modifié ici.",
        )
    if membership.role == "owner" and context.membership.role != "owner":
        raise HTTPException(
            status_code=403,
            detail="Seul le propriétaire peut modifier son propre compte.",
        )
    if user.id == context.user.id and changes.get("is_active") is False:
        raise HTTPException(
            status_code=422,
            detail="Vous ne pouvez pas désactiver votre propre compte.",
        )
    if user.id == context.user.id and "role" in changes:
        raise HTTPException(
            status_code=422,
            detail="Vous ne pouvez pas modifier votre propre rôle.",
        )
    for field in ("full_name",):
        if field in changes:
            setattr(user, field, changes[field])
    for field in ("role", "phone", "is_active"):
        if field in changes:
            setattr(membership, field, changes[field])
    await session.commit()
    await session.refresh(user)
    await session.refresh(membership)
    return _member_response(user, membership)


@router.put("/users/{user_id}/photo", response_model=OrganizationMemberResponse)
async def upload_user_photo(
    user_id: uuid.UUID,
    session: SessionDep,
    context: CanManageMembersDep,
    photo: Annotated[UploadFile, File()],
) -> OrganizationMemberResponse:
    result = await session.execute(
        select(User, Membership)
        .join(Membership, Membership.user_id == User.id)
        .where(
            User.id == user_id,
            Membership.organization_id == context.organization.id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Collaborateur introuvable.")
    user, membership = row
    content = await photo.read(MAX_PROFILE_PHOTO_BYTES + 1)
    if not content:
        raise HTTPException(status_code=422, detail="Le fichier photo est vide.")
    if len(content) > MAX_PROFILE_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="La photo ne doit pas dépasser 5 Mo.")
    photo_type = PROFILE_PHOTO_TYPES.get(photo.content_type or "")
    if photo_type is None or not photo_type[1](content):
        raise HTTPException(
            status_code=415,
            detail="Format photo invalide. Utilisez une image JPEG, PNG ou WebP.",
        )

    filename = f"member-{user.id.hex}-{uuid.uuid4().hex}{photo_type[0]}"
    path = _profile_photo_path(context.organization.id, filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    await asyncio.to_thread(path.write_bytes, content)
    old_filename = membership.photo_filename
    membership.photo_filename = filename
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=409,
            detail="La photo n’a pas pu être enregistrée. Réessayez.",
        ) from None
    await session.refresh(membership)
    if old_filename:
        _profile_photo_path(context.organization.id, old_filename).unlink(missing_ok=True)
    return _member_response(user, membership)


@router.get("/users/{user_id}/photo")
async def read_user_photo(
    user_id: uuid.UUID,
    session: SessionDep,
    context: CurrentOrganizationDep,
) -> FileResponse:
    filename = await session.scalar(
        select(Membership.photo_filename).where(
            Membership.user_id == user_id,
            Membership.organization_id == context.organization.id,
            Membership.is_active.is_(True),
        )
    )
    if filename is None:
        raise HTTPException(status_code=404, detail="Photo introuvable.")
    if (
        context.user.id != user_id
        and context.membership.role not in {"owner", "admin", "manager"}
    ):
        raise HTTPException(
            status_code=403,
            detail="Vous ne pouvez consulter que votre propre photo de profil.",
        )
    path = _profile_photo_path(context.organization.id, filename)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier photo introuvable sur le serveur.")
    return FileResponse(path, headers={"Cache-Control": "no-store"})
