from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class HackathonStatus(str, PyEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    FINISHED = "finished"


class Hackathon(Base):
    __tablename__ = "hackathons"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    rules: Mapped[list[str]] = mapped_column(JSONB, default=list)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    submission_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[HackathonStatus] = mapped_column(
        Enum(
            HackathonStatus,
            name="hackathon_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=HackathonStatus.DRAFT,
        nullable=False,
    )
    prize_pool: Mapped[str] = mapped_column(String(64), default="")
    image_url: Mapped[str] = mapped_column(String(1024), default="")
    type: Mapped[str] = mapped_column(String(32), default="Online")
    coefficients: Mapped[dict] = mapped_column(JSONB, default=lambda: {"code": 40, "design": 30, "pitch": 30})
    max_team_size: Mapped[int] = mapped_column(default=5)
    organizer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    teams: Mapped[list["Team"]] = relationship(back_populates="hackathon", cascade="all,delete-orphan")
    jury: Mapped[list["JuryAssignment"]] = relationship(back_populates="hackathon", cascade="all,delete-orphan")
    algorithm_tasks: Mapped[list["AlgorithmTask"]] = relationship(back_populates="hackathon", cascade="all,delete-orphan")
