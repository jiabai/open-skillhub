from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "c7e0f1a2b3c4"
down_revision = "b1a2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "request_metrics",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("bucket_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("success_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("failure_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.UniqueConstraint("user_id", "bucket_start", name="uix_request_metrics_user_bucket"),
    )
    op.create_index("ix_request_metrics_user_id", "request_metrics", ["user_id"], unique=False)
    op.create_index("ix_request_metrics_bucket_start", "request_metrics", ["bucket_start"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_request_metrics_bucket_start", table_name="request_metrics")
    op.drop_index("ix_request_metrics_user_id", table_name="request_metrics")
    op.drop_table("request_metrics")
