"""Add private photo metadata to agriculture parcels.

Revision ID: 0006_parcel_photos
Revises: 0005_farm_campaign_finance
Create Date: 2026-11-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_parcel_photos"
down_revision: str | None = "0005_farm_campaign_finance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "agriculture_parcels",
        sa.Column("photo_filename", sa.String(length=80), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agriculture_parcels", "photo_filename")
