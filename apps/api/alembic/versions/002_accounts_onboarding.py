"""Accounts, onboarding, custody codes, incidents and contact messages

Revision ID: 002_accounts_onboarding
Revises: 001_initial_migration
Create Date: 2026-11-24 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_accounts_onboarding"
down_revision: Union[str, None] = "001_initial_migration"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.add_column("users", sa.Column("phone", sa.String(), nullable=True))
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("terms_accepted_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("profile", sa.JSON(), nullable=True))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))
    op.create_index("ix_users_phone", "users", ["phone"], unique=False)

    # Organizations
    op.add_column("organizations", sa.Column("daily_capacity", sa.Float(), nullable=True))
    op.add_column("organizations", sa.Column("profile", sa.JSON(), nullable=True))
    op.add_column("organizations", sa.Column("verification_notes", sa.String(), nullable=True))

    # Donations: which recipient organization claimed the listing
    op.add_column("donations", sa.Column("claimed_by_org_id", sa.String(), nullable=True))
    op.create_foreign_key("fk_donations_claimed_by_org", "donations", "organizations", ["claimed_by_org_id"], ["id"])

    # Volunteers
    op.add_column("volunteers", sa.Column("service_area", sa.String(), nullable=True))
    op.add_column("volunteers", sa.Column("availability", sa.JSON(), nullable=True))

    # Pickup tasks: separate code for delivery confirmation
    op.add_column("pickup_tasks", sa.Column("delivery_token", sa.String(), nullable=True))
    op.create_index("ix_pickup_tasks_delivery_token", "pickup_tasks", ["delivery_token"], unique=True)

    op.create_table(
        "auth_tokens",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("purpose", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auth_tokens_user_id", "auth_tokens", ["user_id"])
    op.create_index("ix_auth_tokens_token_hash", "auth_tokens", ["token_hash"], unique=True)

    op.create_table(
        "incidents",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("reporter_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("donation_id", sa.String(), sa.ForeignKey("donations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="OPEN"),
        sa.Column("resolution_notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "contact_messages",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("organization", sa.String(), nullable=True),
        sa.Column("topic", sa.String(), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("contact_messages")
    op.drop_table("incidents")
    op.drop_index("ix_auth_tokens_token_hash", table_name="auth_tokens")
    op.drop_index("ix_auth_tokens_user_id", table_name="auth_tokens")
    op.drop_table("auth_tokens")
    op.drop_index("ix_pickup_tasks_delivery_token", table_name="pickup_tasks")
    op.drop_column("pickup_tasks", "delivery_token")
    op.drop_column("volunteers", "availability")
    op.drop_column("volunteers", "service_area")
    op.drop_constraint("fk_donations_claimed_by_org", "donations", type_="foreignkey")
    op.drop_column("donations", "claimed_by_org_id")
    op.drop_column("organizations", "verification_notes")
    op.drop_column("organizations", "profile")
    op.drop_column("organizations", "daily_capacity")
    op.drop_index("ix_users_phone", table_name="users")
    for col in ("last_login_at", "profile", "onboarding_completed", "terms_accepted_at",
                "phone_verified", "email_verified", "phone"):
        op.drop_column("users", col)
