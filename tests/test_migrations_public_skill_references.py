from pathlib import Path

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, inspect, text

from backend.config.settings import settings
from backend.db.migrations.versions.m8n9o0p1q2r3_add_public_skill_references import (
    SYSTEM_USER_ID,
)

pytestmark = pytest.mark.filterwarnings("ignore::sqlalchemy.exc.SAWarning")


def _make_alembic_config(database_url: str) -> Config:
    root = Path(__file__).resolve().parents[1]
    config = Config()
    config.set_main_option("script_location", str(root / "backend" / "db" / "migrations"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def test_public_skill_reference_migration_upgrade_and_downgrade(tmp_path):
    db_path = tmp_path / "migration-public-skills.db"
    database_url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    config = _make_alembic_config(database_url)
    sync_engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    original_database_url = settings.DATABASE_URL

    try:
        settings.DATABASE_URL = database_url

        command.upgrade(config, "l7m8n9o0p1q2")

        inspector = inspect(sync_engine)
        baseline_columns = {column["name"] for column in inspector.get_columns("skills")}
        assert "source_skill_id" not in baseline_columns
        assert "pinned_version" not in baseline_columns

        command.upgrade(config, "m8n9o0p1q2r3")

        inspector = inspect(sync_engine)
        upgraded_columns = {column["name"] for column in inspector.get_columns("skills")}
        assert "source_skill_id" in upgraded_columns
        assert "pinned_version" in upgraded_columns

        indexes = {index["name"] for index in inspector.get_indexes("skills")}
        assert "ix_skills_source_skill_id" in indexes

        foreign_keys = inspector.get_foreign_keys("skills")
        source_fk = next(
            fk for fk in foreign_keys if fk["constrained_columns"] == ["source_skill_id"]
        )
        assert source_fk["referred_table"] == "skills"
        assert source_fk["referred_columns"] == ["id"]
        assert source_fk["options"].get("ondelete") == "SET NULL"

        with sync_engine.connect() as connection:
            system_user = connection.execute(
                text(
                    """
                    SELECT id, email, username, is_active, is_superuser, role, status
                    FROM users
                    WHERE id = :id
                    """
                ),
                {"id": SYSTEM_USER_ID},
            ).mappings().one()

        assert system_user["email"] == "system@local.invalid"
        assert system_user["username"] == "__system__"
        assert system_user["is_active"] == 0
        assert system_user["is_superuser"] == 1
        assert system_user["role"] == "admin"
        assert system_user["status"] == "inactive"

        command.downgrade(config, "l7m8n9o0p1q2")

        inspector = inspect(sync_engine)
        downgraded_columns = {column["name"] for column in inspector.get_columns("skills")}
        assert "source_skill_id" not in downgraded_columns
        assert "pinned_version" not in downgraded_columns

        with sync_engine.connect() as connection:
            remaining = connection.execute(
                text("SELECT COUNT(*) FROM users WHERE id = :id"),
                {"id": SYSTEM_USER_ID},
            ).scalar_one()

        assert remaining == 0
    finally:
        settings.DATABASE_URL = original_database_url
        sync_engine.dispose()
