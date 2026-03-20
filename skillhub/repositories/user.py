from typing import Any

from sqlalchemy import select

from skillhub.core.security.password import get_password_hash
from skillhub.models.user import User
from skillhub.repositories.base import BaseRepository


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
