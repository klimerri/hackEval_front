from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

TeamStatusLiteral = Literal["pending", "approved", "rejected"]
TeamMemberRoleLiteral = Literal["captain", "member"]

class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    hackathon_id: int
    notes: str = ""
    members: list[EmailStr] = []

class TeamMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    name: str
    email: EmailStr
    role: str

    @field_validator("role", mode="before")
    @classmethod
    def _coerce(cls, v):
        return getattr(v, "value", v)

class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    hackathon_id: int
    status: str
    invite_code: str
    github_url: str | None = None
    docs_url: str | None = None
    presentation_url: str | None = None
    video_url: str | None = None
    notes: str = ""
    has_archive: bool = False
    has_doc_file: bool = False
    has_presentation_file: bool = False
    has_video_file: bool = False
    applied_at: datetime
    decided_at: datetime | None = None
    members: list[TeamMemberOut] = []

    @field_validator("status", mode="before")
    @classmethod
    def _coerce_status(cls, v):
        return getattr(v, "value", v)

    @field_validator(
        "notes",
        "invite_code",
        "github_url",
        "docs_url",
        "presentation_url",
        "video_url",
        mode="before",
    )
    @classmethod
    def _none_to_default(cls, v):
        if v is None:
            return ""
        return v

class TeamDecision(BaseModel):
    decision: TeamStatusLiteral

class TeamAddManual(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    captain_email: EmailStr
    hackathon_id: int

class SubmissionUpdate(BaseModel):
    github_url: str | None = None
    docs_url: str | None = None
    presentation_url: str | None = None
    video_url: str | None = None

class TeamUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    notes: str | None = None

class JoinRequestCreate(BaseModel):
    message: str = ""

class JoinRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    team_id: int
    user_id: int
    status: str
    message: str
    created_at: datetime
    decided_at: datetime | None = None
    user_name: str = ""
    user_email: str = ""

    @field_validator("status", mode="before")
    @classmethod
    def _coerce_status(cls, v):
        return getattr(v, "value", v)

    @field_validator("message", mode="before")
    @classmethod
    def _none_to_empty(cls, v):
        return v or ""

class JoinRequestDecision(BaseModel):
    decision: Literal["approved", "rejected"]
