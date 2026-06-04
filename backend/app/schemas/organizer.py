from pydantic import BaseModel, EmailStr, Field


class JuryPromoteIn(BaseModel):
    email: EmailStr
    company: str | None = None
    specialization: str | None = None


class JuryCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    company: str | None = None
    specialization: str | None = None


class AssignedJuryOut(BaseModel):
    id: int
    name: str
    email: str
    company: str | None = None
    specialization: str | None = None
