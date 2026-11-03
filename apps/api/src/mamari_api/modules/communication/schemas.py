import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, HttpUrl, StringConstraints, model_validator

SocialPlatform = Literal["tiktok", "facebook", "both"]
ContentFormat = Literal["video", "photo", "story"]
PostStatus = Literal["draft", "scheduled", "published", "archived"]
PostTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
PostCaption = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=5000)
]
PostHashtags = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)
]


class CreateCommunicationPostRequest(BaseModel):
    title: PostTitle
    caption: PostCaption
    hashtags: PostHashtags | None = None
    platform: SocialPlatform
    content_format: ContentFormat
    status: Literal["draft", "scheduled"] = "draft"
    scheduled_date: date | None = None

    @model_validator(mode="after")
    def validate_schedule(self) -> "CreateCommunicationPostRequest":
        if self.status == "scheduled" and self.scheduled_date is None:
            raise ValueError("Choisissez une date pour planifier la publication.")
        if self.status == "scheduled" and self.scheduled_date < date.today():
            raise ValueError("La date de planification ne peut pas être antérieure à aujourd’hui.")
        return self


class UpdateCommunicationPostRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: PostTitle | None = None
    caption: PostCaption | None = None
    hashtags: PostHashtags | None = None
    platform: SocialPlatform | None = None
    content_format: ContentFormat | None = None
    scheduled_date: date | None = None
    status: Literal["draft", "scheduled", "archived"] | None = None

    @model_validator(mode="after")
    def require_changes(self) -> "UpdateCommunicationPostRequest":
        if not self.model_fields_set:
            raise ValueError("Indiquez au moins une information à mettre à jour.")
        nullable_fields = {"hashtags", "scheduled_date"}
        invalid_null_fields = {
            field
            for field in self.model_fields_set - nullable_fields
            if getattr(self, field) is None
        }
        if invalid_null_fields:
            raise ValueError("Les champs renseignés ne peuvent pas être vides.")
        return self


class MarkCommunicationPostPublishedRequest(BaseModel):
    published_url: HttpUrl | None = None


class CommunicationPostResponse(BaseModel):
    id: uuid.UUID
    title: str
    caption: str
    hashtags: str | None
    platform: SocialPlatform
    content_format: ContentFormat
    status: PostStatus
    scheduled_date: date | None
    published_at: datetime | None
    published_url: str | None
    media_url: str | None
    media_mime_type: str | None
    created_at: datetime
    updated_at: datetime


class CommunicationPostPageResponse(BaseModel):
    items: list[CommunicationPostResponse]
    total: int
    page: int
    page_size: int


class CommunicationSummaryResponse(BaseModel):
    total: int
    drafts: int
    scheduled: int
    published: int
    upcoming: int
