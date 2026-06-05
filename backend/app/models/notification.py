from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import User

class NotificationType(str, PyEnum):
    JOIN_REQUEST = "join_request"
    JOIN_DECISION = "join_decision"
    TEAM_DECISION = "team_decision"
    TEAM_REMOVED = "team_removed"
    KICKED = "kicked"
    INFO = "info"

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type", values_callable=lambda e: [m.value for m in e]),
        default=NotificationType.INFO,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="")
    read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship()
