"""Seed the crop catalog for organizations that do not have one yet.

Revision ID: 0008_seed_crop_catalog
Revises: 0007_operations_tasks
Create Date: 2026-11-01
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0008_seed_crop_catalog"
down_revision: str | None = "0007_operations_tasks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_CROPS = (
    "Maïs",
    "Riz",
    "Arachide",
    "Mil",
    "Sorgho",
    "Manioc",
    "Niébé",
    "Tomate",
    "Oignon",
    "Coton",
    "Banane",
    "Mangue",
)


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(UTC)

    def database_uuid(value: uuid.UUID | str) -> uuid.UUID | str:
        return str(value) if bind.dialect.name == "sqlite" else value

    organizations_without_crops = bind.execute(
        sa.text(
            """
            SELECT organizations.id
            FROM organizations
            WHERE NOT EXISTS (
                SELECT 1
                FROM agriculture_crops
                WHERE agriculture_crops.organization_id = organizations.id
            )
            """
        )
    ).scalars().all()

    for organization_id in organizations_without_crops:
        for crop_name in DEFAULT_CROPS:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO agriculture_crops
                        (id, organization_id, name, is_active, created_at)
                    VALUES (:id, :organization_id, :name, TRUE, :created_at)
                    """
                ),
                {
                    "id": database_uuid(uuid.uuid4()),
                    "organization_id": database_uuid(organization_id),
                    "name": crop_name,
                    "created_at": now,
                },
            )


def downgrade() -> None:
    pass
