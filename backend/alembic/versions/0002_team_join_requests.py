"""add team join requests

Revision ID: 0002_team_join_requests
Revises: 0001_initial
Create Date: 2024-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002_team_join_requests'
down_revision = '0001_initial'
branch_labels = None
depends_on = None

def upgrade() -> None:
    join_request_status = postgresql.ENUM(
        'pending', 'approved', 'rejected', name='join_request_status', create_type=False
    )
    join_request_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'team_join_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('status', join_request_status, nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('team_id', 'user_id', name='uq_join_request_per_team_user')
    )
    op.create_index(op.f('ix_team_join_requests_team_id'), 'team_join_requests', ['team_id'], unique=False)
    op.create_index(op.f('ix_team_join_requests_user_id'), 'team_join_requests', ['user_id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_team_join_requests_user_id'), table_name='team_join_requests')
    op.drop_index(op.f('ix_team_join_requests_team_id'), table_name='team_join_requests')
    op.drop_table('team_join_requests')
    postgresql.ENUM(name='join_request_status').drop(op.get_bind(), checkfirst=True)
