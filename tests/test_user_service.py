import pytest

from backend.config.settings import settings
from backend.repositories.skill import SkillRepository
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
