"""Add payroll records and employee absence requests.

Revision ID: 0016_payroll_and_absences
Revises: 0015_human_resources_profiles
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0016_payroll_and_absences"
down_revision: str | None = "0015_human_resources_profiles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    uuid_type = sa.Uuid(as_uuid=True).with_variant(postgresql.UUID(as_uuid=True), "postgresql")
    op.create_table(
        "hr_payroll_records",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("created_by_id", uuid_type, nullable=False),
        sa.Column("pay_year", sa.Integer(), nullable=False),
        sa.Column("pay_month", sa.Integer(), nullable=False),
        sa.Column("gross_pay_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("bonus_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("deductions_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("net_pay_fcfa", sa.BigInteger(), nullable=False),
        sa.Column("payment_status", sa.String(length=12), nullable=False),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("pay_month BETWEEN 1 AND 12", name="ck_hr_payroll_month"),
        sa.CheckConstraint("pay_year BETWEEN 2000 AND 2100", name="ck_hr_payroll_year"),
        sa.CheckConstraint("gross_pay_fcfa > 0", name="ck_hr_payroll_gross_positive"),
        sa.CheckConstraint("bonus_fcfa >= 0", name="ck_hr_payroll_bonus_nonnegative"),
        sa.CheckConstraint("deductions_fcfa >= 0", name="ck_hr_payroll_deductions_nonnegative"),
        sa.CheckConstraint("net_pay_fcfa >= 0", name="ck_hr_payroll_net_nonnegative"),
        sa.CheckConstraint("payment_status IN ('pending', 'paid')", name="ck_hr_payroll_status"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_hr_payroll_records_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_hr_payroll_records_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name="fk_hr_payroll_records_created_by_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "user_id",
            "pay_year",
            "pay_month",
            name="uq_hr_payroll_employee_period",
        ),
    )
    op.create_index(
        "ix_hr_payroll_org_period",
        "hr_payroll_records",
        ["organization_id", "pay_year", "pay_month"],
    )
    op.create_table(
        "hr_absence_requests",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("organization_id", uuid_type, nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("reviewed_by_id", uuid_type, nullable=True),
        sa.Column("absence_type", sa.String(length=20), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(length=1000), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("reviewer_note", sa.String(length=1000), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "absence_type IN ('annual_leave', 'sick_leave', 'family_event', 'unpaid', 'other')",
            name="ck_hr_absence_type",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'cancelled')",
            name="ck_hr_absence_status",
        ),
        sa.CheckConstraint("end_date >= start_date", name="ck_hr_absence_date_order"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_hr_absence_requests_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_hr_absence_requests_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_id"],
            ["users.id"],
            name="fk_hr_absence_requests_reviewed_by_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_hr_absence_org_status_date",
        "hr_absence_requests",
        ["organization_id", "status", "start_date"],
    )
    op.create_index(
        "ix_hr_absence_user_date",
        "hr_absence_requests",
        ["user_id", "start_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_hr_absence_user_date", table_name="hr_absence_requests")
    op.drop_index("ix_hr_absence_org_status_date", table_name="hr_absence_requests")
    op.drop_table("hr_absence_requests")
    op.drop_index("ix_hr_payroll_org_period", table_name="hr_payroll_records")
    op.drop_table("hr_payroll_records")
