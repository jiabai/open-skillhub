from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "j5k6l7m8n9o0"
down_revision = "i7j8k9l0m1n2"
branch_labels = None
depends_on = None


def _get_dialect_name() -> str:
    bind = op.get_bind()
    return bind.dialect.name


def upgrade() -> None:
    dialect = _get_dialect_name()

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys=OFF")

        with op.batch_alter_table("skills", schema=None) as batch_op:
            batch_op.drop_constraint("fk_skills_user_id", type_="foreignkey")
            batch_op.create_foreign_key(
                "fk_skills_user_id", "users", ["user_id"], ["id"], ondelete="CASCADE"
            )

        with op.batch_alter_table("api_tokens", schema=None) as batch_op:
            batch_op.drop_constraint("fk_api_tokens_user_id", type_="foreignkey")
            batch_op.create_foreign_key(
                "fk_api_tokens_user_id", "users", ["user_id"], ["id"], ondelete="CASCADE"
            )

        with op.batch_alter_table("skill_versions", schema=None) as batch_op:
            batch_op.drop_constraint("fk_skill_versions_skill_id", type_="foreignkey")
            batch_op.create_foreign_key(
                "fk_skill_versions_skill_id", "skills", ["skill_id"], ["id"], ondelete="CASCADE"
            )

        with op.batch_alter_table("request_metrics", schema=None) as batch_op:
            batch_op.drop_constraint("fk_request_metrics_user_id", type_="foreignkey")
            batch_op.create_foreign_key(
                "fk_request_metrics_user_id", "users", ["user_id"], ["id"], ondelete="CASCADE"
            )

        op.execute("PRAGMA foreign_keys=ON")
    else:
        inspector = sa.inspect(op.get_bind())
        skills_fks = inspector.get_foreign_keys("skills")
        for fk in skills_fks:
            if fk["constrained_columns"] == ["user_id"]:
                op.drop_constraint(fk["name"], "skills", type_="foreignkey")
                break
        op.create_foreign_key(
            "fk_skills_user_id", "skills", "users", ["user_id"], ["id"], ondelete="CASCADE"
        )

        api_tokens_fks = inspector.get_foreign_keys("api_tokens")
        for fk in api_tokens_fks:
            if fk["constrained_columns"] == ["user_id"]:
                op.drop_constraint(fk["name"], "api_tokens", type_="foreignkey")
                break
        op.create_foreign_key(
            "fk_api_tokens_user_id", "api_tokens", "users", ["user_id"], ["id"], ondelete="CASCADE"
        )

        skill_versions_fks = inspector.get_foreign_keys("skill_versions")
        for fk in skill_versions_fks:
            if fk["constrained_columns"] == ["skill_id"]:
                op.drop_constraint(fk["name"], "skill_versions", type_="foreignkey")
                break
        op.create_foreign_key(
            "fk_skill_versions_skill_id", "skill_versions", "skills", ["skill_id"], ["id"], ondelete="CASCADE"
        )

        request_metrics_fks = inspector.get_foreign_keys("request_metrics")
        for fk in request_metrics_fks:
            if fk["constrained_columns"] == ["user_id"]:
                op.drop_constraint(fk["name"], "request_metrics", type_="foreignkey")
                break
        op.create_foreign_key(
            "fk_request_metrics_user_id", "request_metrics", "users", ["user_id"], ["id"], ondelete="CASCADE"
        )


def downgrade() -> None:
    dialect = _get_dialect_name()

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys=OFF")

        with op.batch_alter_table("request_metrics", schema=None) as batch_op:
            batch_op.drop_constraint("fk_request_metrics_user_id", type_="foreignkey")
            batch_op.create_foreign_key("fk_request_metrics_user_id", "users", ["user_id"], ["id"])

        with op.batch_alter_table("skill_versions", schema=None) as batch_op:
            batch_op.drop_constraint("fk_skill_versions_skill_id", type_="foreignkey")
            batch_op.create_foreign_key("fk_skill_versions_skill_id", "skills", ["skill_id"], ["id"])

        with op.batch_alter_table("api_tokens", schema=None) as batch_op:
            batch_op.drop_constraint("fk_api_tokens_user_id", type_="foreignkey")
            batch_op.create_foreign_key("fk_api_tokens_user_id", "users", ["user_id"], ["id"])

        with op.batch_alter_table("skills", schema=None) as batch_op:
            batch_op.drop_constraint("fk_skills_user_id", type_="foreignkey")
            batch_op.create_foreign_key("fk_skills_user_id", "users", ["user_id"], ["id"])

        op.execute("PRAGMA foreign_keys=ON")
    else:
        op.drop_constraint("fk_request_metrics_user_id", "request_metrics", type_="foreignkey")
        op.create_foreign_key("fk_request_metrics_user_id", "request_metrics", "users", ["user_id"], ["id"])

        op.drop_constraint("fk_skill_versions_skill_id", "skill_versions", type_="foreignkey")
        op.create_foreign_key("fk_skill_versions_skill_id", "skill_versions", "skills", ["skill_id"], ["id"])

        op.drop_constraint("fk_api_tokens_user_id", "api_tokens", type_="foreignkey")
        op.create_foreign_key("fk_api_tokens_user_id", "api_tokens", "users", ["user_id"], ["id"])

        op.drop_constraint("fk_skills_user_id", "skills", type_="foreignkey")
        op.create_foreign_key("fk_skills_user_id", "skills", "users", ["user_id"], ["id"])
