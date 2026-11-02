import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from mamari_api.core.config import get_settings
from mamari_api.modules.agriculture.catalog import DEFAULT_CROP_NAMES
from mamari_api.modules.agriculture.models import Crop
from mamari_api.modules.identity.models import Membership, MembershipRole, Organization, User
from mamari_api.modules.identity.schemas import CreateUserRequest
from mamari_api.modules.identity.security import hash_password, verify_password


async def ensure_bootstrap_admin(
    session: AsyncSession,
    username: str,
    password: str,
) -> None:
    organization = await session.scalar(
        select(Organization).where(Organization.slug == "mamari")
    )
    if organization is None:
        organization = Organization(name="Mamari", slug="mamari")
        session.add(organization)
        await session.flush()

    has_crops = await session.scalar(
        select(Crop.id).where(Crop.organization_id == organization.id).limit(1)
    )
    if has_crops is None:
        session.add_all(
            Crop(organization_id=organization.id, name=name) for name in DEFAULT_CROP_NAMES
        )

    user = await session.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(
            username=username,
            full_name="Administrateur Mamari",
            password_hash=hash_password(password),
        )
        session.add(user)
        await session.flush()

    membership = await session.scalar(
        select(Membership).where(
            Membership.organization_id == organization.id,
            Membership.user_id == user.id,
        )
    )
    if membership is None:
        session.add(
            Membership(
                organization_id=organization.id,
                user_id=user.id,
                role=MembershipRole.OWNER.value,
            )
        )
    await session.commit()


async def create_organization_user(
    session: AsyncSession,
    organization: Organization,
    data: CreateUserRequest,
) -> tuple[User, Membership]:
    existing_user = await session.scalar(select(User.id).where(User.username == data.username))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cet identifiant est déjà utilisé. Choisissez-en un autre.",
        )

    user = User(
        id=uuid.uuid4(),
        username=data.username,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
    )
    membership = Membership(
        organization_id=organization.id,
        user_id=user.id,
        role=data.role,
        phone=data.phone or None,
    )
    session.add(user)
    try:
        await session.flush()
        session.add(membership)
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        constraint = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
        if constraint == "uq_users_username" or str(error.orig) == (
            "UNIQUE constraint failed: users.username"
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cet identifiant est déjà utilisé. Choisissez-en un autre.",
            ) from None
        raise
    await session.refresh(user)
    await session.refresh(membership)
    return user, membership


async def authenticate_user(
    session: AsyncSession,
    username: str,
    password: str,
) -> User:
    normalized_username = username.casefold()
    user = await session.scalar(select(User).where(User.username == normalized_username))
    settings = get_settings()
    if (
        user is None
        and normalized_username == settings.bootstrap_admin_username.casefold()
        and password == settings.bootstrap_admin_password.get_secret_value()
    ):
        await ensure_bootstrap_admin(
            session,
            settings.bootstrap_admin_username,
            settings.bootstrap_admin_password.get_secret_value(),
        )
        user = await session.scalar(select(User).where(User.username == normalized_username))

    if not verify_password(password, user.password_hash if user is not None else None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiant ou mot de passe invalide.",
            headers={"WWW-Authenticate": "Cookie"},
        )
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiant ou mot de passe invalide.",
            headers={"WWW-Authenticate": "Cookie"},
        )
    return user
