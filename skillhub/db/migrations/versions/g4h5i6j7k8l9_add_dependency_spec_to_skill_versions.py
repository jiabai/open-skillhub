from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "g4h5i6j7k8l9"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("skill_versions", sa.Column("dependency_spec", sa.JSON(), nullable=False, server_default=sa.text("'{}'")))
    op.add_column(
        "skill_versions",
        sa.Column("dependency_spec_version", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("skill_versions", "dependency_spec_version")
    op.drop_column("skill_versions", "dependency_spec")
