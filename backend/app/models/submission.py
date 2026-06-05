from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.team import Team


class SubmissionStatus(str, PyEnum):
    PENDING = "pending"
    EVALUATING = "evaluating"
    EVALUATED = "evaluated"
    ERROR = "error"


class CheckStatus(str, PyEnum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"
    SKIPPED = "skipped"


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), unique=True, nullable=False)
    status: Mapped[SubmissionStatus] = mapped_column(
        Enum(
            SubmissionStatus,
            name="submission_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=SubmissionStatus.PENDING,
        nullable=False,
    )
    auto_score: Mapped[float] = mapped_column(Float, default=0.0)
    final_score: Mapped[float] = mapped_column(Float, default=0.0)
    rank: Mapped[int | None] = mapped_column(nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    team: Mapped[Team] = relationship(back_populates="submission")
    code_check: Mapped["CodeCheck | None"] = relationship(back_populates="submission", uselist=False, cascade="all,delete-orphan")
    doc_check: Mapped["DocCheck | None"] = relationship(back_populates="submission", uselist=False, cascade="all,delete-orphan")
    presentation_check: Mapped["PresentationCheck | None"] = relationship(back_populates="submission", uselist=False, cascade="all,delete-orphan")
    video_check: Mapped["VideoCheck | None"] = relationship(back_populates="submission", uselist=False, cascade="all,delete-orphan")


class _CheckBase:
    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False)
    status: Mapped[CheckStatus] = mapped_column(
        Enum(CheckStatus, name="check_status", values_callable=lambda e: [m.value for m in e]),
        default=CheckStatus.PENDING,
        nullable=False,
    )
    score: Mapped[float] = mapped_column(Float, default=0.0)
    raw: Mapped[dict] = mapped_column(JSONB, default=dict)
    message: Mapped[str] = mapped_column(Text, default="")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CodeCheck(_CheckBase, Base):
    __tablename__ = "code_checks"
    submission: Mapped[Submission] = relationship(back_populates="code_check")
    has_readme: Mapped[bool] = mapped_column(default=False)
    has_license: Mapped[bool] = mapped_column(default=False)
    has_deps_file: Mapped[bool] = mapped_column(default=False)
    has_run_instructions: Mapped[bool] = mapped_column(default=False)
    loc: Mapped[int] = mapped_column(default=0)
    avg_complexity: Mapped[float] = mapped_column(default=0.0)
    lint_issues: Mapped[int] = mapped_column(default=0)
    secrets_found: Mapped[int] = mapped_column(default=0)


class DocCheck(_CheckBase, Base):
    __tablename__ = "doc_checks"
    submission: Mapped[Submission] = relationship(back_populates="doc_check")
    word_count: Mapped[int] = mapped_column(default=0)
    has_description: Mapped[bool] = mapped_column(default=False)
    has_deploy: Mapped[bool] = mapped_column(default=False)
    has_usage: Mapped[bool] = mapped_column(default=False)
    image_count: Mapped[int] = mapped_column(default=0)
    fmt: Mapped[str] = mapped_column(String(16), default="")


class PresentationCheck(_CheckBase, Base):
    __tablename__ = "presentation_checks"
    submission: Mapped[Submission] = relationship(back_populates="presentation_check")
    slide_count: Mapped[int] = mapped_column(default=0)
    sections_found: Mapped[list[str]] = mapped_column(JSONB, default=list)
    fmt: Mapped[str] = mapped_column(String(16), default="")


class VideoCheck(_CheckBase, Base):
    __tablename__ = "video_checks"
    submission: Mapped[Submission] = relationship(back_populates="video_check")
    duration_sec: Mapped[int] = mapped_column(default=0)
    width: Mapped[int] = mapped_column(default=0)
    height: Mapped[int] = mapped_column(default=0)
    codec: Mapped[str] = mapped_column(String(64), default="")
    transcription: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str] = mapped_column(Text, default="")
