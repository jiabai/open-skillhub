from typing import Any

from sqlalchemy import String, and_, cast, func, or_, select

from skillhub.config.settings import settings
from skillhub.models.skill import Skill
from skillhub.repositories.base import BaseRepository


class SkillRepository(BaseRepository):
    async def get_by_id(self, skill_id: str) -> Skill | None:
        result = await self.session.execute(select(Skill).where(Skill.id == skill_id))
        return result.scalar_one_or_none()

    async def get_by_name(self, user_id: str, name: str) -> Skill | None:
        result = await self.session.execute(
            select(Skill).where(Skill.user_id == user_id, Skill.name == name),
        )
        return result.scalar_one_or_none()

    async def list_by_user(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
        include_inactive: bool = False,
    ) -> list[Skill]:
        stmt = select(Skill).where(Skill.user_id == user_id)
        if not include_inactive:
            stmt = stmt.where(Skill.is_active.is_(True))
        if query:
            pattern = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Skill.name.ilike(pattern),
                    Skill.description.ilike(pattern),
                    cast(Skill.tags, String).ilike(pattern),
                )
            )
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_user(self, user_id: str, query: str | None = None, include_inactive: bool = False) -> int:
        stmt = select(func.count()).select_from(Skill).where(Skill.user_id == user_id)
        if not include_inactive:
            stmt = stmt.where(Skill.is_active.is_(True))
        if query:
            pattern = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Skill.name.ilike(pattern),
                    Skill.description.ilike(pattern),
                    cast(Skill.tags, String).ilike(pattern),
                )
            )
        result = await self.session.execute(stmt)
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
        if not include_inactive:
            stmt = stmt.where(Skill.is_active.is_(True))
        visibility_filters = [Skill.user_id == user_id]
        if enterprise_id:
            visibility_filters.append(
                and_(Skill.visibility == "enterprise", Skill.enterprise_id == enterprise_id),
            )
            if team_id:
                visibility_filters.append(
                    and_(
                        Skill.visibility == "team",
                        Skill.enterprise_id == enterprise_id,
                        Skill.team_id == team_id,
                    ),
                )
        stmt = stmt.where(or_(*visibility_filters))
        if query:
            pattern = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Skill.name.ilike(pattern),
                    Skill.description.ilike(pattern),
                    cast(Skill.tags, String).ilike(pattern),
                )
            )
        stmt = stmt.offset(skip).limit(limit)
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
        if not include_inactive:
            stmt = stmt.where(Skill.is_active.is_(True))
        visibility_filters = [Skill.user_id == user_id]
        if enterprise_id:
            visibility_filters.append(
                and_(Skill.visibility == "enterprise", Skill.enterprise_id == enterprise_id),
            )
            if team_id:
                visibility_filters.append(
                    and_(
                        Skill.visibility == "team",
                        Skill.enterprise_id == enterprise_id,
                        Skill.team_id == team_id,
                    ),
                )
        stmt = stmt.where(or_(*visibility_filters))
        if query:
            pattern = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Skill.name.ilike(pattern),
                    Skill.description.ilike(pattern),
                    cast(Skill.tags, String).ilike(pattern),
                )
            )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def create(self, model: Any = Skill, **data: Any) -> Skill:
        skill = Skill(**data)
        self.session.add(skill)
        await self.session.commit()
        await self.session.refresh(skill)
        return skill

    async def update(self, db_obj: Any, **data: Any) -> Skill:
        for key, value in data.items():
            setattr(db_obj, key, value)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete(self, db_obj: Skill) -> None:
        await self.session.delete(db_obj)
        await self.session.commit()
