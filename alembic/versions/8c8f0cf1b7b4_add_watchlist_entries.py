"""add watchlist entries

Revision ID: 8c8f0cf1b7b4
Revises: 646eda206afb
Create Date: 2026-05-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c8f0cf1b7b4"
down_revision: Union[str, Sequence[str], None] = "646eda206afb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "watchlist_entries",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("account_id", sa.String(length=64), nullable=False),
        sa.Column("list_type", sa.String(length=16), nullable=False),
        sa.Column("reason", sa.String(length=512), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_watchlist_tenant_account", "watchlist_entries", ["tenant_id", "account_id"], unique=False)
    op.create_index(
        "ux_watchlist_tenant_account_type",
        "watchlist_entries",
        ["tenant_id", "account_id", "list_type"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_watchlist_tenant_account_type", table_name="watchlist_entries")
    op.drop_index("ix_watchlist_tenant_account", table_name="watchlist_entries")
    op.drop_table("watchlist_entries")
