from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "e2f3a4b5c6d7"
down_revision = "d4f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("skills", sa.Column("current_version", sa.String(length=50), nullable=True))
    op.create_table(
        "skill_versions",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("skill_id", sa.String(length=36), sa.ForeignKey("skills.id"), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False, server_default=sa.text("''")),
        sa.Column("dependencies", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.UniqueConstraint("skill_id", "version", name="uix_skill_versions"),
    )
    op.create_index("ix_skill_versions_skill_id", "skill_versions", ["skill_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_skill_versions_skill_id", table_name="skill_versions")
    op.drop_table("skill_versions")
    op.drop_column("skills", "current_version")
