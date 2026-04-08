from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "m8n9o0p1q2r3"
down_revision = "l7m8n9o0p1q2"
branch_labels = None
depends_on = None

SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    op.add_column("skills", sa.Column("source_skill_id", sa.String(length=36), nullable=True))
    op.add_column("skills", sa.Column("pinned_version", sa.String(length=50), nullable=True))
    op.create_index("ix_skills_source_skill_id", "skills", ["source_skill_id"], unique=False)
    op.create_foreign_key(
        "fk_skills_source_skill_id",
        "skills",
        "skills",
        ["source_skill_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(
        sa.text(
            """
            INSERT INTO users (
                id, created_at, updated_at, email, username, hashed_password,
                is_active, is_superuser, enterprise_id, team_id, role, status, jwt_token_version
            )
            VALUES (
                :id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, :email, :username, :password,
                :is_active, :is_superuser, NULL, NULL, :role, :status, 0
            )
            """
        ).bindparams(
            id=SYSTEM_USER_ID,
            email="system@local.invalid",
            username="__system__",
            password="!",
            is_active=False,
            is_superuser=True,
            role="admin",
            status="inactive",
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM users WHERE id = :id").bindparams(id=SYSTEM_USER_ID))
    op.drop_constraint("fk_skills_source_skill_id", "skills", type_="foreignkey")
    op.drop_index("ix_skills_source_skill_id", table_name="skills")
    op.drop_column("skills", "pinned_version")
    op.drop_column("skills", "source_skill_id")
