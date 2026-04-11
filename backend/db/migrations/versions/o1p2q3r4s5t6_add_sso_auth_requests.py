from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "o1p2q3r4s5t6"
down_revision = "n9o0p1q2r3s4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sso_auth_requests",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("state_hash", sa.String(length=64), nullable=False),
        sa.Column("nonce_hash", sa.String(length=64), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("code_verifier", sa.Text(), nullable=False),
        sa.Column("redirect_uri", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("state_hash"),
    )
    op.create_index("ix_sso_auth_requests_state_hash", "sso_auth_requests", ["state_hash"], unique=True)
    op.create_index("ix_sso_auth_requests_nonce_hash", "sso_auth_requests", ["nonce_hash"], unique=False)
    op.create_index("ix_sso_auth_requests_purpose", "sso_auth_requests", ["purpose"], unique=False)
    op.create_index("ix_sso_auth_requests_expires_at", "sso_auth_requests", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_sso_auth_requests_expires_at", table_name="sso_auth_requests")
    op.drop_index("ix_sso_auth_requests_purpose", table_name="sso_auth_requests")
    op.drop_index("ix_sso_auth_requests_nonce_hash", table_name="sso_auth_requests")
    op.drop_index("ix_sso_auth_requests_state_hash", table_name="sso_auth_requests")
    op.drop_table("sso_auth_requests")
