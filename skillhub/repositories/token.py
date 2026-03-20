from datetime import datetime, timezone

from typing import Any

from sqlalchemy import func, or_, select

from skillhub.models.token import APIToken
from skillhub.repositories.base import BaseRepository


class TokenRepository(BaseRepository):
    async def get_by_id(self, token_id: str) -> APIToken | None:
        result = await self.session.execute(select(APIToken).where(APIToken.id == token_id))
        return result.scalar_one_or_none()

    async def get_by_hash(self, token_hash: str) -> APIToken | None:
        result = await self.session.execute(select(APIToken).where(APIToken.token_hash == token_hash))
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: str, skip: int = 0, limit: int = 100) -> list[APIToken]:
        result = await self.session.execute(
            select(APIToken).where(APIToken.user_id == user_id).offset(skip).limit(limit),
        )
        return list(result.scalars().all())

    async def count_by_user(self, user_id: str) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(APIToken).where(APIToken.user_id == user_id),
        )
        return int(result.scalar_one())

    async def count_available_by_user(self, user_id: str, now: datetime) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(APIToken)
            .where(
                APIToken.user_id == user_id,
                APIToken.is_active.is_(True),
                or_(APIToken.expires_at.is_(None), APIToken.expires_at > now),
            ),
        )
        return int(result.scalar_one())

    async def create(self, model: Any = APIToken, **data: Any) -> APIToken:
        token = APIToken(**data)
        self.session.add(token)
        await self.session.commit()
        await self.session.refresh(token)
        return token

    async def mark_used(self, token: APIToken) -> APIToken:
        token.last_used_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(token)
        return token

    async def revoke(self, token: APIToken) -> APIToken:
        token.is_active = False
        await self.session.commit()
        await self.session.refresh(token)
        return token
