from sqlalchemy import select

from backend.models.enterprise import Enterprise
from backend.repositories.base import BaseRepository


class EnterpriseRepository(BaseRepository):
    async def get_by_external_id(self, external_id: str) -> Enterprise | None:
        result = await self.session.execute(
            select(Enterprise).where(Enterprise.external_id == external_id),
        )
        return result.scalar_one_or_none()

    async def create(self, model: object = Enterprise, **data) -> Enterprise:
        enterprise = Enterprise(**data)
        self.session.add(enterprise)
        await self.session.commit()
        await self.session.refresh(enterprise)
        return enterprise
