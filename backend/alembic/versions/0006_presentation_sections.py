"""configurable presentation sections

Revision ID: 0006_presentation_sections
Revises: 0005_jury_criteria
Create Date: 2026-02-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0006_presentation_sections"
down_revision = "0005_jury_criteria"
branch_labels = None
depends_on = None

# Plain JSON string passed as a *bound value* (not inlined into SQL text) so the
# colons inside it are not treated as bind parameters by SQLAlchemy.
_DEFAULT_SECTIONS = (
    '[{"key":"problem","label":"Проблема","keywords":["проблема","problem"]},'
    '{"key":"solution","label":"Решение","keywords":["решение","solution"]},'
    '{"key":"audience","label":"Целевая аудитория","keywords":["целевая аудитория","аудитория","target audience","audience"]},'
    '{"key":"stack","label":"Технологический стек","keywords":["стек","технологический стек","tech stack","технологии","stack"]},'
    '{"key":"demo","label":"Демо","keywords":["демо","demo"]},'
    '{"key":"team","label":"Команда","keywords":["команда","team"]},'
    '{"key":"contacts","label":"Контакты","keywords":["контакты","contacts"]}]'
)


def _has_column(bind, table: str, column: str) -> bool:
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, "hackathons", "presentation_sections"):
        op.add_column("hackathons", sa.Column("presentation_sections", postgresql.JSONB(), nullable=True))
        op.execute(
            sa.text(
                "UPDATE hackathons SET presentation_sections = CAST(:val AS jsonb) "
                "WHERE presentation_sections IS NULL"
            ).bindparams(val=_DEFAULT_SECTIONS)
        )
        op.alter_column("hackathons", "presentation_sections", nullable=False)


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, "hackathons", "presentation_sections"):
        op.drop_column("hackathons", "presentation_sections")
