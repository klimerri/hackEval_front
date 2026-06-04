from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

HackathonStatusLiteral = Literal["draft", "active", "finished"]


class HackathonCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    rules: list[str] = []
    start_date: datetime
    end_date: datetime
    submission_deadline: datetime
    prize_pool: str = ""
    image_url: str = ""
    type: str = "Online"
    coefficients: dict[str, int] = Field(default_factory=lambda: {"code": 40, "design": 30, "pitch": 30})
    max_team_size: int = 5


class HackathonUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    rules: list[str] | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    submission_deadline: datetime | None = None
    status: HackathonStatusLiteral | None = None
    prize_pool: str | None = None
    image_url: str | None = None
    type: str | None = None
    coefficients: dict[str, int] | None = None
    max_team_size: int | None = None


class HackathonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str = ""
    rules: list[str] = []
    start_date: datetime
    end_date: datetime
    submission_deadline: datetime
    status: str
    prize_pool: str = ""
    image_url: str = ""
    type: str = "Online"
    coefficients: dict[str, int] = Field(default_factory=lambda: {"code": 40, "design": 30, "pitch": 30})
    max_team_size: int = 5
    organizer_id: int
    teams_count: int = 0
    jury_count: int = 0

    @field_validator("status", mode="before")
    @classmethod
    def _coerce_status(cls, v):
        return getattr(v, "value", v)
