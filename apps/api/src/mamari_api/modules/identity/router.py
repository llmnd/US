import uuid

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from mamari_api.core.config import get_settings
from mamari_api.modules.identity.dependencies import CurrentUserDep, SessionDep
from mamari_api.modules.identity.models import Membership, Organization, User
from mamari_api.modules.identity.schemas import (
    LoginRequest,
    MembershipResponse,
    MessageResponse,
    UserResponse,
)
from mamari_api.modules.identity.security import create_access_token
from mamari_api.modules.identity.service import authenticate_user

router = APIRouter(prefix="/auth")


async def user_response(session: SessionDep, user: User) -> UserResponse:
    result = await session.execute(
        select(Membership, Organization)
        .join(Organization, Membership.organization_id == Organization.id)
        .where(
            Membership.user_id == user.id,
            Membership.is_active.is_(True),
            Organization.is_active.is_(True),
        )
        .order_by(Organization.name)
    )
    memberships = [
        MembershipResponse(
            organization_id=organization.id,
            organization_name=organization.name,
            organization_slug=organization.slug,
            role=membership.role,
        )
        for membership, organization in result.all()
    ]
    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        memberships=memberships,
    )


def set_session_cookie(response: Response, user_id: uuid.UUID) -> None:
    token, lifetime = create_access_token(user_id)
    response.set_cookie(
        key="access_token",
        value=token,
        max_age=lifetime,
        httponly=True,
        secure=get_settings().app_env == "production",
        samesite="lax",
        path="/",
    )


@router.post("/login", response_model=UserResponse, summary="Ouvrir une session")
async def login(data: LoginRequest, response: Response, session: SessionDep) -> UserResponse:
    user = await authenticate_user(session, data.username, data.password)
    authenticated_user = await user_response(session, user)
    if not authenticated_user.memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Aucune organisation active n'est associée à ce compte.",
        )
    set_session_cookie(response, user.id)
    return authenticated_user


@router.post("/logout", response_model=MessageResponse, summary="Fermer la session")
async def logout(response: Response) -> MessageResponse:
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=get_settings().app_env == "production",
        samesite="lax",
        path="/",
    )
    return MessageResponse(message="Session fermée.")


@router.get("/me", response_model=UserResponse, summary="Consulter le compte connecté")
async def read_current_user(session: SessionDep, user: CurrentUserDep) -> UserResponse:
    return await user_response(session, user)
