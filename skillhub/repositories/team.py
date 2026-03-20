from sqlalchemy import select

from skillhub.models.team import Team
from skillhub.repositories.base import BaseRepository


class TeamRepository(BaseRepository):
    async def get_by_external_id(self, external_id: str) -> Team | None:
        result = await self.session.execute(select(Team).where(Team.external_id == external_id))
        return result.scalar_one_or_none()

    async def create(self, model: object = Team, **data) -> Team:
        team = Team(**data)
        self.session.add(team)
        await self.session.commit()
        await self.session.refresh(team)
        return team
