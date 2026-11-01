from typing import Annotated

from fastapi import APIRouter, Depends, status

from mamari_api.modules.identity.dependencies import (
    CurrentMembership,
    SessionDep,
    get_current_membership,
    require_roles,
)
from mamari_api.modules.identity.schemas import (
    CreateUserRequest,
    OrganizationResponse,
    OrganizationUserResponse,
)
from mamari_api.modules.identity.service import create_organization_user

router = APIRouter(prefix="/organizations")
CurrentOrganizationDep = Annotated[CurrentMembership, Depends(get_current_membership)]


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
    )
