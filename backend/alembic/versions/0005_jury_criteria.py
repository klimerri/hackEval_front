"""configurable jury criteria + per-criterion scores

Revision ID: 0005_jury_criteria
Revises: 0004_code_lint_issues
Create Date: 2024-01-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_jury_criteria"
down_revision = "0004_code_lint_issues"
branch_labels = None
depends_on = None

_DEFAULT_CRITERIA = (
    '[{"key":"design","label":"Дизайн и UX","weight":34},'
    '{"key":"pitch","label":"Питч и идея","weight":33},'
    '{"key":"complexity","label":"Техническая сложность","weight":33}]'
)

def _has_column(bind, table: str, column: str) -> bool:
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))

def upgrade() -> None:
    bind = op.get_bind()

    if not _has_column(bind, "hackathons", "jury_criteria"):
        op.add_column("hackathons", sa.Column("jury_criteria", postgresql.JSONB(), nullable=True))
        op.execute(
            sa.text(
                "UPDATE hackathons SET jury_criteria = CAST(:val AS jsonb) "
                "WHERE jury_criteria IS NULL"
            ).bindparams(val=_DEFAULT_CRITERIA)
        )
        op.alter_column("hackathons", "jury_criteria", nullable=False)

    if not _has_column(bind, "jury_scores", "scores"):
        op.add_column("jury_scores", sa.Column("scores", postgresql.JSONB(), nullable=True))
        op.execute(
            "UPDATE jury_scores SET scores = "
            "jsonb_build_object('design', design, 'pitch', pitch, 'complexity', complexity) "
            "WHERE scores IS NULL"
        )
        op.alter_column(
            "jury_scores",
            "scores",
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        )

def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, "jury_scores", "scores"):
        op.drop_column("jury_scores", "scores")
    if _has_column(bind, "hackathons", "jury_criteria"):
        op.drop_column("hackathons", "jury_criteria")
