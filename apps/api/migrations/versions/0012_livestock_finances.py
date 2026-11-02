"""Add livestock-specific financial transactions.

Revision ID: 0012_livestock_finances
Revises: 0011_store_catalog_orders
Create Date: 2026-11-02
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012_livestock_finances"
down_revision: str | None = "0011_store_catalog_orders"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.create_table(
        "livestock_finance_transactions",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("animal_id", uuid_type, nullable=True),
        sa.Column("group_id", uuid_type, nullable=True),
        sa.Column("facility_id", uuid_type, nullable=True),
        sa.Column("source_record_id", uuid_type, nullable=True),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("transaction_type", sa.String(length=8), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("amount_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column("unit", sa.String(length=24), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "transaction_type IN ('income', 'expense')",
            name="ck_livestock_finance_type",
        ),
        sa.CheckConstraint("amount_fcfa > 0", name="ck_livestock_finance_amount_positive"),
        sa.CheckConstraint(
            "animal_id IS NULL OR group_id IS NULL",
            name="ck_livestock_finance_one_subject",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_livestock_finance_transactions_organization",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_livestock_finance_transactions_creator",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "animal_id"],
            ["livestock_animals.organization_id", "livestock_animals.id"],
            name="fk_livestock_finance_org_animal",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "group_id"],
            ["livestock_groups.organization_id", "livestock_groups.id"],
            name="fk_livestock_finance_org_group",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "facility_id"],
            ["livestock_facilities.organization_id", "livestock_facilities.id"],
            name="fk_livestock_finance_org_facility",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_record_id"],
            ["livestock_records.id"],
            name="fk_livestock_finance_transactions_source_record",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_record_id", name="uq_livestock_finance_source_record"),
    )
    op.create_index(
        "ix_livestock_finance_org_date",
        "livestock_finance_transactions",
        ["organization_id", "transaction_date"],
    )

    bind = op.get_bind()
    legacy_records = bind.execute(
        sa.text(
            """
            SELECT id, organization_id, animal_id, group_id, facility_id, created_by_id,
                   record_type, category, title, amount_fcfa, event_date, quantity, unit,
                   notes, created_at
            FROM livestock_records
            WHERE amount_fcfa > 0
            """
        )
    ).mappings()
    rows = [
        {
            "id": uuid.uuid4(),
            "organization_id": row["organization_id"],
            "animal_id": row["animal_id"],
            "group_id": row["group_id"],
            "facility_id": row["facility_id"],
            "source_record_id": row["id"],
            "created_by_id": row["created_by_id"],
            "transaction_type": "income" if row["record_type"] == "production" else "expense",
            "category": "input" if row["record_type"] == "feed" else row["record_type"],
            "label": row["title"],
            "amount_fcfa": row["amount_fcfa"],
            "transaction_date": row["event_date"],
            "quantity": row["quantity"],
            "unit": row["unit"],
            "notes": row["notes"],
            "created_at": row["created_at"],
        }
        for row in legacy_records
    ]
    if rows:
        op.bulk_insert(
            sa.table(
                "livestock_finance_transactions",
                sa.column("id", uuid_type),
                sa.column("organization_id", uuid_type),
                sa.column("animal_id", uuid_type),
                sa.column("group_id", uuid_type),
                sa.column("facility_id", uuid_type),
                sa.column("source_record_id", uuid_type),
                sa.column("created_by_id", uuid_type),
                sa.column("transaction_type", sa.String()),
                sa.column("category", sa.String()),
                sa.column("label", sa.String()),
                sa.column("amount_fcfa", sa.BigInteger()),
                sa.column("transaction_date", sa.Date()),
                sa.column("quantity", sa.Numeric(precision=14, scale=3)),
                sa.column("unit", sa.String()),
                sa.column("notes", sa.Text()),
                sa.column("created_at", sa.DateTime(timezone=True)),
            ),
            rows,
        )


def downgrade() -> None:
    op.drop_index(
        "ix_livestock_finance_org_date",
        table_name="livestock_finance_transactions",
    )
    op.drop_table("livestock_finance_transactions")
