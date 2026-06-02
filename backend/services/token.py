from datetime import datetime, timezone

from loguru import logger

from backend.core.middleware.logging import safe_log_context
from backend.core.security.token import generate_api_token, hash_token
from backend.models.token import APIToken
from backend.models.user import User
from backend.repositories.token import TokenRepository
from backend.repositories.user import UserRepository


class TokenService:
    def __init__(self, token_repo: TokenRepository, user_repo: UserRepository):
        self.token_repo = token_repo
        self.user_repo = user_repo

    async def create_token(
        self, user: User, name: str, expires_at: datetime | None = None
    ) -> APIToken:
        token_value = generate_api_token()
        token_hash = hash_token(token_value)
        logger.bind(
            **safe_log_context(
                user_id=str(user.id),
                token_name=name,
                expires_at=expires_at.isoformat() if expires_at else None,
            )
        ).debug("Creating API token")
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
        logger.bind(
            **safe_log_context(
                user_id=str(user.id),
                token_name=name,
                expires_at=expires_at.isoformat() if expires_at else None,
            )
        ).debug("Creating API token with returned value")
        token = await self.token_repo.create(
            user_id=user.id,
            name=name,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        return token, token_value

    async def list_tokens(self, user: User) -> list[APIToken]:
        logger.bind(**safe_log_context(user_id=str(user.id))).debug(
            "Listing API tokens"
        )
        return await self.token_repo.list_by_user(user.id)

    async def revoke_token(self, user: User, token_id: str) -> bool:
        token = await self.token_repo.get_by_id(token_id)
        if not token or token.user_id != user.id:
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id), token_id=token_id, token_found=bool(token)
                )
            ).debug("API token revoke failed because token was not found for user")
            raise ValueError("Token not found")
        logger.bind(
            **safe_log_context(user_id=str(user.id), token_id=str(token.id))
        ).debug("Revoking API token")
        await self.token_repo.revoke(token)
        return True

    async def validate_token(self, token_value: str) -> APIToken:
        token_hash = hash_token(token_value)
        token = await self.token_repo.get_by_hash(token_hash)
        if not token:
            logger.debug("API token hash lookup failed")
            raise ValueError("Token not found")
        if not token.is_active:
            logger.bind(
                **safe_log_context(token_id=str(token.id), user_id=str(token.user_id))
            ).debug("API token rejected because it is inactive")
            raise ValueError("Token revoked")
        if token.expires_at:
            expires_at = token.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= datetime.now(timezone.utc):
                logger.bind(
                    **safe_log_context(
                        token_id=str(token.id),
                        user_id=str(token.user_id),
                        expires_at=expires_at.isoformat(),
                    )
                ).debug("API token rejected because it expired")
                raise ValueError("Token expired")
        logger.bind(
            **safe_log_context(token_id=str(token.id), user_id=str(token.user_id))
        ).debug("API token validated")
        await self.token_repo.mark_used(token)
        return token
