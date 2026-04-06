from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "l7m8n9o0p1q2"
down_revision = "k6l7m8n9o0p1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sso_nonces",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("nonce_hash", sa.String(length=64), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("nonce_hash"),
    )
    op.create_index("ix_sso_nonces_nonce_hash", "sso_nonces", ["nonce_hash"], unique=True)
    op.create_index("ix_sso_nonces_purpose", "sso_nonces", ["purpose"], unique=False)
    op.create_index("ix_sso_nonces_expires_at", "sso_nonces", ["expires_at"], unique=False)

    op.create_table(
        "sso_replay_tokens",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("replay_key_hash", sa.String(length=64), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("replay_key_hash"),
    )
    op.create_index("ix_sso_replay_tokens_replay_key_hash", "sso_replay_tokens", ["replay_key_hash"], unique=True)
    op.create_index("ix_sso_replay_tokens_purpose", "sso_replay_tokens", ["purpose"], unique=False)
    op.create_index("ix_sso_replay_tokens_expires_at", "sso_replay_tokens", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_sso_replay_tokens_expires_at", table_name="sso_replay_tokens")
    op.drop_index("ix_sso_replay_tokens_purpose", table_name="sso_replay_tokens")
    op.drop_index("ix_sso_replay_tokens_replay_key_hash", table_name="sso_replay_tokens")
    op.drop_table("sso_replay_tokens")
    op.drop_index("ix_sso_nonces_expires_at", table_name="sso_nonces")
    op.drop_index("ix_sso_nonces_purpose", table_name="sso_nonces")
    op.drop_index("ix_sso_nonces_nonce_hash", table_name="sso_nonces")
    op.drop_table("sso_nonces")
