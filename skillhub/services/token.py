from datetime import datetime, timezone

from skillhub.core.security.token import generate_api_token, hash_token
from skillhub.models.token import APIToken
from skillhub.models.user import User
from skillhub.repositories.token import TokenRepository
from skillhub.repositories.user import UserRepository


class TokenService:
    def __init__(self, token_repo: TokenRepository, user_repo: UserRepository):
        self.token_repo = token_repo
        self.user_repo = user_repo

    async def create_token(self, user: User, name: str, expires_at: datetime | None = None) -> APIToken:
        token_value = generate_api_token()
        token_hash = hash_token(token_value)
        return await self.token_repo.create(
            user_id=user.id,
            name=name,
            token_hash=token_hash,
            expires_at=expires_at,
        )

    async def create_token_with_value(
        self,
        user: User,
        name: str,
        expires_at: datetime | None = None,
    ) -> tuple[APIToken, str]:
        token_value = generate_api_token()
        token_hash = hash_token(token_value)
        token = await self.token_repo.create(
            user_id=user.id,
            name=name,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        return token, token_value

    async def list_tokens(self, user: User) -> list[APIToken]:
        return await self.token_repo.list_by_user(user.id)

    async def revoke_token(self, user: User, token_id: str) -> bool:
        token = await self.token_repo.get_by_id(token_id)
        if not token or token.user_id != user.id:
            raise ValueError("Token not found")
        await self.token_repo.revoke(token)
        return True

    async def validate_token(self, token_value: str) -> APIToken:
        token_hash = hash_token(token_value)
        token = await self.token_repo.get_by_hash(token_hash)
        if not token:
            raise ValueError("Token not found")
        if not token.is_active:
            raise ValueError("Token revoked")
        if token.expires_at:
            expires_at = token.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= datetime.now(timezone.utc):
                raise ValueError("Token expired")
        await self.token_repo.mark_used(token)
        return token
