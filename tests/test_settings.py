import importlib.util
import os
from pathlib import Path

import pytest
from pydantic import ValidationError

settings_path = Path(__file__).resolve().parents[1] / "backend" / "config" / "settings.py"
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://user:pass@localhost:5432/skilldrive",
)
os.environ.setdefault("SECRET_KEY", "a" * 32)
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("CORS_ORIGINS", '["http://localhost:3000"]')
spec = importlib.util.spec_from_file_location("settings_module", settings_path)
assert spec is not None
assert spec.loader is not None
settings_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(settings_module)
Settings = settings_module.Settings


def base_settings_kwargs():
    return {
        "DATABASE_URL": "postgresql+asyncpg://user:pass@localhost:5432/skilldrive",
        "SECRET_KEY": "a" * 32,
        "DEBUG": True,
        "CORS_ORIGINS": ["http://localhost:3000"],
        "FLOW_LLM_API_KEY": "key",
        "FLOW_LLM_BASE_URL": "https://api.example.com/v1",
    }


def test_parse_cors_origins_from_string():
    settings = Settings(
        **{
            **base_settings_kwargs(),
            "DEBUG": True,
            "CORS_ORIGINS": "http://a.com, http://b.com",
        },
    )
    assert settings.CORS_ORIGINS == ["http://a.com", "http://b.com"]


def test_parse_cors_origins_from_json_string():
    settings = Settings(
        **{
            **base_settings_kwargs(),
            "DEBUG": True,
            "CORS_ORIGINS": '["http://a.com","http://b.com"]',
        },
    )
    assert settings.CORS_ORIGINS == ["http://a.com", "http://b.com"]


def test_parse_deprecated_versions_from_json_string():
    settings = Settings(
        **{
            **base_settings_kwargs(),
            "DEPRECATED_VERSIONS": '["v1","v2"]',
        },
    )
    assert settings.DEPRECATED_VERSIONS == {"v1", "v2"}


def test_parse_role_permissions_from_json_string():
    settings = Settings(
        **{
            **base_settings_kwargs(),
            "RBAC_ROLE_PERMISSIONS": '{"admin":["*"],"member":["skill.read"]}',
        },
    )
    assert settings.RBAC_ROLE_PERMISSIONS == {"admin": ["*"], "member": ["skill.read"]}


def test_secret_key_too_short():
    with pytest.raises(ValidationError):
        Settings(
            **{
                **base_settings_kwargs(),
                "SECRET_KEY": "short",
            },
        )


def test_pool_settings_minimum():
    with pytest.raises(ValidationError):
        Settings(
            **{
                **base_settings_kwargs(),
                "DATABASE_POOL_SIZE": 0,
            },
        )


def test_pool_settings_maximum():
    with pytest.raises(ValidationError):
        Settings(
            **{
                **base_settings_kwargs(),
                "DATABASE_MAX_OVERFLOW": 101,
            },
        )


def test_timeout_settings_minimum():
    with pytest.raises(ValidationError):
        Settings(
            **{
                **base_settings_kwargs(),
                "DATABASE_POOL_TIMEOUT": 0,
            },
        )


def test_timeout_settings_maximum():
    with pytest.raises(ValidationError):
        Settings(
            **{
                **base_settings_kwargs(),
                "DATABASE_POOL_RECYCLE": 3601,
            },
        )


def test_skill_version_bump_strategy_invalid():
    with pytest.raises(ValidationError):
        Settings(
            **{
                **base_settings_kwargs(),
                "SKILL_VERSION_BUMP_STRATEGY": "major",
            },
        )


def test_parse_deprecation_notify_offsets_days_from_string():
    settings = Settings(
        **{
            **base_settings_kwargs(),
            "DEPRECATION_NOTIFY_OFFSETS_DAYS": "120,45,10",
        },
    )
    assert settings.DEPRECATION_NOTIFY_OFFSETS_DAYS == [120, 45, 10]


def test_alembic_files_exist():
    root = Path(__file__).resolve().parents[1]
    assert (root / "backend" / "alembic.ini").exists()
    assert (root / "backend" / "db" / "migrations" / "env.py").exists()


@pytest.mark.asyncio
async def test_init_db_skips_create_all_for_non_sqlite(monkeypatch):
    from backend.db import session as db_session

    original_database_url = db_session.settings.DATABASE_URL
    db_session.settings.DATABASE_URL = "postgresql+asyncpg://user:pass@localhost:5432/skilldrive"

    class BrokenBegin:
        async def __aenter__(self):
            raise AssertionError("init_db should not call engine.begin for non-sqlite")

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class BrokenEngine:
        def begin(self):
            return BrokenBegin()

    monkeypatch.setattr(db_session, "engine", BrokenEngine())
    try:
        await db_session.init_db()
    finally:
        db_session.settings.DATABASE_URL = original_database_url
