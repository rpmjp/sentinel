"""add account_geo enrichment table

Revision ID: f87d0110e2ae
Revises: 8c8f0cf1b7b4
Create Date: 2026-05-14 11:23:43.117210
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f87d0110e2ae"
down_revision: Union[str, Sequence[str], None] = "8c8f0cf1b7b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "account_geo",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("account_id", sa.String(64), nullable=False),
        sa.Column("country", sa.String(3), nullable=False),
        sa.Column("country_name", sa.String(64), nullable=False),
        sa.Column("region", sa.String(64), nullable=True),
        sa.Column("city", sa.String(128), nullable=True),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_account_geo_tenant_account",
        "account_geo",
        ["tenant_id", "account_id"],
    )
    op.create_index(
        "ix_account_geo_tenant_country",
        "account_geo",
        ["tenant_id", "country"],
    )
    op.create_index(
        "ux_account_geo_tenant_account",
        "account_geo",
        ["tenant_id", "account_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_account_geo_tenant_account", table_name="account_geo")
    op.drop_index("ix_account_geo_tenant_country", table_name="account_geo")
    op.drop_index("ix_account_geo_tenant_account", table_name="account_geo")
    op.drop_table("account_geo")