import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import aliased

from mamari_api.modules.identity.dependencies import (
    CurrentMembership,
    SessionDep,
    get_current_membership,
    require_roles,
)
from mamari_api.modules.identity.models import Membership, User
from mamari_api.modules.operations.models import OperationTask
from mamari_api.modules.operations.schemas import (
    CreateOperationTaskRequest,
    OperationMemberResponse,
    OperationTaskPageResponse,
    OperationTaskResponse,
    OperationTaskSummaryResponse,
    UpdateOperationTaskRequest,
)

router = APIRouter(prefix="/operations")
CurrentOrganizationDep = Annotated[CurrentMembership, Depends(get_current_membership)]
CanManageOperationsDep = Annotated[
    CurrentMembership,
    Depends(require_roles("owner", "admin", "manager", "operator")),
]


@router.get("/members", response_model=list[OperationMemberResponse])
async def list_operation_members(
    session: SessionDep,
    context: CurrentOrganizationDep,
) -> list[OperationMemberResponse]:
    result = await session.execute(
        select(User.id, User.username, User.full_name)
        .join(Membership, Membership.user_id == User.id)
        .where(
            Membership.organization_id == context.organization.id,
            Membership.is_active.is_(True),
            User.is_active.is_(True),
        )
        .order_by(User.full_name, User.username)
    )
    return [
        OperationMemberResponse(id=user_id, username=username, full_name=full_name)
        for user_id, username, full_name in result.all()
    ]


@router.get("/summary", response_model=OperationTaskSummaryResponse)
async def read_operation_summary(
    session: SessionDep,
    context: CurrentOrganizationDep,
) -> OperationTaskSummaryResponse:
    today = date.today()
    week_end = today + timedelta(days=7)
    result = await session.execute(
        select(
            func.count(
                case(
                    (OperationTask.status.in_(("todo", "in_progress")), OperationTask.id)
                )
            ),
            func.count(case((OperationTask.status == "todo", OperationTask.id))),
            func.count(case((OperationTask.status == "in_progress", OperationTask.id))),
            func.count(case((OperationTask.status == "done", OperationTask.id))),
            func.count(
                case(
                    (
                        OperationTask.status.in_(("todo", "in_progress"))
                        & (OperationTask.due_date < today),
                        OperationTask.id,
                    )
                )
            ),
            func.count(
                case(
                    (
                        OperationTask.status.in_(("todo", "in_progress"))
                        & OperationTask.due_date.between(today, week_end),
                        OperationTask.id,
                    )
                )
            ),
        ).where(OperationTask.organization_id == context.organization.id)
    )
    total, todo, in_progress, done, overdue, due_soon = result.one()
    return OperationTaskSummaryResponse(
        total=total or 0,
        todo=todo or 0,
        in_progress=in_progress or 0,
        done=done or 0,
        overdue=overdue or 0,
        due_soon=due_soon or 0,
    )


@router.get("/tasks", response_model=OperationTaskPageResponse)
async def list_operation_tasks(
    session: SessionDep,
    context: CurrentOrganizationDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(min_length=1, max_length=160)] = None,
    task_status: Annotated[
        str | None,
        Query(alias="status", pattern="^(todo|in_progress|done|archived)$"),
    ] = None,
    priority: Annotated[
        str | None,
        Query(pattern="^(low|normal|high|urgent)$"),
    ] = None,
) -> OperationTaskPageResponse:
    assigned_user = aliased(User)
    creator = aliased(User)
    filters = [OperationTask.organization_id == context.organization.id]
    if task_status is not None:
        filters.append(OperationTask.status == task_status)
    else:
        filters.append(OperationTask.status != "archived")
    if priority is not None:
        filters.append(OperationTask.priority == priority)
    if search is not None and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                OperationTask.title.ilike(pattern),
                OperationTask.description.ilike(pattern),
            )
        )
    total = await session.scalar(
        select(func.count()).select_from(OperationTask).where(*filters)
    )
    result = await session.execute(
        select(OperationTask, assigned_user.full_name, creator.full_name)
        .outerjoin(assigned_user, assigned_user.id == OperationTask.assigned_user_id)
        .join(creator, creator.id == OperationTask.created_by_id)
        .where(*filters)
        .order_by(
            OperationTask.due_date.asc().nulls_last(),
            case(
                (OperationTask.status == "in_progress", 0),
                (OperationTask.status == "todo", 1),
                (OperationTask.status == "done", 2),
                else_=3,
            ),
            OperationTask.created_at.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return OperationTaskPageResponse(
        items=[
            OperationTaskResponse(
                id=task.id,
                title=task.title,
                description=task.description,
                status=task.status,
                priority=task.priority,
                due_date=task.due_date,
                assigned_user_id=task.assigned_user_id,
                assigned_user_name=assigned_name,
                created_by_name=creator_name,
                created_at=task.created_at,
                updated_at=task.updated_at,
            )
            for task, assigned_name, creator_name in result.all()
        ],
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/tasks",
    response_model=OperationTaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_operation_task(
    data: CreateOperationTaskRequest,
    session: SessionDep,
    context: CanManageOperationsDep,
) -> OperationTaskResponse:
    assignee_name = None
    if data.assigned_user_id is not None:
        assignee_name = await _get_active_member_name(
            session,
            context.organization.id,
            data.assigned_user_id,
        )
    task = OperationTask(
        id=uuid.uuid4(),
        organization_id=context.organization.id,
        title=data.title,
        description=data.description or None,
        status="todo",
        priority=data.priority,
        due_date=data.due_date,
        assigned_user_id=data.assigned_user_id,
        created_by_id=context.user.id,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return OperationTaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        assigned_user_id=task.assigned_user_id,
        assigned_user_name=assignee_name,
        created_by_name=context.user.full_name,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.patch("/tasks/{task_id}", response_model=OperationTaskResponse)
async def update_operation_task(
    task_id: uuid.UUID,
    data: UpdateOperationTaskRequest,
    session: SessionDep,
    context: CanManageOperationsDep,
) -> OperationTaskResponse:
    task = await session.scalar(
        select(OperationTask).where(
            OperationTask.id == task_id,
            OperationTask.organization_id == context.organization.id,
        )
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")

    changes = data.model_dump(exclude_unset=True)
    if "title" in changes and changes["title"] is None:
        raise HTTPException(status_code=422, detail="Le titre ne peut pas être vide.")
    if "status" in changes and changes["status"] is None:
        raise HTTPException(status_code=422, detail="Le statut ne peut pas être vide.")
    if "priority" in changes and changes["priority"] is None:
        raise HTTPException(status_code=422, detail="La priorité ne peut pas être vide.")
    if changes.get("assigned_user_id") is not None:
        await _get_active_member_name(
            session,
            context.organization.id,
            changes["assigned_user_id"],
        )
    for field, value in changes.items():
        if field == "description":
            value = value or None
        setattr(task, field, value)
    await session.commit()
    await session.refresh(task)
    return await _task_response(session, task)


async def _get_active_member_name(
    session: SessionDep,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
) -> str:
    result = await session.execute(
        select(User.full_name)
        .join(Membership, Membership.user_id == User.id)
        .where(
            User.id == user_id,
            User.is_active.is_(True),
            Membership.organization_id == organization_id,
            Membership.is_active.is_(True),
        )
    )
    name = result.scalar_one_or_none()
    if name is None:
        raise HTTPException(
            status_code=404,
            detail="Le collaborateur sélectionné n'appartient pas à cette organisation.",
        )
    return name


async def _task_response(
    session: SessionDep,
    task: OperationTask,
) -> OperationTaskResponse:
    assigned_name = None
    if task.assigned_user_id is not None:
        assigned_name = await session.scalar(
            select(User.full_name).where(User.id == task.assigned_user_id)
        )
    creator_name = await session.scalar(select(User.full_name).where(User.id == task.created_by_id))
    return OperationTaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        assigned_user_id=task.assigned_user_id,
        assigned_user_name=assigned_name,
        created_by_name=creator_name or "",
        created_at=task.created_at,
        updated_at=task.updated_at,
    )
