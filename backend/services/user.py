from backend.core.utils.skill_archive import delete_archives_for_skill
from backend.domain.user_status import normalize_user_status, user_status_is_active
from backend.core.utils.skill_storage import delete_skill_dir
from backend.models.user import User
from backend.repositories.skill import SkillRepository
from backend.repositories.user import UserRepository


class UserService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def update_user(self, user: User, **fields) -> User:
        if "status" in fields and fields["status"] is not None:
            status_value = normalize_user_status(fields["status"])
            fields["status"] = status_value
            fields["is_active"] = user_status_is_active(status_value)
        return await self.user_repo.update(user, **fields)

    async def delete_user(self, user: User) -> bool:
        skill_repo = SkillRepository(self.user_repo.session)
        skills = await skill_repo.list_by_user(user.id, include_inactive=True)
        for skill in skills:
            delete_skill_dir(user.id, skill.name)
            delete_archives_for_skill(user.id, skill.name)
        await self.user_repo.delete(user)
        return True
