from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AlgoLangLiteral = Literal["python", "cpp", "java"]
VerdictLiteral = Literal["OK", "WA", "TL", "ML", "RE", "CE", "PENDING", "RUNNING"]


class AlgorithmTestIn(BaseModel):
    input_data: str
    expected_output: str
    sample: bool = False


class AlgorithmTestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sample: bool


class AlgorithmTaskCreate(BaseModel):
    hackathon_id: int
    title: str
    statement: str = ""
    time_limit_ms: int = 2000
    memory_limit_mb: int = 128
    language: AlgoLangLiteral = "python"
    tests: list[AlgorithmTestIn] = []


class AlgorithmTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    hackathon_id: int
    title: str
    statement: str = ""
    time_limit_ms: int = 2000
    memory_limit_mb: int = 128
    language: str
    created_at: datetime
    test_count: int = 0

    @field_validator("language", mode="before")
    @classmethod
    def _coerce_lang(cls, v):
        return getattr(v, "value", v)


class AlgorithmSubmissionIn(BaseModel):
    task_id: int
    code: str
    language: AlgoLangLiteral = "python"


class AlgorithmSubmissionTestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    test_id: int
    verdict: str
    runtime_ms: int = 0
    memory_mb: float = 0.0
    output: str = ""
    log: str = ""

    @field_validator("verdict", mode="before")
    @classmethod
    def _coerce_v(cls, v):
        return getattr(v, "value", v)


class AlgorithmSubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: int
    user_id: int
    language: str
    verdict: str
    runtime_ms: int = 0
    memory_mb: float = 0.0
    log: str = ""
    created_at: datetime
    results: list[AlgorithmSubmissionTestOut] = []

    @field_validator("language", "verdict", mode="before")
    @classmethod
    def _coerce_lv(cls, v):
        return getattr(v, "value", v)


class JuryAssignIn(BaseModel):
    user_id: int
