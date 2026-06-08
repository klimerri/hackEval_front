"""add nn_quality_score to code_checks

Revision ID: 0007_nn_quality_score
Revises: 0006_presentation_sections
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0007_nn_quality_score'
down_revision = '0006_presentation_sections'
branch_labels = None
depends_on = None


def _has_column(bind, table: str, column: str) -> bool:
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, "code_checks", "nn_quality_score"):
        op.add_column(
            "code_checks",
            sa.Column("nn_quality_score", sa.Float(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, "code_checks", "nn_quality_score"):
        op.drop_column("code_checks", "nn_quality_score")
