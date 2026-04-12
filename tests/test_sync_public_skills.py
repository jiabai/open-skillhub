from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.config.settings import settings
from backend.core.security.user_state import UserStatus
from backend.core.utils.skill_storage import SYSTEM_STORAGE_OWNER, SYSTEM_USER_ID
from backend.models.skill import Skill
from backend.models.skill_version import SkillVersion
from backend.models.user import User


@pytest.mark.asyncio
async def test_sync_public_skills_creates_public_skill_and_versions(async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))

    system_user = User(
        id=SYSTEM_USER_ID,
        email="system@local.invalid",
        username="__system__",
        hashed_password="!",
        is_active=False,
        is_superuser=True,
        role="admin",
        status=UserStatus.INACTIVE,
    )
    async_session.add(system_user)
    await async_session.commit()

    system_dir = Path(tmp_path) / SYSTEM_STORAGE_OWNER / "starter-skill"
    versions_dir = system_dir / "_versions"
    (versions_dir / "1.0.0").mkdir(parents=True, exist_ok=True)
    (versions_dir / "1.2.0").mkdir(parents=True, exist_ok=True)
    (system_dir / "SKILL.md").write_text(
        "---\nname: starter-skill\ndescription: Starter public skill\n---\nbody",
        encoding="utf-8",
    )

    import backend.scripts.sync_public_skills as sync_module

    monkeypatch.setattr(sync_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    await sync_module.sync_public_skills()

    result = await async_session.execute(select(Skill).where(Skill.user_id == SYSTEM_USER_ID, Skill.name == "starter-skill"))
    skill = result.scalar_one()
    assert skill.visibility == "public"
    assert skill.description == "Starter public skill"
    assert skill.current_version == "1.2.0"
    assert skill.is_active is True

    versions = await async_session.execute(
        select(SkillVersion).where(SkillVersion.skill_id == skill.id).order_by(SkillVersion.version.asc())
    )
    version_items = versions.scalars().all()
    assert [item.version for item in version_items] == ["1.0.0", "1.2.0"]


@pytest.mark.asyncio
async def test_sync_public_skills_updates_existing_skill_and_deactivates_missing(async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))

    system_user = User(
        id=SYSTEM_USER_ID,
        email="system@local.invalid",
        username="__system__",
        hashed_password="!",
        is_active=False,
        is_superuser=True,
        role="admin",
        status=UserStatus.INACTIVE,
    )
    async_session.add(system_user)
    await async_session.commit()

    existing_skill = Skill(
        user_id=SYSTEM_USER_ID,
        name="starter-skill",
        description="old desc",
        tags=[],
        visibility="public",
        skill_dir="old-path",
        current_version="1.0.0",
        is_active=False,
    )
    missing_skill = Skill(
        user_id=SYSTEM_USER_ID,
        name="missing-skill",
        description="should deactivate",
        tags=[],
        visibility="public",
        skill_dir="missing-path",
        current_version="1.0.0",
        is_active=True,
    )
    async_session.add_all([existing_skill, missing_skill])
    await async_session.commit()
    await async_session.refresh(existing_skill)

    existing_version = SkillVersion(
        skill_id=existing_skill.id,
        version="1.0.0",
        description="old desc",
        dependencies=[],
        dependency_spec={},
        dependency_spec_version=None,
        metadata_json={"name": "starter-skill", "version": "1.0.0"},
    )
    async_session.add(existing_version)
    await async_session.commit()

    system_dir = Path(tmp_path) / SYSTEM_STORAGE_OWNER / "starter-skill"
    versions_dir = system_dir / "_versions"
    (versions_dir / "1.0.0").mkdir(parents=True, exist_ok=True)
    (versions_dir / "2.0.0").mkdir(parents=True, exist_ok=True)
    (system_dir / "SKILL.md").write_text(
        "---\nname: starter-skill\ndescription: Updated public skill\n---\nbody",
        encoding="utf-8",
    )

    import backend.scripts.sync_public_skills as sync_module

    monkeypatch.setattr(sync_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    await sync_module.sync_public_skills()

    await async_session.refresh(existing_skill)
    await async_session.refresh(missing_skill)
    assert existing_skill.description == "Updated public skill"
    assert existing_skill.current_version == "2.0.0"
    assert existing_skill.is_active is True
    assert missing_skill.is_active is False

    versions = await async_session.execute(
        select(SkillVersion).where(SkillVersion.skill_id == existing_skill.id).order_by(SkillVersion.version.asc())
    )
    assert [item.version for item in versions.scalars().all()] == ["1.0.0", "2.0.0"]


@pytest.mark.asyncio
async def test_sync_public_skills_requires_system_user(async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    system_dir = Path(tmp_path) / SYSTEM_STORAGE_OWNER / "starter-skill"
    system_dir.mkdir(parents=True, exist_ok=True)
    (system_dir / "SKILL.md").write_text("---\nname: starter-skill\n---\nbody", encoding="utf-8")

    import backend.scripts.sync_public_skills as sync_module

    monkeypatch.setattr(sync_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    with pytest.raises(RuntimeError, match="System user missing"):
        await sync_module.sync_public_skills()
