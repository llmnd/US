import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from mamari_api.modules.agriculture.models import Harvest, Parcel
from mamari_api.modules.agriculture.schemas import (
    CreateHarvestRequest,
    CreateParcelRequest,
    HarvestPageResponse,
    HarvestResponse,
    ParcelPageResponse,
    ParcelResponse,
)
from mamari_api.modules.identity.dependencies import (
    CurrentMembership,
    SessionDep,
    get_current_membership,
    require_roles,
)

router = APIRouter(prefix="/agriculture")
CurrentOrganizationDep = Annotated[CurrentMembership, Depends(get_current_membership)]
CanManageAgricultureDep = Annotated[
    CurrentMembership,
    Depends(require_roles("owner", "admin", "manager", "operator")),
]


@router.get(
    "/parcels",
    response_model=ParcelPageResponse,
    summary="Lister les parcelles de l'organisation",
)
async def list_parcels(
    session: SessionDep,
    context: CurrentOrganizationDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    search: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
) -> ParcelPageResponse:
    filters = [Parcel.organization_id == context.organization.id]
    if search is not None and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(or_(Parcel.name.ilike(pattern), Parcel.crop.ilike(pattern)))

    total = await session.scalar(select(func.count()).select_from(Parcel).where(*filters))
    parcels = await session.scalars(
        select(Parcel)
        .where(*filters)
        .order_by(Parcel.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return ParcelPageResponse(
        items=list(parcels.all()),
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/parcels",
    response_model=ParcelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une parcelle",
)
async def create_parcel(
    data: CreateParcelRequest,
    session: SessionDep,
    context: CanManageAgricultureDep,
) -> Parcel:
    parcel = Parcel(
        id=uuid.uuid4(),
        organization_id=context.organization.id,
        created_by_id=context.user.id,
        name=data.name,
        crop=data.crop,
        area_hectares=data.area_hectares,
    )
    session.add(parcel)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        constraint_name = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
        sqlite_duplicate = str(error.orig) == (
            "UNIQUE constraint failed: "
            "agriculture_parcels.organization_id, agriculture_parcels.name"
        )
        if constraint_name != "uq_agriculture_parcels_org_name" and not sqlite_duplicate:
            raise
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une parcelle porte déjà ce nom dans l'organisation.",
        ) from error
    await session.refresh(parcel)
    return parcel


@router.get(
    "/harvests",
    response_model=HarvestPageResponse,
    summary="Consulter les récoltes de l'organisation",
)
async def list_harvests(
    session: SessionDep,
    context: CurrentOrganizationDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
) -> HarvestPageResponse:
    filters = [
        Harvest.organization_id == context.organization.id,
        Parcel.organization_id == context.organization.id,
    ]
    if search is not None and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(or_(Parcel.name.ilike(pattern), Parcel.crop.ilike(pattern)))

    total = await session.scalar(
        select(func.count())
        .select_from(Harvest)
        .join(Parcel, Harvest.parcel_id == Parcel.id)
        .where(*filters)
    )
    result = await session.execute(
        select(Harvest, Parcel)
        .join(Parcel, Harvest.parcel_id == Parcel.id)
        .where(*filters)
        .order_by(Harvest.harvest_date.desc(), Harvest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return HarvestPageResponse(
        items=[
            HarvestResponse(
                id=harvest.id,
                parcel_id=parcel.id,
                parcel_name=parcel.name,
                crop=parcel.crop,
                harvest_date=harvest.harvest_date,
                quantity_kg=harvest.quantity_kg,
                notes=harvest.notes,
                created_at=harvest.created_at,
            )
            for harvest, parcel in result.all()
        ],
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/harvests",
    response_model=HarvestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enregistrer une récolte",
)
async def create_harvest(
    data: CreateHarvestRequest,
    session: SessionDep,
    context: CanManageAgricultureDep,
) -> HarvestResponse:
    parcel = await session.scalar(
        select(Parcel).where(
            Parcel.id == data.parcel_id,
            Parcel.organization_id == context.organization.id,
            Parcel.is_active.is_(True),
        )
    )
    if parcel is None:
        raise HTTPException(status_code=404, detail="Parcelle introuvable ou inactive.")

    harvest = Harvest(
        id=uuid.uuid4(),
        organization_id=context.organization.id,
        parcel_id=parcel.id,
        created_by_id=context.user.id,
        harvest_date=data.harvest_date,
        quantity_kg=data.quantity_kg,
        notes=data.notes,
    )
    session.add(harvest)
    await session.commit()
    await session.refresh(harvest)
    return HarvestResponse(
        id=harvest.id,
        parcel_id=parcel.id,
        parcel_name=parcel.name,
        crop=parcel.crop,
        harvest_date=harvest.harvest_date,
        quantity_kg=harvest.quantity_kg,
        notes=harvest.notes,
        created_at=harvest.created_at,
    )
