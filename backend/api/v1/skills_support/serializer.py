from backend.schemas.skill import PublicSkillListItem, PublicSkillResponse, SkillConsoleResponse
from backend.services.skill import SkillService


async def serialize_skill(service: SkillService, skill) -> SkillConsoleResponse:
    payload = SkillConsoleResponse.model_validate(skill).model_dump(by_alias=True)
    payload["resolved_version"] = await service.resolved_version_for_skill(skill)
    payload["skill_kind"] = await service.skill_kind(skill)
    payload["is_reference_read_only"] = service.is_reference_skill(skill)
    return SkillConsoleResponse.model_validate(payload)


async def serialize_public_skill(
    service: SkillService,
    skill,
    reference_source_ids: set[str] | None = None,
    clone_source_ids: set[str] | None = None,
) -> PublicSkillListItem:
    payload = PublicSkillResponse.model_validate(skill).model_dump(by_alias=True)
    payload["resolved_version"] = await service.resolved_version_for_skill(skill)
    payload["skill_kind"] = "public"
    payload["has_reference"] = False
    payload["has_clone"] = False
    if reference_source_ids is not None:
        payload["has_reference"] = skill.id in reference_source_ids
    if clone_source_ids is not None:
        payload["has_clone"] = skill.id in clone_source_ids
    return PublicSkillListItem.model_validate(payload)
