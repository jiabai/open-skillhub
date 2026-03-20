from sqlalchemy import select

from skillhub.models.skill_version import SkillVersion
from skillhub.repositories.base import BaseRepository


class SkillVersionRepository(BaseRepository):
    async def list_by_skill(self, skill_id: str) -> list[SkillVersion]:
        result = await self.session.execute(
            select(SkillVersion)
            .where(SkillVersion.skill_id == skill_id)
            .order_by(SkillVersion.created_at.desc(), SkillVersion.version.desc()),
        )
        return list(result.scalars().all())

    async def get_by_version(self, skill_id: str, version: str) -> SkillVersion | None:
        result = await self.session.execute(
            select(SkillVersion).where(
                SkillVersion.skill_id == skill_id,
                SkillVersion.version == version,
            )
        )
        return result.scalar_one_or_none()

    async def create_version(
        self,
        skill_id: str,
        version: str,
        description: str,
        dependencies: list[str],
        dependency_spec: dict,
        dependency_spec_version: str | None,
        metadata: dict,
    ) -> SkillVersion:
        record = SkillVersion(
            skill_id=skill_id,
            version=version,
            description=description,
            dependencies=dependencies,
            dependency_spec=dependency_spec,
            dependency_spec_version=dependency_spec_version,
            metadata_json=metadata,
        )
        self.session.add(record)
        await self.session.commit()
        await self.session.refresh(record)
        return record
