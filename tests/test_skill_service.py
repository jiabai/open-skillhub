import pytest

from skillhub.repositories.skill import SkillRepository
from skillhub.repositories.user import UserRepository
from skillhub.services.skill import SkillService


@pytest.mark.asyncio
async def test_create_update_delete_skill(async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    user_repo = UserRepository(async_session)
    skill_repo = SkillRepository(async_session)
    skill_service = SkillService(skill_repo)
    user = await user_repo.create(email="e@example.com", username="usere", password="pass1234")
    created = await skill_service.create_skill(user, name="skillx", description="desc")
    skills = await skill_service.list_skills(user)
    assert len(skills) == 1
    updated = await skill_service.update_skill(user, created.id, description="new")
    assert updated.description == "new"
    deleted = await skill_service.delete_skill(user, created.id)
    assert deleted is True


def test_skill_unique_constraint_name():
    from skillhub.models.skill import Skill

    constraint_names = {constraint.name for constraint in Skill.__table__.constraints if constraint.name}
    assert "uix_user_skill_name" in constraint_names


@pytest.mark.asyncio
async def test_rename_skill_updates_directory(async_session, tmp_path):
    from skillhub.config.settings import settings

    original_path = settings.SKILL_STORAGE_PATH
    settings.SKILL_STORAGE_PATH = str(tmp_path)
    try:
        user_repo = UserRepository(async_session)
        skill_repo = SkillRepository(async_session)
        skill_service = SkillService(skill_repo)
        user = await user_repo.create(email="f@example.com", username="userf", password="pass1234")
        created = await skill_service.create_skill(user, name="skillold", description="desc")
        old_path = tmp_path / str(user.id) / "skillold"
        assert old_path.exists()
        updated = await skill_service.update_skill(user, created.id, name="skillnew")
        new_path = tmp_path / str(user.id) / "skillnew"
        assert updated.name == "skillnew"
        assert new_path.exists()
        assert not old_path.exists()
    finally:
        settings.SKILL_STORAGE_PATH = original_path


@pytest.mark.asyncio
async def test_delete_skill_cascades_to_versions(async_session, tmp_path, monkeypatch):
    from skillhub.repositories.skill_version import SkillVersionRepository

    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    user_repo = UserRepository(async_session)
    skill_repo = SkillRepository(async_session)
    version_repo = SkillVersionRepository(async_session)
    skill_service = SkillService(skill_repo)

    user = await user_repo.create(email="cascade@example.com", username="usercascade", password="pass1234")
    skill = await skill_service.create_skill(user, name="skill_with_version", description="desc")

    await version_repo.create_version(
        skill_id=skill.id,
        version="1.0.0",
        description="first version",
        dependencies=[],
        dependency_spec={},
        dependency_spec_version=None,
        metadata={},
    )

    all_versions_before = await version_repo.list_by_skill(skill.id)
    assert len(all_versions_before) == 1

    await skill_service.delete_skill(user, skill.id)

    all_versions_after = await version_repo.list_by_skill(skill.id)
    assert len(all_versions_after) == 0
