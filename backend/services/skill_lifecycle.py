from datetime import datetime, timezone

from loguru import logger

from backend.config.settings import settings
from backend.core.security.rbac import is_skill_visible
from backend.core.utils.skill_archive import delete_archives_for_skill, rename_archives_for_skill
from backend.core.utils.skill_storage import create_skill_dir, delete_skill_dir, get_user_skill_dir, validate_skill_name
from backend.models.skill import Skill
from backend.models.user import User
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.services.skill_clone import SkillCloneService
from backend.services.skill_errors import SkillError, SkillErrorCode


class SkillLifecycleCoordinator:
    def __init__(
        self,
        skill_repo: SkillRepository,
        version_repo: SkillVersionRepository | None = None,
        clone_service: SkillCloneService | None = None,
    ):
        self.skill_repo = skill_repo
        self.version_repo = version_repo
        self.clone_service = clone_service

    async def list_skills(
        self,
        user: User,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
        include_inactive: bool = False,
    ) -> list[Skill]:
        return await self.skill_repo.list_visible(
            user.id,
            user.enterprise_id,
            user.team_id,
            skip=skip,
            limit=limit,
            query=query,
            include_inactive=include_inactive,
        )

    async def list_workspace_skills(
        self,
        user: User,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
        include_inactive: bool = False,
    ) -> list[Skill]:
        return await self.skill_repo.list_workspace(
            user.id,
            user.enterprise_id,
            user.team_id,
            skip=skip,
            limit=limit,
            query=query,
            include_inactive=include_inactive,
        )

    async def count_workspace_skills(
        self,
        user: User,
        query: str | None = None,
        include_inactive: bool = False,
    ) -> int:
        return await self.skill_repo.count_workspace(
            user.id,
            user.enterprise_id,
            user.team_id,
            query=query,
            include_inactive=include_inactive,
        )

    async def get_skill(self, user: User, skill_id: str) -> Skill:
        skill = await self.skill_repo.get_by_id(skill_id)
        if not skill:
            raise SkillError(SkillErrorCode.SKILL_NOT_FOUND)
        if not is_skill_visible(user, skill):
            raise SkillError(SkillErrorCode.SKILL_NOT_FOUND)
        return skill

    @staticmethod
    def public_features_enabled() -> bool:
        return bool(settings.ENABLE_SKILL_VISIBILITY) and not bool(settings.ENABLE_RBAC)

    @staticmethod
    def is_public_skill(skill: Skill) -> bool:
        return (skill.visibility or "").strip().lower() == "public"

    @staticmethod
    def is_reference_skill(skill: Skill) -> bool:
        source_skill_id = skill.source_skill_id
        return isinstance(source_skill_id, str) and bool(source_skill_id.strip())

    async def is_clone_skill(self, skill: Skill) -> bool:
        if self.is_reference_skill(skill) or self.is_public_skill(skill):
            return False
        if not self.clone_service:
            return False
        return self.clone_service.has_clone_origin(skill)

    async def get_clone_origin_metadata(self, skill: Skill) -> dict[str, str]:
        if not self.clone_service:
            return {}
        return await self.clone_service.get_clone_origin_metadata(skill)

    async def skill_kind(self, skill: Skill) -> str:
        if self.is_reference_skill(skill):
            return "reference"
        if self.is_public_skill(skill):
            return "public"
        if await self.is_clone_skill(skill):
            return "clone"
        return "regular"

    @classmethod
    def assert_public_features_enabled(cls) -> None:
        if not cls.public_features_enabled():
            raise SkillError(SkillErrorCode.PUBLIC_SKILLS_DISABLED)

    @classmethod
    def ensure_not_reference(cls, skill: Skill) -> None:
        if cls.is_reference_skill(skill):
            raise SkillError(SkillErrorCode.REFERENCE_SKILL_READ_ONLY)

    async def resolve_source_skill(self, skill: Skill) -> Skill:
        source_skill_id = skill.source_skill_id
        if not isinstance(source_skill_id, str) or not source_skill_id.strip():
            return skill
        source_skill = await self.skill_repo.get_by_id(source_skill_id)
        if not source_skill or not self.is_public_skill(source_skill) or not source_skill.is_active:
            raise SkillError(SkillErrorCode.SOURCE_SKILL_UNAVAILABLE)
        return source_skill

    async def create_skill(
        self,
        user: User,
        name: str,
        description: str,
        tags: list[str] | None = None,
        visibility: str | None = None,
        commit: bool = True,
    ) -> Skill:
        valid, error = validate_skill_name(name)
        if not valid:
            raise SkillError(SkillErrorCode.INVALID_SKILL_NAME, error)
        if await self.skill_repo.get_by_name(user.id, name):
            raise SkillError(SkillErrorCode.SKILL_ALREADY_EXISTS)
        tags = tags or []
        visibility_value = (visibility or settings.DEFAULT_SKILL_VISIBILITY or "private").strip().lower()
        if visibility_value not in {"private", "team", "enterprise"}:
            raise SkillError(SkillErrorCode.INVALID_VISIBILITY)
        path = create_skill_dir(user.id, name)
        return await self.skill_repo.create(
            user_id=user.id,
            name=name,
            description=description,
            tags=tags,
            visibility=visibility_value,
            enterprise_id=user.enterprise_id,
            team_id=user.team_id,
            skill_dir=str(path),
            commit=commit,
        )

    async def update_skill(self, user: User, skill_id: str, **fields) -> Skill:
        skill = await self.get_skill(user, skill_id)
        self.ensure_owner(user, skill)
        if self.is_reference_skill(skill):
            disallowed = {"description", "tags", "visibility"}
            if any(key in fields for key in disallowed):
                raise SkillError(SkillErrorCode.REFERENCE_SKILL_READ_ONLY)
        visibility = fields.get("visibility")
        if visibility is not None:
            normalized = str(visibility).strip().lower()
            if normalized not in {"private", "team", "enterprise"}:
                raise SkillError(SkillErrorCode.INVALID_VISIBILITY)
            fields["visibility"] = normalized
        new_name = fields.get("name")
        if new_name is None:
            fields.pop("name", None)
        elif new_name != skill.name:
            valid, error = validate_skill_name(new_name)
            if not valid:
                raise SkillError(SkillErrorCode.INVALID_SKILL_NAME, error)
            existing = await self.skill_repo.get_by_name(user.id, new_name)
            if existing and existing.id != skill.id:
                raise SkillError(SkillErrorCode.SKILL_ALREADY_EXISTS)
            if not self.is_reference_skill(skill):
                old_dir = get_user_skill_dir(user.id, skill.name)
                new_dir = get_user_skill_dir(user.id, new_name)
                if old_dir.exists():
                    new_dir.parent.mkdir(parents=True, exist_ok=True)
                    old_dir.rename(new_dir)
                else:
                    new_dir.mkdir(parents=True, exist_ok=True)
                rename_archives_for_skill(user.id, skill.name, new_name)
                fields["skill_dir"] = str(new_dir)
        return await self.skill_repo.update(skill, **fields)

    async def deactivate_skill(self, user: User, skill_id: str) -> Skill:
        skill = await self.get_skill(user, skill_id)
        self.ensure_owner(user, skill)
        self.ensure_not_reference(skill)
        now = datetime.now(timezone.utc).replace(microsecond=0)
        return await self.skill_repo.update(skill, is_active=False, cache_revoked_at=now)

    async def activate_skill(self, user: User, skill_id: str) -> Skill:
        skill = await self.get_skill(user, skill_id)
        self.ensure_owner(user, skill)
        self.ensure_not_reference(skill)
        return await self.skill_repo.update(skill, is_active=True, cache_revoked_at=None)

    async def delete_skill(self, user: User, skill_id: str, delete_archives: bool = False) -> bool:
        logger.info(f"[DELETE_SKILL] user_id={user.id}, skill_id={skill_id}, delete_archives={delete_archives}")
        skill = await self.get_skill(user, skill_id)
        logger.debug(f"[DELETE_SKILL] Found skill: name={skill.name}, id={skill.id}")
        self.ensure_owner(user, skill)
        if self.is_reference_skill(skill):
            await self.skill_repo.delete(skill)
            logger.info(f"[DELETE_SKILL] Deleted reference skill, skill_name={skill.name}")
            return True
        await self.skill_repo.delete(skill)
        delete_skill_dir(user.id, skill.name)
        if delete_archives:
            delete_archives_for_skill(user.id, skill.name)
        logger.info(f"[DELETE_SKILL] Success, skill_name={skill.name}")
        return True

    @staticmethod
    def ensure_active(skill: Skill) -> None:
        if not skill.is_active:
            raise SkillError(SkillErrorCode.SKILL_DEACTIVATED)

    @staticmethod
    def ensure_owner(user: User, skill: Skill) -> None:
        if skill.user_id != user.id:
            raise SkillError(SkillErrorCode.SKILL_NOT_FOUND)

    @staticmethod
    def storage_owner_id(skill: Skill) -> str:
        return str(skill.user_id)

    async def list_public_skills(self, skip: int = 0, limit: int = 100, query: str | None = None) -> list[Skill]:
        self.assert_public_features_enabled()
        return await self.skill_repo.list_public(skip=skip, limit=limit, query=query)

    async def count_public_skills(self, query: str | None = None) -> int:
        self.assert_public_features_enabled()
        return await self.skill_repo.count_public(query=query)

    async def get_public_skill(self, skill_id: str) -> Skill:
        return await self._get_active_public_skill(skill_id)

    async def get_public_source_skill(self, skill_id: str) -> Skill:
        return await self._get_active_public_skill(skill_id)

    async def _get_active_public_skill(self, skill_id: str) -> Skill:
        self.assert_public_features_enabled()
        skill = await self.skill_repo.get_public_by_id(skill_id)
        if not skill or not skill.is_active:
            raise SkillError(SkillErrorCode.SKILL_NOT_FOUND)
        return skill
