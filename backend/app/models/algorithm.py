from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.hackathon import Hackathon
from app.models.user import User


class AlgorithmLanguage(str, PyEnum):
    PYTHON = "python"
    CPP = "cpp"
    JAVA = "java"


class Verdict(str, PyEnum):
    OK = "OK"
    WA = "WA"
    TL = "TL"
    ML = "ML"
    RE = "RE"
    CE = "CE"
    PENDING = "PENDING"
    RUNNING = "RUNNING"


class AlgorithmTask(Base):
    __tablename__ = "algorithm_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    hackathon_id: Mapped[int] = mapped_column(ForeignKey("hackathons.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    statement: Mapped[str] = mapped_column(Text, default="")
    time_limit_ms: Mapped[int] = mapped_column(default=2000)
    memory_limit_mb: Mapped[int] = mapped_column(default=128)
    language: Mapped[AlgorithmLanguage] = mapped_column(
        Enum(
            AlgorithmLanguage,
            name="algo_language",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=AlgorithmLanguage.PYTHON,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    hackathon: Mapped[Hackathon] = relationship(back_populates="algorithm_tasks")
    tests: Mapped[list["AlgorithmTest"]] = relationship(back_populates="task", cascade="all,delete-orphan")
    submissions: Mapped[list["AlgorithmSubmission"]] = relationship(back_populates="task", cascade="all,delete-orphan")


class AlgorithmTest(Base):
    __tablename__ = "algorithm_tests"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("algorithm_tasks.id", ondelete="CASCADE"), nullable=False)
    input_data: Mapped[str] = mapped_column(Text, default="")
    expected_output: Mapped[str] = mapped_column(Text, default="")
    sample: Mapped[bool] = mapped_column(default=False)

    task: Mapped[AlgorithmTask] = relationship(back_populates="tests")


class AlgorithmSubmission(Base):
    __tablename__ = "algorithm_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("algorithm_tasks.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(Text, default="")
    language: Mapped[AlgorithmLanguage] = mapped_column(
        Enum(
            AlgorithmLanguage,
            name="algo_language",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=AlgorithmLanguage.PYTHON,
        nullable=False,
    )
    verdict: Mapped[Verdict] = mapped_column(
        Enum(Verdict, name="verdict", values_callable=lambda e: [m.value for m in e]),
        default=Verdict.PENDING,
        nullable=False,
    )
    runtime_ms: Mapped[int] = mapped_column(default=0)
    memory_mb: Mapped[float] = mapped_column(default=0.0)
    log: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task: Mapped[AlgorithmTask] = relationship(back_populates="submissions")
    user: Mapped[User] = relationship()
    results: Mapped[list["AlgorithmSubmissionTest"]] = relationship(back_populates="submission", cascade="all,delete-orphan")


class AlgorithmSubmissionTest(Base):
    __tablename__ = "algorithm_submission_tests"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("algorithm_submissions.id", ondelete="CASCADE"), nullable=False
    )
    test_id: Mapped[int] = mapped_column(ForeignKey("algorithm_tests.id", ondelete="CASCADE"), nullable=False)
    verdict: Mapped[Verdict] = mapped_column(
        Enum(Verdict, name="verdict", values_callable=lambda e: [m.value for m in e]),
        default=Verdict.PENDING,
        nullable=False,
    )
    runtime_ms: Mapped[int] = mapped_column(default=0)
    memory_mb: Mapped[float] = mapped_column(default=0.0)
    output: Mapped[str] = mapped_column(Text, default="")
    log: Mapped[str] = mapped_column(Text, default="")

    submission: Mapped[AlgorithmSubmission] = relationship(back_populates="results")
