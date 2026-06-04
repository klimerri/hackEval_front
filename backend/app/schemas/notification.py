from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    type: str
    title: str
    body: str = ""
    read: bool
    created_at: datetime

    @field_validator("type", mode="before")
    @classmethod
    def _coerce_type(cls, v):
        return getattr(v, "value", v)

    @field_validator("body", mode="before")
    @classmethod
    def _none_to_empty(cls, v):
        return v or ""


class NotificationList(BaseModel):
    unread: int
    items: list[NotificationOut]
