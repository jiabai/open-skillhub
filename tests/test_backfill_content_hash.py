import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.config.settings import settings
from backend.core.utils.skill_hash import compute_skill_content_hash
from backend.core.utils.skill_storage import create_skill_dir, get_skill_versions_dir
from backend.models.skill import Skill
from backend.models.skill_version import SkillVersion
from backend.models.user import User


@pytest.mark.asyncio
async def test_backfill_content_hashes_updates_empty_version_hash(async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))

    user = User(
        email="hash-backfill@example.com",
        username="hashbackfill",
        hashed_password="!",
        is_active=True,
        is_superuser=False,
        role="member",
    )
    async_session.add(user)
    await async_session.flush()

    skill_dir = create_skill_dir(user.id, "backfill-skill")
    skill = Skill(
        user_id=user.id,
        name="backfill-skill",
        description="Backfill skill",
        tags=[],
        visibility="private",
        skill_dir=str(skill_dir),
        current_version="1.0.0",
        is_active=True,
    )
    async_session.add(skill)
    await async_session.flush()

    version_dir = get_skill_versions_dir(user.id, "backfill-skill") / "1.0.0"
    version_dir.mkdir(parents=True, exist_ok=True)
    (version_dir / "SKILL.md").write_text("---\nname: backfill-skill\n---\nbody", encoding="utf-8")
    (version_dir / "references.md").write_text("reference", encoding="utf-8")

    version = SkillVersion(
        skill_id=skill.id,
        version="1.0.0",
        description="Backfill skill",
        dependencies=[],
        dependency_spec={},
        dependency_spec_version=None,
        metadata_json={"name": "backfill-skill", "version": "1.0.0"},
    )
    async_session.add(version)
    await async_session.commit()

    import backend.scripts.backfill_content_hash as backfill_module

    monkeypatch.setattr(backfill_module, "async_session_maker", async_sessionmaker(async_session.bind, expire_on_commit=False))
    result = await backfill_module.backfill_content_hashes()

    assert result.updated_count == 1
    assert result.skipped_count == 0
    await async_session.refresh(version)
    assert version.content_hash == compute_skill_content_hash(version_dir)
