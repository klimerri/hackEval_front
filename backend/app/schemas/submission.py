from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

SubmissionStatusLiteral = Literal["pending", "evaluating", "evaluated", "error"]
CheckStatusLiteral = Literal["pending", "running", "done", "error", "skipped"]

class CodeCheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    status: str
    score: float = 0.0
    has_readme: bool = False
    has_license: bool = False
    has_deps_file: bool = False
    has_run_instructions: bool = False
    loc: int = 0
    avg_complexity: float = 0.0
    lint_issues: int = 0
    secrets_found: int = 0
    nn_quality_score: float | None = None
    raw: dict = Field(default_factory=dict)
    message: str = ""

    @field_validator("status", mode="before")
    @classmethod
    def _coerce(cls, v):
        return getattr(v, "value", v)

class DocCheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    status: str
    score: float = 0.0
    word_count: int = 0
    has_description: bool = False
    has_deploy: bool = False
    has_usage: bool = False
    image_count: int = 0
    fmt: str = ""
    message: str = ""

    @field_validator("status", mode="before")
    @classmethod
    def _coerce(cls, v):
        return getattr(v, "value", v)

class PresentationCheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    status: str
    score: float = 0.0
    slide_count: int = 0
    sections_found: list[str] = []
    fmt: str = ""
    message: str = ""

    @field_validator("status", mode="before")
    @classmethod
    def _coerce(cls, v):
        return getattr(v, "value", v)

class VideoCheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    status: str
    score: float = 0.0
    duration_sec: int = 0
    width: int = 0
    height: int = 0
    codec: str = ""
    transcription: str = ""
    summary: str = ""
    message: str = ""

    @field_validator("status", mode="before")
    @classmethod
    def _coerce(cls, v):
        return getattr(v, "value", v)

class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    team_id: int
    status: str
    auto_score: float = 0.0
    jury_score: float | None = None
    final_score: float = 0.0
    rank: int | None = None
    created_at: datetime
    finished_at: datetime | None = None
    code_check: CodeCheckOut | None = None
    doc_check: DocCheckOut | None = None
    presentation_check: PresentationCheckOut | None = None
    video_check: VideoCheckOut | None = None

    @field_validator("status", mode="before")
    @classmethod
    def _coerce_status(cls, v):
        return getattr(v, "value", v)

class JuryScoreIn(BaseModel):
    scores: dict[str, int] = Field(default_factory=dict)
    comment: str = ""

    @field_validator("scores")
    @classmethod
    def _clamp(cls, v: dict) -> dict:
        return {str(k): max(0, min(10, int(val))) for k, val in (v or {}).items()}

class JuryScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    team_id: int
    jury_id: int
    jury_name: str = ""
    scores: dict[str, int] = Field(default_factory=dict)
    comment: str

class TeamResultOut(BaseModel):
    team_id: int
    team_name: str
    hackathon_id: int
    status: str
    auto_score: float
    jury_score: float | None
    final_score: float
    rank: int | None

class HackathonWinnerOut(BaseModel):
    rank: int
    team_id: int
    team_name: str
    final_score: float
