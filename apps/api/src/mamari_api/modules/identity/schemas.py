import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

Password = Annotated[str, StringConstraints(min_length=6, max_length=128)]
Username = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        min_length=3,
        max_length=32,
        pattern=r"(?i)^[a-z0-9][a-z0-9._-]*$",
    ),
]
FullName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]

class LoginRequest(BaseModel):
    username: Username
    password: Password


class CreateUserRequest(BaseModel):
    username: Username
    full_name: FullName
    password: Password
    role: Literal["admin", "manager", "operator", "reader"]


class MembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    organization_id: uuid.UUID
    organization_name: str
    organization_slug: str
    role: Literal["owner", "admin", "manager", "operator", "reader"]


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    full_name: str
    memberships: list[MembershipResponse]


class OrganizationUserResponse(BaseModel):
    id: uuid.UUID
    username: str
    full_name: str
    role: Literal["owner", "admin", "manager", "operator", "reader"]


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    role: Literal["owner", "admin", "manager", "operator", "reader"]
    created_at: datetime


class MessageResponse(BaseModel):
    message: str
