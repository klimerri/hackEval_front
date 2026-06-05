from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

RoleLiteral = Literal["participant", "jury", "organizer"]

class UserRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: EmailStr
    role: str
    company: str | None = None
    specialization: str | None = None
    created_at: datetime

    @field_validator("role", mode="before")
    @classmethod
    def _coerce_role(cls, v):
        return getattr(v, "value", v)

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
