from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "p1q2r3s4t5u6"
down_revision = "o1p2q3r4s5t6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "skill_versions",
        sa.Column("content_hash", sa.String(length=64), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("skill_versions", "content_hash")
