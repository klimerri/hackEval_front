"""add notifications

Revision ID: 0003_notifications
Revises: 0002_team_join_requests
Create Date: 2024-01-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003_notifications'
down_revision = '0002_team_join_requests'
branch_labels = None
depends_on = None

def upgrade() -> None:
    notification_type = postgresql.ENUM(
        'join_request',
        'join_decision',
        'team_decision',
        'team_removed',
        'kicked',
        'info',
        name='notification_type',
        create_type=False,
    )
    notification_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', notification_type, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)
    op.create_index(op.f('ix_notifications_read'), 'notifications', ['read'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_read'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_table('notifications')
    postgresql.ENUM(name='notification_type').drop(op.get_bind(), checkfirst=True)
