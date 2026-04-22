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


def _add_system_user(async_session) -> User:
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
    return system_user


def _write_skill(skill_root: Path, name: str, description: str, versions: list[str] | None = None) -> Path:
    skill_dir = skill_root / SYSTEM_STORAGE_OWNER / name
    if versions:
        for version in versions:
            (skill_dir / "_versions" / version).mkdir(parents=True, exist_ok=True)
    else:
        skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: {description}\n---\nbody",
        encoding="utf-8",
    )
    return skill_dir


@pytest.mark.asyncio
async def test_sync_public_skills_creates_public_skill_and_versions(async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))

    _add_system_user(async_session)
    await async_session.commit()

    _write_skill(tmp_path, "starter-skill", "Starter public skill", versions=["1.0.0", "1.2.0"])

    import backend.scripts.sync_public_skills as sync_module

    monkeypatch.setattr(sync_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    result = await sync_module.sync_public_skills()

    assert result.mode == "full"
    assert result.synced_skill_names == ("starter-skill",)
    assert result.deactivated_skill_names == ()

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

    _add_system_user(async_session)
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

    _write_skill(tmp_path, "starter-skill", "Updated public skill", versions=["1.0.0", "2.0.0"])

    import backend.scripts.sync_public_skills as sync_module

    monkeypatch.setattr(sync_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    result = await sync_module.sync_public_skills()

    assert result.mode == "full"
    assert result.synced_skill_names == ("starter-skill",)
    assert result.deactivated_skill_names == ("missing-skill",)

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
    _write_skill(tmp_path, "starter-skill", "Starter public skill")

    import backend.scripts.sync_public_skills as sync_module

    monkeypatch.setattr(sync_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    with pytest.raises(RuntimeError, match="System user missing"):
        await sync_module.sync_public_skills()


@pytest.mark.asyncio
async def test_sync_public_skills_targeted_mode_only_updates_requested_skill(async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))

    _add_system_user(async_session)
    await async_session.commit()

    target_skill = Skill(
        user_id=SYSTEM_USER_ID,
        name="starter-skill",
        description="old desc",
        tags=[],
        visibility="public",
        skill_dir="old-path",
        current_version="1.0.0",
        is_active=False,
    )
    other_skill = Skill(
        user_id=SYSTEM_USER_ID,
        name="keep-me",
        description="stay active",
        tags=[],
        visibility="public",
        skill_dir="keep-path",
        current_version="1.0.0",
        is_active=True,
    )
    async_session.add_all([target_skill, other_skill])
    await async_session.commit()

    _write_skill(tmp_path, "starter-skill", "Updated public skill", versions=["1.0.0", "1.5.0"])

    import backend.scripts.sync_public_skills as sync_module

    monkeypatch.setattr(sync_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    result = await sync_module.sync_public_skills("starter-skill")

    assert result.mode == "targeted"
    assert result.synced_skill_names == ("starter-skill",)
    assert result.deactivated_skill_names == ()

    await async_session.refresh(target_skill)
    await async_session.refresh(other_skill)
    assert target_skill.description == "Updated public skill"
    assert target_skill.current_version == "1.5.0"
    assert target_skill.is_active is True
    assert other_skill.is_active is True


@pytest.mark.asyncio
async def test_sync_public_skills_targeted_mode_uses_storage_root_override_for_source(async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", "/app/data/skills")

    _add_system_user(async_session)
    await async_session.commit()

    _write_skill(tmp_path, "starter-skill", "Starter public skill", versions=["1.0.0"])

    import backend.scripts.sync_public_skills as sync_module

    monkeypatch.setattr(sync_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    await sync_module.sync_public_skills("starter-skill", storage_root=tmp_path)

    result = await async_session.execute(select(Skill).where(Skill.user_id == SYSTEM_USER_ID, Skill.name == "starter-skill"))
    skill = result.scalar_one()
    assert skill.skill_dir == "/app/data/skills/__system__/starter-skill"


@pytest.mark.asyncio
async def test_sync_public_skills_targeted_mode_requires_existing_skill_dir(async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))

    _add_system_user(async_session)
    await async_session.commit()

    import backend.scripts.sync_public_skills as sync_module

    monkeypatch.setattr(sync_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    with pytest.raises(FileNotFoundError, match="Public skill 'starter-skill' not found"):
        await sync_module.sync_public_skills("starter-skill")


@pytest.mark.asyncio
async def test_sync_public_skills_targeted_mode_requires_skill_md(async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))

    _add_system_user(async_session)
    await async_session.commit()

    skill_dir = Path(tmp_path) / SYSTEM_STORAGE_OWNER / "starter-skill"
    skill_dir.mkdir(parents=True, exist_ok=True)

    import backend.scripts.sync_public_skills as sync_module

    monkeypatch.setattr(sync_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    with pytest.raises(FileNotFoundError, match="SKILL.md not found"):
        await sync_module.sync_public_skills("starter-skill")


@pytest.mark.asyncio
async def test_sync_public_skills_targeted_mode_rejects_invalid_skill_name(async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))

    _add_system_user(async_session)
    await async_session.commit()

    import backend.scripts.sync_public_skills as sync_module

    monkeypatch.setattr(sync_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    with pytest.raises(ValueError, match="cannot contain path separators"):
        await sync_module.sync_public_skills("bad/name")


def test_sync_public_skills_main_passes_targeted_args(monkeypatch, tmp_path):
    import backend.scripts.sync_public_skills as sync_module

    captured: dict[str, object] = {}

    async def fake_sync_public_skills(skill_name=None, *, storage_root=None):
        captured["skill_name"] = skill_name
        captured["storage_root"] = storage_root
        return sync_module.SyncPublicSkillsResult(
            mode="targeted",
            system_dir=Path(tmp_path),
            synced_skill_names=("starter-skill",),
            deactivated_skill_names=(),
        )

    monkeypatch.setattr(sync_module, "sync_public_skills", fake_sync_public_skills)

    exit_code = sync_module.main(["starter-skill", "--storage-root", str(tmp_path)])

    assert exit_code == 0
    assert captured == {
        "skill_name": "starter-skill",
        "storage_root": str(tmp_path),
    }
