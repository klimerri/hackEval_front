from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.hackathon import Hackathon
from app.models.team import Team
from app.models.user import User

class JuryAssignment(Base):
    __tablename__ = "jury_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    hackathon_id: Mapped[int] = mapped_column(ForeignKey("hackathons.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    hackathon: Mapped[Hackathon] = relationship(back_populates="jury")
    user: Mapped[User] = relationship()

    __table_args__ = (UniqueConstraint("hackathon_id", "user_id", name="uq_jury_per_hackathon"),)

class JuryScore(Base):
    __tablename__ = "jury_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    jury_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    scores: Mapped[dict] = mapped_column(JSONB, default=dict)
    design: Mapped[int] = mapped_column(default=0)
    pitch: Mapped[int] = mapped_column(default=0)
    complexity: Mapped[int] = mapped_column(default=0)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    team: Mapped[Team] = relationship(back_populates="jury_scores")
    jury: Mapped[User] = relationship()

    __table_args__ = (UniqueConstraint("team_id", "jury_id", name="uq_score_per_jury_per_team"),)
