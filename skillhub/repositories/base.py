from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


class BaseRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, model, obj_id: str):
        result = await self.session.execute(select(model).where(model.id == obj_id))
        return result.scalar_one_or_none()

    async def get_multi(self, model, skip: int = 0, limit: int = 100):
        result = await self.session.execute(select(model).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def count(self, model) -> int:
        result = await self.session.execute(select(func.count()).select_from(model))
        return int(result.scalar_one())

    async def create(self, model, **data):
        obj = model(**data)
        self.session.add(obj)
        await self.session.commit()
        await self.session.refresh(obj)
        return obj

    async def update(self, db_obj, **data):
        for key, value in data.items():
            setattr(db_obj, key, value)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete(self, db_obj) -> None:
        await self.session.delete(db_obj)
        await self.session.commit()
