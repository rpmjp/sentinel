"""add case management

Revision ID: 2b7c91e4d8aa
Revises: f87d0110e2ae
Create Date: 2026-05-14 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2b7c91e4d8aa"
down_revision: Union[str, Sequence[str], None] = "f87d0110e2ae"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cases",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("priority", sa.String(length=16), nullable=False),
        sa.Column("assigned_to", sa.UUID(), nullable=True),
        sa.Column("sla_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("outcome", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cases_tenant_status", "cases", ["tenant_id", "status"], unique=False)
    op.create_index("ix_cases_tenant_sla", "cases", ["tenant_id", "sla_due_at"], unique=False)

    op.create_table(
        "case_transactions",
        sa.Column("case_id", sa.UUID(), nullable=False),
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("case_id", "transaction_id"),
    )
    op.create_index(
        "ix_case_transactions_transaction",
        "case_transactions",
        ["transaction_id"],
        unique=False,
    )

    op.create_table(
        "case_entities",
        sa.Column("case_id", sa.UUID(), nullable=False),
        sa.Column("account_id", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("case_id", "account_id"),
    )
    op.create_index("ix_case_entities_account", "case_entities", ["account_id"], unique=False)

    op.create_table(
        "case_notes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("case_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_case_notes_case_created", "case_notes", ["case_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_case_notes_case_created", table_name="case_notes")
    op.drop_table("case_notes")
    op.drop_index("ix_case_entities_account", table_name="case_entities")
    op.drop_table("case_entities")
    op.drop_index("ix_case_transactions_transaction", table_name="case_transactions")
    op.drop_table("case_transactions")
    op.drop_index("ix_cases_tenant_sla", table_name="cases")
    op.drop_index("ix_cases_tenant_status", table_name="cases")
    op.drop_table("cases")
