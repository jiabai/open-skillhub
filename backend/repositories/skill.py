from typing import Any

from sqlalchemy import String, and_, cast, func, or_, select

from backend.config.settings import settings
from backend.models.skill import Skill
from backend.models.skill_version import SkillVersion
from backend.repositories.base import BaseRepository


class SkillRepository(BaseRepository):
    @staticmethod
    def _normalize_skill_ids(values: list[Any]) -> set[str]:
        return {value for value in values if isinstance(value, str) and value.strip()}

    @staticmethod
    def _query_filter(query: str | None):
        if not query:
            return None
        pattern = f"%{query}%"
        return or_(
            Skill.name.ilike(pattern),
            Skill.description.ilike(pattern),
            cast(Skill.tags, String).ilike(pattern),
        )

    @staticmethod
    def _visibility_filter(
        user_id: str,
        enterprise_id: str | None,
        team_id: str | None,
    ):
        filters = [Skill.user_id == user_id]
        if not settings.ENABLE_RBAC:
            filters.append(Skill.visibility == "public")
        if enterprise_id:
            filters.append(and_(Skill.visibility == "enterprise", Skill.enterprise_id == enterprise_id))
            if team_id:
                filters.append(
                    and_(
                        Skill.visibility == "team",
                        Skill.enterprise_id == enterprise_id,
                        Skill.team_id == team_id,
                    )
                )
        return or_(*filters)

    @staticmethod
    def _apply_active_filter(stmt, include_inactive: bool):
        if include_inactive:
            return stmt
        return stmt.where(Skill.is_active.is_(True))

    @classmethod
    def _apply_query_filter(cls, stmt, query: str | None):
        query_filter = cls._query_filter(query)
        if query_filter is None:
            return stmt
        return stmt.where(query_filter)

    @classmethod
    def _apply_pagination(cls, stmt, skip: int, limit: int):
        return stmt.offset(skip).limit(limit)

    async def get_by_id(self, skill_id: str) -> Skill | None:
        result = await self.session.execute(select(Skill).where(Skill.id == skill_id))
        return result.scalar_one_or_none()

    async def get_by_name(self, user_id: str, name: str) -> Skill | None:
        result = await self.session.execute(
            select(Skill).where(Skill.user_id == user_id, Skill.name == name),
        )
        return result.scalar_one_or_none()

    async def get_public_by_id(self, skill_id: str) -> Skill | None:
        result = await self.session.execute(
            select(Skill).where(
                Skill.id == skill_id,
                Skill.visibility == "public",
            ),
        )
        return result.scalar_one_or_none()

    async def list_public(
        self,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
    ) -> list[Skill]:
        stmt = select(Skill).where(
            Skill.visibility == "public",
            Skill.is_active.is_(True),
        )
        stmt = self._apply_query_filter(stmt, query)
        stmt = self._apply_pagination(stmt, skip, limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_public(self, query: str | None = None) -> int:
        stmt = select(func.count()).select_from(Skill).where(
            Skill.visibility == "public",
            Skill.is_active.is_(True),
        )
        result = await self.session.execute(self._apply_query_filter(stmt, query))
        return int(result.scalar_one())

    async def get_reference_by_source(self, user_id: str, source_skill_id: str) -> Skill | None:
        result = await self.session.execute(
            select(Skill).where(
                Skill.user_id == user_id,
                Skill.source_skill_id == source_skill_id,
            ).limit(1)
        )
        return result.scalars().first()

    async def list_reference_source_ids(self, user_id: str) -> set[str]:
        result = await self.session.execute(
            select(Skill.source_skill_id).where(
                Skill.user_id == user_id,
                Skill.source_skill_id.is_not(None),
            )
        )
        return self._normalize_skill_ids(result.scalars().all())

    async def _list_cloned_source_ids_from_field(self, user_id: str) -> set[str]:
        result = await self.session.execute(
            select(Skill.cloned_from_skill_id).where(
                Skill.user_id == user_id,
            )
        )
        return self._normalize_skill_ids(result.scalars().all())

    async def _list_cloned_source_ids_legacy_fallback(self, user_id: str) -> set[str]:
        # Historical clone records only stored origin metadata on the first
        # skill version, so we keep this explicit fallback until those records
        # no longer need to be recognized.
        legacy_result = await self.session.execute(
            select(SkillVersion.metadata_json)
            .join(Skill, Skill.id == SkillVersion.skill_id)
            .where(Skill.user_id == user_id)
        )
        clone_ids: set[str] = set()
        for metadata in legacy_result.scalars().all():
            if not isinstance(metadata, dict):
                continue
            clone_ids.update(self._normalize_skill_ids([metadata.get("cloned_from_skill_id")]))
        return clone_ids

    async def list_cloned_source_ids(self, user_id: str) -> set[str]:
        clone_ids = await self._list_cloned_source_ids_from_field(user_id)
        if clone_ids:
            return clone_ids
        return await self._list_cloned_source_ids_legacy_fallback(user_id)

    async def list_by_user(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
        include_inactive: bool = False,
    ) -> list[Skill]:
        stmt = select(Skill).where(Skill.user_id == user_id)
        stmt = self._apply_active_filter(stmt, include_inactive)
        stmt = self._apply_query_filter(stmt, query)
        stmt = self._apply_pagination(stmt, skip, limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_user(self, user_id: str, query: str | None = None, include_inactive: bool = False) -> int:
        stmt = select(func.count()).select_from(Skill).where(Skill.user_id == user_id)
        stmt = self._apply_active_filter(stmt, include_inactive)
        result = await self.session.execute(self._apply_query_filter(stmt, query))
        return int(result.scalar_one())

    async def count_active_by_user(self, user_id: str) -> int:
        stmt = (
            select(func.count())
            .select_from(Skill)
            .where(Skill.user_id == user_id, Skill.is_active.is_(True))
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def list_visible(
        self,
        user_id: str,
        enterprise_id: str | None,
        team_id: str | None,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
        include_inactive: bool = False,
    ) -> list[Skill]:
        if not settings.ENABLE_SKILL_VISIBILITY:
            return await self.list_by_user(
                user_id,
                skip=skip,
                limit=limit,
                query=query,
                include_inactive=include_inactive,
            )
        stmt = select(Skill)
        stmt = self._apply_active_filter(stmt, include_inactive)
        stmt = stmt.where(self._visibility_filter(user_id, enterprise_id, team_id))
        stmt = self._apply_query_filter(stmt, query)
        stmt = self._apply_pagination(stmt, skip, limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_visible(
        self,
        user_id: str,
        enterprise_id: str | None,
        team_id: str | None,
        query: str | None = None,
        include_inactive: bool = False,
    ) -> int:
        if not settings.ENABLE_SKILL_VISIBILITY:
            return await self.count_by_user(user_id, query=query, include_inactive=include_inactive)
        stmt = select(func.count()).select_from(Skill)
        stmt = self._apply_active_filter(stmt, include_inactive)
        stmt = stmt.where(self._visibility_filter(user_id, enterprise_id, team_id))
        result = await self.session.execute(self._apply_query_filter(stmt, query))
        return int(result.scalar_one())

    async def create(self, model: Any = Skill, commit: bool = True, **data: Any) -> Skill:
        skill = Skill(**data)
        self.session.add(skill)
        await self.session.flush()
        if commit:
            await self.session.commit()
        await self.session.refresh(skill)
        return skill

    async def update(self, db_obj: Any, commit: bool = True, **data: Any) -> Skill:
        for key, value in data.items():
            setattr(db_obj, key, value)
        await self.session.flush()
        if commit:
            await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete(self, db_obj: Skill, commit: bool = True) -> None:
        await self.session.delete(db_obj)
        await self.session.flush()
        if commit:
            await self.session.commit()
