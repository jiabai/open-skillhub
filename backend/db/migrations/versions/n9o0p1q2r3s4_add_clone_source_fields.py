from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

op = cast(Any, _op)

revision = "n9o0p1q2r3s4"
down_revision = "m8n9o0p1q2r3"
branch_labels = None
depends_on = None


def _backfill_clone_sources() -> None:
    bind = op.get_bind()
    meta = sa.MetaData()
    skills = sa.Table("skills", meta, autoload_with=bind)
    skill_versions = sa.Table("skill_versions", meta, autoload_with=bind)

    rows = bind.execute(
        sa.select(skills.c.id).where(
            skills.c.source_skill_id.is_(None),
            skills.c.cloned_from_skill_id.is_(None),
        )
    ).fetchall()

    for row in rows:
        skill_id = row.id
        version_rows = bind.execute(
            sa.select(skill_versions.c.metadata)
            .where(skill_versions.c.skill_id == skill_id)
            .order_by(skill_versions.c.created_at.desc())
        ).fetchall()

        clone_source_skill_id = None
        clone_source_version = None
        for version_row in version_rows:
            metadata = version_row.metadata or {}
            if not isinstance(metadata, dict):
                continue
            candidate_skill_id = metadata.get("cloned_from_skill_id")
            if not isinstance(candidate_skill_id, str) or not candidate_skill_id.strip():
                continue
            clone_source_skill_id = candidate_skill_id
            candidate_version = metadata.get("cloned_from_version")
            if isinstance(candidate_version, str) and candidate_version.strip():
                clone_source_version = candidate_version
            break

        if clone_source_skill_id:
            source_skill_exists = bind.execute(
                sa.select(sa.literal(True)).where(skills.c.id == clone_source_skill_id)
            ).scalar()
            if not source_skill_exists:
                continue
            bind.execute(
                skills.update()
                .where(skills.c.id == skill_id)
                .values(
                    cloned_from_skill_id=clone_source_skill_id,
                    cloned_from_version=clone_source_version,
                )
            )


def upgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        with op.batch_alter_table("skills", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("cloned_from_skill_id", sa.String(length=36), nullable=True)
            )
            batch_op.add_column(
                sa.Column("cloned_from_version", sa.String(length=50), nullable=True)
            )
            batch_op.create_index(
                "ix_skills_cloned_from_skill_id", ["cloned_from_skill_id"], unique=False
            )
            batch_op.create_foreign_key(
                "fk_skills_cloned_from_skill_id",
                "skills",
                ["cloned_from_skill_id"],
                ["id"],
                ondelete="SET NULL",
            )
    else:
        op.add_column("skills", sa.Column("cloned_from_skill_id", sa.String(length=36), nullable=True))
        op.add_column("skills", sa.Column("cloned_from_version", sa.String(length=50), nullable=True))
        op.create_index("ix_skills_cloned_from_skill_id", "skills", ["cloned_from_skill_id"], unique=False)
        op.create_foreign_key(
            "fk_skills_cloned_from_skill_id",
            "skills",
            "skills",
            ["cloned_from_skill_id"],
            ["id"],
            ondelete="SET NULL",
        )

    _backfill_clone_sources()


def downgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        with op.batch_alter_table("skills", schema=None) as batch_op:
            batch_op.drop_constraint("fk_skills_cloned_from_skill_id", type_="foreignkey")
            batch_op.drop_index("ix_skills_cloned_from_skill_id")
            batch_op.drop_column("cloned_from_version")
            batch_op.drop_column("cloned_from_skill_id")
    else:
        op.drop_constraint("fk_skills_cloned_from_skill_id", "skills", type_="foreignkey")
        op.drop_index("ix_skills_cloned_from_skill_id", table_name="skills")
        op.drop_column("skills", "cloned_from_version")
        op.drop_column("skills", "cloned_from_skill_id")
