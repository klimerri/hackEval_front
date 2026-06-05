"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-04 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("participant", "jury", "organizer", name="user_role"),
            nullable=False,
            server_default="participant",
        ),
        sa.Column("company", sa.String(255), nullable=True),
        sa.Column("specialization", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "hackathons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("rules", postgresql.JSONB(), nullable=True),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submission_deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum("draft", "active", "finished", name="hackathon_status"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("prize_pool", sa.String(64), nullable=False, server_default=""),
        sa.Column("image_url", sa.String(1024), nullable=False, server_default=""),
        sa.Column("type", sa.String(32), nullable=False, server_default="Online"),
        sa.Column("coefficients", postgresql.JSONB(), nullable=True),
        sa.Column("max_team_size", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("organizer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column(
            "hackathon_id",
            sa.Integer(),
            sa.ForeignKey("hackathons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="team_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("invite_code", sa.String(32), nullable=False, unique=True, index=True),
        sa.Column("github_url", sa.String(1024), nullable=True),
        sa.Column("docs_url", sa.String(1024), nullable=True),
        sa.Column("presentation_url", sa.String(1024), nullable=True),
        sa.Column("video_url", sa.String(1024), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("hackathon_id", "name", name="uq_team_per_hackathon"),
    )

    op.create_table(
        "team_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "role",
            sa.Enum("captain", "member", name="team_member_role"),
            nullable=False,
            server_default="member",
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("team_id", "user_id", name="uq_member_per_team"),
    )

    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "evaluating", "evaluated", "error", name="submission_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("auto_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("final_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("extra", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "code_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("status", sa.Enum("pending", "running", "done", "error", "skipped", name="check_status"), nullable=False, server_default="pending"),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("raw", postgresql.JSONB(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("has_readme", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("has_license", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("has_deps_file", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("has_run_instructions", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("loc", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_complexity", sa.Float(), nullable=False, server_default="0"),
        sa.Column("secrets_found", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "doc_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("status", sa.Enum("pending", "running", "done", "error", "skipped", name="check_status"), nullable=False, server_default="pending"),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("raw", postgresql.JSONB(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("has_description", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("has_deploy", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("has_usage", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("image_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fmt", sa.String(16), nullable=False, server_default=""),
    )

    op.create_table(
        "presentation_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("status", sa.Enum("pending", "running", "done", "error", "skipped", name="check_status"), nullable=False, server_default="pending"),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("raw", postgresql.JSONB(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("slide_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sections_found", postgresql.JSONB(), nullable=True),
        sa.Column("fmt", sa.String(16), nullable=False, server_default=""),
    )

    op.create_table(
        "video_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("status", sa.Enum("pending", "running", "done", "error", "skipped", name="check_status"), nullable=False, server_default="pending"),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("raw", postgresql.JSONB(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_sec", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("width", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("height", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("codec", sa.String(64), nullable=False, server_default=""),
        sa.Column("transcription", sa.Text(), nullable=False, server_default=""),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
    )

    op.create_table(
        "jury_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hackathon_id", sa.Integer(), sa.ForeignKey("hackathons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("hackathon_id", "user_id", name="uq_jury_per_hackathon"),
    )

    op.create_table(
        "jury_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jury_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("design", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pitch", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("complexity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comment", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("team_id", "jury_id", name="uq_score_per_jury_per_team"),
    )

    op.create_table(
        "algorithm_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hackathon_id", sa.Integer(), sa.ForeignKey("hackathons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("statement", sa.Text(), nullable=False, server_default=""),
        sa.Column("time_limit_ms", sa.Integer(), nullable=False, server_default="2000"),
        sa.Column("memory_limit_mb", sa.Integer(), nullable=False, server_default="128"),
        sa.Column("language", sa.Enum("python", "cpp", "java", name="algo_language"), nullable=False, server_default="python"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "algorithm_tests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("algorithm_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("input_data", sa.Text(), nullable=False, server_default=""),
        sa.Column("expected_output", sa.Text(), nullable=False, server_default=""),
        sa.Column("sample", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "algorithm_submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("algorithm_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.Text(), nullable=False, server_default=""),
        sa.Column("language", sa.Enum("python", "cpp", "java", name="algo_language"), nullable=False, server_default="python"),
        sa.Column("verdict", sa.Enum("OK", "WA", "TL", "ML", "RE", "CE", "PENDING", "RUNNING", name="verdict"), nullable=False, server_default="PENDING"),
        sa.Column("runtime_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("memory_mb", sa.Float(), nullable=False, server_default="0"),
        sa.Column("log", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "algorithm_submission_tests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("algorithm_submissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("test_id", sa.Integer(), sa.ForeignKey("algorithm_tests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("verdict", sa.Enum("OK", "WA", "TL", "ML", "RE", "CE", "PENDING", "RUNNING", name="verdict"), nullable=False, server_default="PENDING"),
        sa.Column("runtime_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("memory_mb", sa.Float(), nullable=False, server_default="0"),
        sa.Column("output", sa.Text(), nullable=False, server_default=""),
        sa.Column("log", sa.Text(), nullable=False, server_default=""),
    )

def downgrade() -> None:
    for tbl in [
        "algorithm_submission_tests",
        "algorithm_submissions",
        "algorithm_tests",
        "algorithm_tasks",
        "jury_scores",
        "jury_assignments",
        "video_checks",
        "presentation_checks",
        "doc_checks",
        "code_checks",
        "submissions",
        "team_members",
        "teams",
        "hackathons",
        "users",
    ]:
        op.drop_table(tbl)
