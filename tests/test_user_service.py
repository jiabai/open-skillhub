import pytest

from backend.config.settings import settings
from backend.core.utils.skill_archive import save_archive
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.repositories.user import UserRepository
from backend.services.skill import SkillService
from backend.services.user import UserService


@pytest.mark.asyncio
async def test_update_and_delete_user(async_session):
    user_repo = UserRepository(async_session)
    user_service = UserService(user_repo)
    user = await user_repo.create(email="b@example.com", username="userb", password="pass1234")
    updated = await user_service.update_user(user, username="userb2")
    assert updated.username == "userb2"


@pytest.mark.asyncio
async def test_delete_user(async_session):
    user_repo = UserRepository(async_session)
    user_service = UserService(user_repo)
    user = await user_repo.create(email="c@example.com", username="userc", password="pass1234")
    deleted = await user_service.delete_user(user)
    assert deleted is True


@pytest.mark.asyncio
async def test_delete_user_removes_skill_dirs(async_session, tmp_path):
    original_path = settings.SKILL_STORAGE_PATH
    settings.SKILL_STORAGE_PATH = str(tmp_path)
    try:
        user_repo = UserRepository(async_session)
        skill_repo = SkillRepository(async_session)
        skill_service = SkillService(skill_repo)
        user = await user_repo.create(email="d@example.com", username="userd", password="pass1234")
        await skill_service.create_skill(user, name="skillx", description="desc")
        skill_path = tmp_path / str(user.id) / "skillx"
        assert skill_path.exists()
        user_service = UserService(user_repo)
        await user_service.delete_user(user)
        assert not skill_path.exists()
    finally:
        settings.SKILL_STORAGE_PATH = original_path


@pytest.mark.asyncio
async def test_delete_user_removes_inactive_skill_dirs_and_archives(async_session, tmp_path):
    original_path = settings.SKILL_STORAGE_PATH
    settings.SKILL_STORAGE_PATH = str(tmp_path)
    try:
        user_repo = UserRepository(async_session)
        skill_repo = SkillRepository(async_session)
        version_repo = SkillVersionRepository(async_session)
        skill_service = SkillService(skill_repo, version_repo)
        user = await user_repo.create(email="inactive-skill@example.com", username="inactive-skill", password="pass1234")
        skill = await skill_service.create_skill(user, name="skillz", description="desc")
        await version_repo.create_version(
            skill_id=skill.id,
            version="1.0.0",
            description="desc",
            dependencies=[],
            dependency_spec={},
            dependency_spec_version=None,
            metadata={},
        )
        await save_archive(user.id, skill.name, "1.0.0", b"archive-content")
        await skill_service.deactivate_skill(user, skill.id)

        skill_path = tmp_path / str(user.id) / "skillz"
        archive_path = tmp_path / "_archives" / str(user.id) / "skillz" / "1.0.0.zip"
        assert skill_path.exists()
        assert archive_path.exists()

        user_service = UserService(user_repo)
        await user_service.delete_user(user)

        assert not skill_path.exists()
        assert not archive_path.exists()
    finally:
        settings.SKILL_STORAGE_PATH = original_path
