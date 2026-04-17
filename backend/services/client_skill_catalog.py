from backend.config.settings import settings
from backend.core.security.rbac import has_permission
from backend.schemas.client_skill import ClientSkillListResponse, ClientSkillSummaryResponse
from backend.schemas.skill import SkillBaseResponse
from backend.schemas.skill_version import SkillVersionResponse
from backend.services.skill import SkillService


class ClientSkillCatalogService:
    def __init__(self, skill_service: SkillService):
        if skill_service.version_repo is None:
            raise ValueError("Version repository not configured")
        self.skill_service = skill_service
        self.version_repo = skill_service.version_repo

    async def list_client_skills(
        self,
        user,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
    ) -> ClientSkillListResponse:
        skills = await self.skill_service.list_skills(
            user,
            skip=skip,
            limit=limit,
            query=query,
        )
        total = await self.skill_service.skill_repo.count_visible(
            user.id,
            user.enterprise_id,
            user.team_id,
            query=query,
        )
        items = [await self._build_summary(user, skill) for skill in skills]
        return ClientSkillListResponse(items=items, total=total)

    async def _build_summary(self, user, skill) -> ClientSkillSummaryResponse:
        payload = SkillBaseResponse.model_validate(skill).model_dump(by_alias=True)
        resolved_version = await self.skill_service.resolved_version_for_skill(skill)
        latest_version = None
        if resolved_version:
            lookup_skill_id = skill.source_skill_id or skill.id
            version_record = await self.version_repo.get_by_version(lookup_skill_id, resolved_version)
            if version_record:
                latest_version = SkillVersionResponse.model_validate(version_record)
        payload["resolved_version"] = resolved_version
        payload["skill_kind"] = await self.skill_service.skill_kind(skill)
        payload["is_reference_read_only"] = self.skill_service.is_reference_skill(skill)
        payload["is_downloadable"] = self._is_downloadable(user, skill)
        payload["latest_version"] = latest_version
        return ClientSkillSummaryResponse.model_validate(payload)

    def _is_downloadable(self, user, skill) -> bool:
        if (skill.visibility or "").strip().lower() == "public":
            return False
        if settings.ENABLE_RBAC:
            return has_permission(user, "skill.download")
        return skill.user_id == user.id
