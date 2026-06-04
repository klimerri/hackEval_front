from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.hackathon import Hackathon
from app.models.user import User


class TeamStatus(str, PyEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TeamMemberRole(str, PyEnum):
    CAPTAIN = "captain"
    MEMBER = "member"


class JoinRequestStatus(str, PyEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    hackathon_id: Mapped[int] = mapped_column(ForeignKey("hackathons.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[TeamStatus] = mapped_column(
        Enum(TeamStatus, name="team_status", values_callable=lambda e: [m.value for m in e]),
        default=TeamStatus.PENDING,
        nullable=False,
    )
    invite_code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    github_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    docs_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    presentation_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    hackathon: Mapped[Hackathon] = relationship(back_populates="teams")
    members: Mapped[list["TeamMember"]] = relationship(back_populates="team", cascade="all,delete-orphan")
    join_requests: Mapped[list["TeamJoinRequest"]] = relationship(back_populates="team", cascade="all,delete-orphan")
    submission: Mapped["Submission | None"] = relationship(back_populates="team", uselist=False, cascade="all,delete-orphan")
    jury_scores: Mapped[list["JuryScore"]] = relationship(back_populates="team", cascade="all,delete-orphan")

    __table_args__ = (UniqueConstraint("hackathon_id", "name", name="uq_team_per_hackathon"),)


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[TeamMemberRole] = mapped_column(
        Enum(
            TeamMemberRole,
            name="team_member_role",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=TeamMemberRole.MEMBER,
        nullable=False,
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    team: Mapped[Team] = relationship(back_populates="members")
    user: Mapped[User] = relationship()

    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_member_per_team"),)


class TeamJoinRequest(Base):
    __tablename__ = "team_join_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[JoinRequestStatus] = mapped_column(
        Enum(JoinRequestStatus, name="join_request_status", values_callable=lambda e: [m.value for m in e]),
        default=JoinRequestStatus.PENDING,
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    team: Mapped[Team] = relationship(back_populates="join_requests")
    user: Mapped[User] = relationship()

    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_join_request_per_team_user"),)
