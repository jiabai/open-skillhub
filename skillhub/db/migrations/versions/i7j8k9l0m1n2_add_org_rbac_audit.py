from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "i7j8k9l0m1n2"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("enterprise_id", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("team_id", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("role", sa.String(length=50), nullable=False, server_default="member"))
    op.add_column("users", sa.Column("status", sa.String(length=32), nullable=False, server_default="active"))
    op.create_index("ix_users_enterprise_id", "users", ["enterprise_id"])
    op.create_index("ix_users_team_id", "users", ["team_id"])

    op.add_column("skills", sa.Column("visibility", sa.String(length=20), nullable=False, server_default="private"))
    op.add_column("skills", sa.Column("enterprise_id", sa.String(length=100), nullable=True))
    op.add_column("skills", sa.Column("team_id", sa.String(length=100), nullable=True))
    op.create_index("ix_skills_enterprise_id", "skills", ["enterprise_id"])
    op.create_index("ix_skills_team_id", "skills", ["team_id"])

    op.create_table(
        "enterprises",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("external_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_enterprises_external_id", "enterprises", ["external_id"], unique=True)

    op.create_table(
        "teams",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("external_id", sa.String(length=100), nullable=False),
        sa.Column("enterprise_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_teams_external_id", "teams", ["external_id"], unique=True)
    op.create_index("ix_teams_enterprise_id", "teams", ["enterprise_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("actor_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("result", sa.String(length=50), nullable=False, server_default="success"),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ip", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("user_agent", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("details", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_timestamp", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_teams_enterprise_id", table_name="teams")
    op.drop_index("ix_teams_external_id", table_name="teams")
    op.drop_table("teams")

    op.drop_index("ix_enterprises_external_id", table_name="enterprises")
    op.drop_table("enterprises")

    op.drop_index("ix_skills_team_id", table_name="skills")
    op.drop_index("ix_skills_enterprise_id", table_name="skills")
    op.drop_column("skills", "team_id")
    op.drop_column("skills", "enterprise_id")
    op.drop_column("skills", "visibility")

    op.drop_index("ix_users_team_id", table_name="users")
    op.drop_index("ix_users_enterprise_id", table_name="users")
    op.drop_column("users", "status")
    op.drop_column("users", "role")
    op.drop_column("users", "team_id")
    op.drop_column("users", "enterprise_id")
