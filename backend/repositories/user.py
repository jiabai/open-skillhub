from typing import Any

from sqlalchemy import select

from backend.core.security.password import get_password_hash
from backend.models.user import User
from backend.repositories.base import BaseRepository


class UserRepository(BaseRepository):
    async def get_by_id(self, user_id: str) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        result = await self.session.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def list_users(
        self,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
    ) -> list[User]:
        stmt = select(User).order_by(User.created_at.desc())
        if query:
            stmt = stmt.where(
                (User.email.ilike(f"%{query}%")) | (User.username.ilike(f"%{query}%"))
            )
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_users(self, query: str | None = None) -> int:
        from sqlalchemy import func

        stmt = select(func.count(User.id))
        if query:
            stmt = stmt.where(
                (User.email.ilike(f"%{query}%")) | (User.username.ilike(f"%{query}%"))
            )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def create(self, model: Any = User, **data: Any) -> User:
        password = data.pop("password")
        user = User(
            email=data["email"],
            username=data["username"],
            hashed_password=get_password_hash(password),
            enterprise_id=data.get("enterprise_id"),
            team_id=data.get("team_id"),
            role=data.get("role") or "member",
            status=data.get("status") or "active",
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update(self, db_obj: Any, **data: Any) -> User:
        for key, value in data.items():
            setattr(db_obj, key, value)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete(self, db_obj: User) -> None:
        await self.session.delete(db_obj)
        await self.session.commit()
