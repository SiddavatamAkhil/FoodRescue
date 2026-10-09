"""Initial Migration

Revision ID: 001_initial_migration
Revises: None
Create Date: 2026-10-08 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_initial_migration'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_id', 'users', ['id'], unique=False)

    # 2. Organizations table
    op.create_table(
        'organizations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('verification_status', sa.String(), nullable=True),
        sa.Column('fssai_number', sa.String(), nullable=True),
        sa.Column('ngo_darpan_id', sa.String(), nullable=True),
        sa.Column('address', sa.String(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('is_demo', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_organizations_id', 'organizations', ['id'], unique=False)

    # 3. Memberships table
    op.create_table(
        'memberships',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_memberships_id', 'memberships', ['id'], unique=False)

    # 4. Organization Documents table
    op.create_table(
        'organization_documents',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('document_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_organization_documents_id', 'organization_documents', ['id'], unique=False)

    # 5. Jurisdictions table
    op.create_table(
        'jurisdictions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('languages', sa.JSON(), nullable=True),
        sa.Column('rules', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_jurisdictions_code', 'jurisdictions', ['code'], unique=True)
    op.create_index('ix_jurisdictions_id', 'jurisdictions', ['id'], unique=False)

    # 6. Donations table
    op.create_table(
        'donations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=False),
        sa.Column('creator_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('pickup_address', sa.String(), nullable=False),
        sa.Column('pickup_deadline', sa.DateTime(), nullable=False),
        sa.Column('storage_info', sa.String(), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=True),
        sa.Column('state_history', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_donations_id', 'donations', ['id'], unique=False)

    # 7. Food Items table
    op.create_table(
        'food_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('donation_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('is_veg', sa.Boolean(), nullable=False),
        sa.Column('prep_time', sa.DateTime(), nullable=False),
        sa.Column('expiry_time', sa.DateTime(), nullable=False),
        sa.Column('is_leftover', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['donation_id'], ['donations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_food_items_id', 'food_items', ['id'], unique=False)

    # 8. Demands table
    op.create_table(
        'demands',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=False),
        sa.Column('food_category', sa.String(), nullable=False),
        sa.Column('quantity_needed', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('priority', sa.String(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_demands_id', 'demands', ['id'], unique=False)

    # 9. Matches table
    op.create_table(
        'matches',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('donation_id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('explanation', sa.JSON(), nullable=True),
        sa.Column('is_claimed', sa.Boolean(), nullable=True),
        sa.Column('matching_config_version', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['donation_id'], ['donations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_matches_id', 'matches', ['id'], unique=False)

    # 10. Volunteers table
    op.create_table(
        'volunteers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('vehicle_type', sa.String(), nullable=True),
        sa.Column('vehicle_capacity', sa.Float(), nullable=True),
        sa.Column('is_available', sa.Boolean(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_volunteers_id', 'volunteers', ['id'], unique=False)

    # 11. Pickup Tasks table
    op.create_table(
        'pickup_tasks',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('donation_id', sa.String(), nullable=False),
        sa.Column('volunteer_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('qr_token', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('picked_up_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['donation_id'], ['donations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['volunteer_id'], ['volunteers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_pickup_tasks_id', 'pickup_tasks', ['id'], unique=False)
    op.create_index('ix_pickup_tasks_qr_token', 'pickup_tasks', ['qr_token'], unique=True)

    # 12. Custody Events table
    op.create_table(
        'custody_events',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('donation_id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('actor_id', sa.String(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('qr_token', sa.String(), nullable=False),
        sa.Column('is_demo', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['donation_id'], ['donations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # 13. Notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.String(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_notifications_id', 'notifications', ['id'], unique=False)

    # 14. Audit Logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('actor_id', sa.String(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('resource', sa.String(), nullable=False),
        sa.Column('before_value', sa.JSON(), nullable=True),
        sa.Column('after_value', sa.JSON(), nullable=True),
        sa.Column('request_id', sa.String(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_audit_logs_id', 'audit_logs', ['id'], unique=False)

    # 15. Knowledge Documents table
    op.create_table(
        'knowledge_documents',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('source_url', sa.String(), nullable=True),
        sa.Column('jurisdiction', sa.String(), nullable=True),
        sa.Column('language', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_knowledge_documents_id', 'knowledge_documents', ['id'], unique=False)

    # 16. Knowledge Chunks table
    op.create_table(
        'knowledge_chunks',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('document_id', sa.String(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('embedding', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['document_id'], ['knowledge_documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_knowledge_chunks_id', 'knowledge_chunks', ['id'], unique=False)


def downgrade() -> None:
    op.drop_table('knowledge_chunks')
    op.drop_table('knowledge_documents')
    op.drop_table('audit_logs')
    op.drop_table('notifications')
    op.drop_table('custody_events')
    op.drop_table('pickup_tasks')
    op.drop_table('volunteers')
    op.drop_table('matches')
    op.drop_table('demands')
    op.drop_table('food_items')
    op.drop_table('donations')
    op.drop_table('jurisdictions')
    op.drop_table('organization_documents')
    op.drop_table('memberships')
    op.drop_table('organizations')
    op.drop_table('users')
