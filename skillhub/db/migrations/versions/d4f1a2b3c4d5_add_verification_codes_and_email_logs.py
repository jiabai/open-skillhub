from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "d4f1a2b3c4d5"
down_revision = "c7e0f1a2b3c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "verification_codes",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resend_available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default=sa.text("5")),
        sa.Column("attempts_left", sa.Integer(), nullable=False, server_default=sa.text("5")),
        sa.UniqueConstraint("email", "purpose", name="uix_verification_codes_email_purpose"),
    )
    op.create_index("ix_verification_codes_email", "verification_codes", ["email"], unique=False)
    op.create_index("ix_verification_codes_purpose", "verification_codes", ["purpose"], unique=False)
    op.create_index("ix_verification_codes_expires_at", "verification_codes", ["expires_at"], unique=False)

    op.create_table(
        "email_delivery_logs",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("error_message", sa.String(length=500), nullable=True),
    )
    op.create_index("ix_email_delivery_logs_email", "email_delivery_logs", ["email"], unique=False)
    op.create_index("ix_email_delivery_logs_purpose", "email_delivery_logs", ["purpose"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_email_delivery_logs_purpose", table_name="email_delivery_logs")
    op.drop_index("ix_email_delivery_logs_email", table_name="email_delivery_logs")
    op.drop_table("email_delivery_logs")
    op.drop_index("ix_verification_codes_expires_at", table_name="verification_codes")
    op.drop_index("ix_verification_codes_purpose", table_name="verification_codes")
    op.drop_index("ix_verification_codes_email", table_name="verification_codes")
    op.drop_table("verification_codes")
