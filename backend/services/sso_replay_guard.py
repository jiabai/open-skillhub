from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.settings import settings
from backend.models.sso_nonce import SSONonce
from backend.models.sso_replay_token import SSOReplayToken


class SSOReplayGuardService:
    def __init__(self, session: AsyncSession):
        self._session = session

    def _now(self) -> datetime:
        return datetime.now(timezone.utc).replace(microsecond=0)

    def _hash(self, value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    async def issue_nonce(self) -> tuple[str, int]:
        now = self._now()
        expires_in = int(settings.SSO_NONCE_EXPIRE_SECONDS or 300)
        nonce = secrets.token_urlsafe(32)
        self._session.add(
            SSONonce(
                nonce_hash=self._hash(nonce),
                purpose="sso_login",
                expires_at=now + timedelta(seconds=expires_in),
            ),
        )
        await self._session.commit()
        return nonce, expires_in

    async def consume_nonce(self, nonce: str) -> None:
        now = self._now()
        nonce_hash = self._hash(nonce)
        await self._session.execute(
            delete(SSONonce).where(SSONonce.expires_at <= now, SSONonce.used_at.is_(None)),
        )
        result = await self._session.execute(
            update(SSONonce)
            .where(
                SSONonce.nonce_hash == nonce_hash,
                SSONonce.purpose == "sso_login",
                SSONonce.used_at.is_(None),
                SSONonce.expires_at > now,
            )
            .values(used_at=now),
        )
        if (result.rowcount or 0) == 1:
            await self._session.commit()
            return

        existing = await self._session.execute(select(SSONonce).where(SSONonce.nonce_hash == nonce_hash))
        record = existing.scalar_one_or_none()
        await self._session.rollback()
        if not record:
            raise ValueError("SSO_NONCE_INVALID")
        if record.used_at is not None:
            raise ValueError("SSO_NONCE_REPLAYED")
        raise ValueError("SSO_NONCE_EXPIRED")

    async def mark_token_used(self, replay_key: str, expires_at: datetime) -> None:
        now = self._now()
        replay_key_hash = self._hash(replay_key)
        await self._session.execute(delete(SSOReplayToken).where(SSOReplayToken.expires_at <= now))
        existing = await self._session.execute(
            select(SSOReplayToken).where(SSOReplayToken.replay_key_hash == replay_key_hash),
        )
        record = existing.scalar_one_or_none()
        if record:
            await self._session.rollback()
            raise ValueError("SSO_TOKEN_REPLAYED")
        self._session.add(
            SSOReplayToken(
                replay_key_hash=replay_key_hash,
                purpose="sso_login",
                expires_at=expires_at,
            ),
        )
        await self._session.commit()
