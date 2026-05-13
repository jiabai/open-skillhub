from datetime import datetime, timezone
import hashlib
import hmac

from sqlalchemy import select

from backend.config.settings import settings
from backend.models.refresh_token import RefreshTokenSession
from backend.repositories.base import BaseRepository


REFRESH_TOKEN_STATUS_ACTIVE = "active"
REFRESH_TOKEN_STATUS_USED = "used"
REFRESH_TOKEN_STATUS_REVOKED = "revoked"
REFRESH_TOKEN_STATUS_COMPROMISED = "compromised"


class RefreshTokenRepository(BaseRepository):
    @staticmethod
    def hash_token(raw_token: str) -> str:
        return hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            raw_token.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    async def get_by_token_hash(self, token_hash: str) -> RefreshTokenSession | None:
        stmt = (
            select(RefreshTokenSession)
            .where(RefreshTokenSession.token_hash == token_hash)
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_session(
        self,
        *,
        user_id: str,
        family_id: str,
        jti: str,
        token_hash: str,
        expires_at: datetime,
    ) -> RefreshTokenSession:
        session = RefreshTokenSession(
            user_id=user_id,
            family_id=family_id,
            jti=jti,
            token_hash=token_hash,
            status=REFRESH_TOKEN_STATUS_ACTIVE,
            expires_at=expires_at,
        )
        self.session.add(session)
        await self.session.flush()
        return session

    async def mark_used(self, token: RefreshTokenSession, *, replaced_by_jti: str) -> RefreshTokenSession:
        token.status = REFRESH_TOKEN_STATUS_USED
        token.used_at = datetime.now(timezone.utc)
        token.replaced_by_jti = replaced_by_jti
        await self.session.flush()
        return token

    async def revoke_family(
        self,
        *,
        user_id: str,
        family_id: str,
        status: str = REFRESH_TOKEN_STATUS_COMPROMISED,
    ) -> None:
        now = datetime.now(timezone.utc)
        result = await self.session.execute(
            select(RefreshTokenSession).where(
                RefreshTokenSession.user_id == user_id,
                RefreshTokenSession.family_id == family_id,
            )
        )
        for token in result.scalars().all():
            token.status = status
            token.revoked_at = token.revoked_at or now
        await self.session.flush()

    async def revoke_user_sessions(self, user_id: str) -> None:
        now = datetime.now(timezone.utc)
        result = await self.session.execute(
            select(RefreshTokenSession).where(
                RefreshTokenSession.user_id == user_id,
                RefreshTokenSession.status != REFRESH_TOKEN_STATUS_REVOKED,
            )
        )
        for token in result.scalars().all():
            token.status = REFRESH_TOKEN_STATUS_REVOKED
            token.revoked_at = token.revoked_at or now
        await self.session.flush()
