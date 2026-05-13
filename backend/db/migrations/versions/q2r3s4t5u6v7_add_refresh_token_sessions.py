from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "q2r3s4t5u6v7"
down_revision = "p1q2r3s4t5u6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "refresh_token_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("family_id", sa.String(length=64), nullable=False),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replaced_by_jti", sa.String(length=64), nullable=True),
        sa.UniqueConstraint("jti"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_refresh_token_sessions_user_id", "refresh_token_sessions", ["user_id"], unique=False)
    op.create_index("ix_refresh_token_sessions_family_id", "refresh_token_sessions", ["family_id"], unique=False)
    op.create_index("ix_refresh_token_sessions_jti", "refresh_token_sessions", ["jti"], unique=True)
    op.create_index("ix_refresh_token_sessions_token_hash", "refresh_token_sessions", ["token_hash"], unique=True)
    op.create_index("ix_refresh_token_sessions_status", "refresh_token_sessions", ["status"], unique=False)
    op.create_index("ix_refresh_token_sessions_expires_at", "refresh_token_sessions", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_refresh_token_sessions_expires_at", table_name="refresh_token_sessions")
    op.drop_index("ix_refresh_token_sessions_status", table_name="refresh_token_sessions")
    op.drop_index("ix_refresh_token_sessions_token_hash", table_name="refresh_token_sessions")
    op.drop_index("ix_refresh_token_sessions_jti", table_name="refresh_token_sessions")
    op.drop_index("ix_refresh_token_sessions_family_id", table_name="refresh_token_sessions")
    op.drop_index("ix_refresh_token_sessions_user_id", table_name="refresh_token_sessions")
    op.drop_table("refresh_token_sessions")
