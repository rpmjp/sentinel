"""add upload audits

Revision ID: 47f2c9e18b01
Revises: 2b7c91e4d8aa
Create Date: 2026-05-14 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "47f2c9e18b01"
down_revision: Union[str, Sequence[str], None] = "2b7c91e4d8aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "upload_audits",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("filename", sa.String(length=256), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("rows_uploaded", sa.Integer(), nullable=False),
        sa.Column("rows_scored", sa.Integer(), nullable=False),
        sa.Column("high_count", sa.Integer(), nullable=False),
        sa.Column("medium_count", sa.Integer(), nullable=False),
        sa.Column("low_count", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_upload_audits_tenant_created", "upload_audits", ["tenant_id", "created_at"], unique=False)
    op.create_index("ix_upload_audits_tenant_status", "upload_audits", ["tenant_id", "status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_upload_audits_tenant_status", table_name="upload_audits")
    op.drop_index("ix_upload_audits_tenant_created", table_name="upload_audits")
    op.drop_table("upload_audits")
