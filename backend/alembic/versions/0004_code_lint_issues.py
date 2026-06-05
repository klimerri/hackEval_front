"""add lint_issues to code_checks

Revision ID: 0004_code_lint_issues
Revises: 0003_notifications
Create Date: 2024-01-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0004_code_lint_issues'
down_revision = '0003_notifications'
branch_labels = None
depends_on = None


def _has_column(bind, table: str, column: str) -> bool:
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, "code_checks", "lint_issues"):
        op.add_column(
            "code_checks",
            sa.Column("lint_issues", sa.Integer(), nullable=False, server_default="0"),
        )
        op.alter_column("code_checks", "lint_issues", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, "code_checks", "lint_issues"):
        op.drop_column("code_checks", "lint_issues")
