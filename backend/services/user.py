from backend.core.utils.skill_storage import delete_skill_dir
from backend.models.user import User
from backend.repositories.skill import SkillRepository
from backend.repositories.user import UserRepository


class UserService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def update_user(self, user: User, **fields) -> User:
        return await self.user_repo.update(user, **fields)

    async def delete_user(self, user: User) -> bool:
        skill_repo = SkillRepository(self.user_repo.session)
        skills = await skill_repo.list_by_user(user.id)
        for skill in skills:
            delete_skill_dir(user.id, skill.name)
        await self.user_repo.delete(user)
        return True
