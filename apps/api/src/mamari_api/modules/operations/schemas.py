import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator

TaskTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
TaskDescription = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
TaskStatus = Literal["todo", "in_progress", "done", "archived"]
TaskPriority = Literal["low", "normal", "high", "urgent"]


class CreateOperationTaskRequest(BaseModel):
    title: TaskTitle
    description: TaskDescription | None = None
    priority: TaskPriority = "normal"
    due_date: date | None = None
    assigned_user_id: uuid.UUID | None = None


class UpdateOperationTaskRequest(BaseModel):
    title: TaskTitle | None = None
    description: TaskDescription | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None
    assigned_user_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def require_update_field(self) -> "UpdateOperationTaskRequest":
        if not self.model_fields_set:
            raise ValueError("Renseignez au moins un champ à modifier.")
        return self


class OperationTaskResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    assigned_user_id: uuid.UUID | None
    assigned_user_name: str | None
    created_by_name: str
    created_at: datetime
    updated_at: datetime


class OperationTaskPageResponse(BaseModel):
    items: list[OperationTaskResponse]
    total: int
    page: int
    page_size: int


class OperationTaskSummaryResponse(BaseModel):
    total: int
    todo: int
    in_progress: int
    done: int
    overdue: int
    due_soon: int


class OperationMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    full_name: str
