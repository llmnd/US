import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import aliased

from mamari_api.modules.identity.dependencies import (
    CurrentMembership,
    SessionDep,
    get_current_membership,
    require_roles,
)
from mamari_api.modules.identity.models import Membership, User
from mamari_api.modules.operations.models import OperationTask, OperationTaskUpdate
from mamari_api.modules.operations.schemas import (
    CreateOperationTaskRequest,
    OperationMemberResponse,
    OperationTaskPageResponse,
    OperationTaskResponse,
    OperationTaskSummaryResponse,
    OperationTaskUpdateResponse,
    UpdateOperationTaskRequest,
)

router = APIRouter(prefix="/operations")
CurrentOrganizationDep = Annotated[CurrentMembership, Depends(get_current_membership)]
CanManageOperationsDep = Annotated[
    CurrentMembership,
    Depends(require_roles("owner", "admin", "manager")),
]
CanViewOperationTeamDep = Annotated[
    CurrentMembership,
    Depends(require_roles("owner", "admin", "manager")),
]


@router.get("/members", response_model=list[OperationMemberResponse])
async def list_operation_members(
    session: SessionDep,
    context: CanViewOperationTeamDep,
) -> list[OperationMemberResponse]:
    result = await session.execute(
        select(
            User.id,
            User.username,
            User.full_name,
            Membership.role,
            Membership.phone,
            Membership.photo_filename,
        )
        .join(Membership, Membership.user_id == User.id)
        .where(
            Membership.organization_id == context.organization.id,
            Membership.is_active.is_(True),
            User.is_active.is_(True),
        )
        .order_by(User.full_name, User.username)
    )
    return [
        OperationMemberResponse(
            id=user_id,
            username=username,
            full_name=full_name,
            role=role,
            phone=phone,
            photo_url=(
                f"/organizations/users/{user_id}/photo" if photo_filename else None
            ),
        )
        for user_id, username, full_name, role, phone, photo_filename in result.all()
    ]


@router.get("/summary", response_model=OperationTaskSummaryResponse)
async def read_operation_summary(
    session: SessionDep,
    context: CurrentOrganizationDep,
) -> OperationTaskSummaryResponse:
    today = date.today()
    week_end = today + timedelta(days=7)
    filters = [OperationTask.organization_id == context.organization.id]
    if context.membership.role == "operator":
        filters.append(OperationTask.assigned_user_id == context.user.id)
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
        ).where(*filters)
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
    bucket: Annotated[
        str | None,
        Query(pattern="^(open|overdue)$"),
    ] = None,
    priority: Annotated[
        str | None,
        Query(pattern="^(low|normal|high|urgent)$"),
    ] = None,
) -> OperationTaskPageResponse:
    assigned_user = aliased(User)
    creator = aliased(User)
    filters = [OperationTask.organization_id == context.organization.id]
    if context.membership.role == "operator":
        filters.append(OperationTask.assigned_user_id == context.user.id)
    if bucket == "open":
        filters.append(OperationTask.status.in_(("todo", "in_progress")))
    elif bucket == "overdue":
        filters.extend(
            (
                OperationTask.status.in_(("todo", "in_progress")),
                OperationTask.due_date < date.today(),
            )
        )
    elif task_status is not None:
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
        select(
            OperationTask,
            assigned_user.full_name,
            creator.full_name,
            Membership.phone,
            Membership.photo_filename,
        )
        .outerjoin(assigned_user, assigned_user.id == OperationTask.assigned_user_id)
        .outerjoin(
            Membership,
            and_(
                Membership.user_id == OperationTask.assigned_user_id,
                Membership.organization_id == OperationTask.organization_id,
            ),
        )
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
    show_member_contacts = context.membership.role in {"owner", "admin", "manager"}
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
                assigned_user_phone=assignee_phone if show_member_contacts else None,
                assigned_user_photo_url=(
                    f"/organizations/users/{task.assigned_user_id}/photo"
                    if assignee_photo
                    and (
                        show_member_contacts
                        or context.membership.role == "operator"
                    )
                    else None
                ),
                created_by_name=creator_name,
                progress_note=task.progress_note,
                delay_reason=task.delay_reason,
                created_at=task.created_at,
                updated_at=task.updated_at,
            )
            for task, assigned_name, creator_name, assignee_phone, assignee_photo in result.all()
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
    if data.assigned_user_id is not None:
        await _get_active_member_name(
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
    return await _task_response(session, task)


@router.patch("/tasks/{task_id}", response_model=OperationTaskResponse)
async def update_operation_task(
    task_id: uuid.UUID,
    data: UpdateOperationTaskRequest,
    session: SessionDep,
    context: CurrentOrganizationDep,
) -> OperationTaskResponse:
    if context.membership.role not in {"owner", "admin", "manager", "operator"}:
        raise HTTPException(status_code=403, detail="Votre rôle ne permet pas cette action.")
    task = await session.scalar(
        select(OperationTask).where(
            OperationTask.id == task_id,
            OperationTask.organization_id == context.organization.id,
        )
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")

    changes = data.model_dump(exclude_unset=True)
    is_operator = context.membership.role == "operator"
    if is_operator:
        if task.assigned_user_id != context.user.id:
            raise HTTPException(status_code=403, detail="Cette tâche ne vous est pas attribuée.")
        expected_status = (
            "in_progress" if task.status == "todo"
            else "done" if task.status == "in_progress"
            else None
        )
        if set(changes) - {"status", "progress_note", "delay_reason"}:
            raise HTTPException(
                status_code=403,
                detail="Vous pouvez uniquement mettre à jour l’avancement de votre tâche.",
            )
        if "status" in changes and changes["status"] != expected_status:
            raise HTTPException(
                status_code=422,
                detail="Faites avancer la tâche dans l’ordre prévu : démarrage, puis achèvement.",
            )
        if not changes or (
            not changes.get("status")
            and not changes.get("progress_note")
            and not changes.get("delay_reason")
        ):
            raise HTTPException(
                status_code=422,
                detail="Renseignez un avancement ou un compte rendu.",
            )
        if (
            "status" in changes
            and task.due_date is not None
            and task.due_date < date.today()
            and not changes.get("delay_reason", task.delay_reason)
        ):
            raise HTTPException(
                status_code=422,
                detail="Justifiez le retard avant de mettre à jour cette tâche.",
            )
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
    previous_status = task.status
    for field, value in changes.items():
        if (
            field in {"title", "status", "priority"}
            and value is None
        ):
            raise HTTPException(
                status_code=422,
                detail=f"Le champ {field} ne peut pas être vide.",
            )
        if field == "description":
            value = value or None
        setattr(task, field, value)
    if (
        task.status != previous_status
        or "progress_note" in changes
        or "delay_reason" in changes
    ):
        session.add(
            OperationTaskUpdate(
                organization_id=context.organization.id,
                task_id=task.id,
                user_id=context.user.id,
                status=task.status if task.status != previous_status else None,
                note=changes.get("progress_note"),
                delay_reason=changes.get("delay_reason"),
            )
        )
    await session.commit()
    await session.refresh(task)
    return await _task_response(session, task)


@router.get(
    "/tasks/{task_id}/updates",
    response_model=list[OperationTaskUpdateResponse],
)
async def list_task_updates(
    task_id: uuid.UUID,
    session: SessionDep,
    context: CurrentOrganizationDep,
) -> list[OperationTaskUpdateResponse]:
    task = await session.scalar(
        select(OperationTask).where(
            OperationTask.id == task_id,
            OperationTask.organization_id == context.organization.id,
        )
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")
    if context.membership.role == "operator" and task.assigned_user_id != context.user.id:
        raise HTTPException(status_code=403, detail="Cette tâche ne vous est pas attribuée.")
    result = await session.execute(
        select(
            OperationTaskUpdate,
            User.full_name,
        )
        .join(User, User.id == OperationTaskUpdate.user_id)
        .where(
            OperationTaskUpdate.task_id == task_id,
            OperationTaskUpdate.organization_id == context.organization.id,
        )
        .order_by(OperationTaskUpdate.created_at.desc())
        .limit(50)
    )
    return [
        OperationTaskUpdateResponse(
            id=update.id,
            user_id=update.user_id,
            user_name=user_name,
            status=update.status,
            note=update.note,
            delay_reason=update.delay_reason,
            created_at=update.created_at,
        )
        for update, user_name in result.all()
    ]


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
    assigned_phone = None
    assigned_photo = None
    if task.assigned_user_id is not None:
        assignment = await session.execute(
            select(User.full_name, Membership.phone, Membership.photo_filename)
            .join(Membership, Membership.user_id == User.id)
            .where(
                User.id == task.assigned_user_id,
                Membership.organization_id == task.organization_id,
            )
        )
        assignment_row = assignment.one_or_none()
        if assignment_row:
            assigned_name, assigned_phone, assigned_photo = assignment_row
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
        assigned_user_phone=assigned_phone,
        assigned_user_photo_url=(
            f"/organizations/users/{task.assigned_user_id}/photo"
            if assigned_photo
            else None
        ),
        created_by_name=creator_name or "",
        progress_note=task.progress_note,
        delay_reason=task.delay_reason,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )
