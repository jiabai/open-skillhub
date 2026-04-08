from pathlib import Path

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, inspect, text

from backend.config.settings import settings

pytestmark = pytest.mark.filterwarnings("ignore::sqlalchemy.exc.SAWarning")


def _make_alembic_config(database_url: str) -> Config:
    root = Path(__file__).resolve().parents[1]
    config = Config()
    config.set_main_option("script_location", str(root / "backend" / "db" / "migrations"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def test_clone_source_migration_upgrade_backfills_and_downgrades(tmp_path):
    db_path = tmp_path / "migration-clone-sources.db"
    database_url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    config = _make_alembic_config(database_url)
    sync_engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    original_database_url = settings.DATABASE_URL

    try:
        settings.DATABASE_URL = database_url
        command.upgrade(config, "m8n9o0p1q2r3")

        with sync_engine.begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO users (id, email, username, hashed_password, is_active, is_superuser, role, status, jwt_token_version)
                    VALUES (:id, :email, :username, :password, 1, 0, 'member', 'active', 0)
                    """
                ),
                {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "email": "clone-owner@example.com",
                    "username": "clone-owner",
                    "password": "!",
                },
            )
            connection.execute(
                text(
                    """
                    INSERT INTO skills (
                        id, user_id, name, description, tags, visibility, enterprise_id, team_id,
                        source_skill_id, pinned_version, skill_dir, current_version, is_active
                    )
                    VALUES (
                        :id, :user_id, :name, '', '[]', 'private', NULL, NULL,
                        NULL, NULL, '', '1.1.0', 1
                    )
                    """
                ),
                {
                    "id": "22222222-2222-2222-2222-222222222222",
                    "user_id": "11111111-1111-1111-1111-111111111111",
                    "name": "clone-skill",
                },
            )
            connection.execute(
                text(
                    """
                    INSERT INTO skills (
                        id, user_id, name, description, tags, visibility, enterprise_id, team_id,
                        source_skill_id, pinned_version, skill_dir, current_version, is_active
                    )
                    VALUES (
                        :id, :user_id, :name, '', '[]', 'public', NULL, NULL,
                        NULL, NULL, '', '1.2.3', 1
                    )
                    """
                ),
                {
                    "id": "public-skill-id",
                    "user_id": "11111111-1111-1111-1111-111111111111",
                    "name": "public-skill",
                },
            )
            connection.execute(
                text(
                    """
                    INSERT INTO skill_versions (
                        id, skill_id, version, description, dependencies, dependency_spec,
                        dependency_spec_version, metadata
                    )
                    VALUES (
                        :id, :skill_id, :version, '', '[]', '{}', '1', :metadata
                    )
                    """
                ),
                {
                    "id": "33333333-3333-3333-3333-333333333333",
                    "skill_id": "22222222-2222-2222-2222-222222222222",
                    "version": "1.0.0",
                    "metadata": '{"cloned_from_skill_id":"public-skill-id","cloned_from_version":"1.2.3"}',
                },
            )
            connection.execute(
                text(
                    """
                    INSERT INTO skill_versions (
                        id, skill_id, version, description, dependencies, dependency_spec,
                        dependency_spec_version, metadata
                    )
                    VALUES (
                        :id, :skill_id, :version, '', '[]', '{}', '1', '{}'
                    )
                    """
                ),
                {
                    "id": "44444444-4444-4444-4444-444444444444",
                    "skill_id": "22222222-2222-2222-2222-222222222222",
                    "version": "1.1.0",
                },
            )

        command.upgrade(config, "n9o0p1q2r3s4")

        inspector = inspect(sync_engine)
        upgraded_columns = {column["name"] for column in inspector.get_columns("skills")}
        assert "cloned_from_skill_id" in upgraded_columns
        assert "cloned_from_version" in upgraded_columns

        indexes = {index["name"] for index in inspector.get_indexes("skills")}
        assert "ix_skills_cloned_from_skill_id" in indexes

        with sync_engine.connect() as connection:
            row = connection.execute(
                text(
                    """
                    SELECT cloned_from_skill_id, cloned_from_version
                    FROM skills
                    WHERE id = :id
                    """
                ),
                {"id": "22222222-2222-2222-2222-222222222222"},
            ).mappings().one()

        assert row["cloned_from_skill_id"] == "public-skill-id"
        assert row["cloned_from_version"] == "1.2.3"

        command.downgrade(config, "m8n9o0p1q2r3")

        inspector = inspect(sync_engine)
        downgraded_columns = {column["name"] for column in inspector.get_columns("skills")}
        assert "cloned_from_skill_id" not in downgraded_columns
        assert "cloned_from_version" not in downgraded_columns
    finally:
        settings.DATABASE_URL = original_database_url
        sync_engine.dispose()


def test_clone_source_migration_skips_missing_source_skill(tmp_path):
    db_path = tmp_path / "migration-clone-sources-missing.db"
    database_url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    config = _make_alembic_config(database_url)
    sync_engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    original_database_url = settings.DATABASE_URL

    try:
        settings.DATABASE_URL = database_url
        command.upgrade(config, "m8n9o0p1q2r3")

        with sync_engine.begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO users (id, email, username, hashed_password, is_active, is_superuser, role, status, jwt_token_version)
                    VALUES (:id, :email, :username, :password, 1, 0, 'member', 'active', 0)
                    """
                ),
                {
                    "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                    "email": "missing-source@example.com",
                    "username": "missing-source",
                    "password": "!",
                },
            )
            connection.execute(
                text(
                    """
                    INSERT INTO skills (
                        id, user_id, name, description, tags, visibility, enterprise_id, team_id,
                        source_skill_id, pinned_version, skill_dir, current_version, is_active
                    )
                    VALUES (
                        :id, :user_id, :name, '', '[]', 'private', NULL, NULL,
                        NULL, NULL, '', '1.0.0', 1
                    )
                    """
                ),
                {
                    "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                    "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                    "name": "clone-missing-source",
                },
            )
            connection.execute(
                text(
                    """
                    INSERT INTO skill_versions (
                        id, skill_id, version, description, dependencies, dependency_spec,
                        dependency_spec_version, metadata
                    )
                    VALUES (
                        :id, :skill_id, :version, '', '[]', '{}', '1', :metadata
                    )
                    """
                ),
                {
                    "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
                    "skill_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                    "version": "1.0.0",
                    "metadata": '{"cloned_from_skill_id":"missing-public-skill","cloned_from_version":"2.0.0"}',
                },
            )

        command.upgrade(config, "n9o0p1q2r3s4")

        with sync_engine.connect() as connection:
            row = connection.execute(
                text(
                    """
                    SELECT cloned_from_skill_id, cloned_from_version
                    FROM skills
                    WHERE id = :id
                    """
                ),
                {"id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"},
            ).mappings().one()

        assert row["cloned_from_skill_id"] is None
        assert row["cloned_from_version"] is None
    finally:
        settings.DATABASE_URL = original_database_url
        sync_engine.dispose()
