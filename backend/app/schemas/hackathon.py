from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

HackathonStatusLiteral = Literal["draft", "active", "finished"]

_DEFAULT_JURY_CRITERIA = [
    {"key": "design", "label": "Дизайн и UX", "weight": 34},
    {"key": "pitch", "label": "Питч и идея", "weight": 33},
    {"key": "complexity", "label": "Техническая сложность", "weight": 33},
]


class CriterionIn(BaseModel):
    key: str = Field(..., min_length=1, max_length=64)
    label: str = Field(..., min_length=1, max_length=128)
    weight: int = Field(..., ge=0, le=100)


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
    jury_criteria: list[CriterionIn] = Field(default_factory=lambda: [CriterionIn(**c) for c in _DEFAULT_JURY_CRITERIA])
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
    jury_criteria: list[CriterionIn] | None = None
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
    jury_criteria: list[CriterionIn] = Field(default_factory=lambda: [CriterionIn(**c) for c in _DEFAULT_JURY_CRITERIA])
    max_team_size: int = 5
    organizer_id: int
    teams_count: int = 0
    jury_count: int = 0

    @field_validator("status", mode="before")
    @classmethod
    def _coerce_status(cls, v):
        return getattr(v, "value", v)
