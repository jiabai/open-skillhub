from __future__ import annotations

import asyncio
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Literal

from loguru import logger
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.settings import settings
from backend.db.session import get_async_session
from backend.models.email_delivery_log import EmailDeliveryLog
from backend.models.verification_code import VerificationCode
from backend.services.email_sender import EmailSender, get_email_sender


Purpose = Literal["login", "register", "bind_email", "delete_account"]


@dataclass
class CodeRecord:
    code: str
    expires_at: datetime
    resend_available_at: datetime
    max_attempts: int
    attempts_left: int


class VerificationCodeService:
    def __init__(
        self,
        session: AsyncSession,
        code_length: int = 6,
        expires_in: int = 300,
        resend_interval: int = 60,
        max_attempts: int = 5,
        email_sender: EmailSender | None = None,
    ):
        self._session = session
        self._code_length = code_length
        self._expires_in = expires_in
        self._resend_interval = resend_interval
        self._max_attempts = max_attempts
        self._email_sender = email_sender

    def _now(self) -> datetime:
        return datetime.now(timezone.utc).replace(microsecond=0)

    def _normalize(self, email: str) -> str:
        return email.strip().lower()

    def _generate_code(self) -> str:
        upper = 10**self._code_length
        return str(secrets.randbelow(upper)).zfill(self._code_length)

    def _hash_code(self, code: str) -> str:
        return hashlib.sha256(code.encode("utf-8")).hexdigest()

    def _ensure_aware(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    async def _get_record(self, email: str, purpose: Purpose) -> VerificationCode | None:
        result = await self._session.execute(
            select(VerificationCode).where(VerificationCode.email == email, VerificationCode.purpose == purpose),
        )
        return result.scalar_one_or_none()

    async def _log_delivery(
        self,
        email: str,
        purpose: Purpose,
        channel: str,
        status: str,
        attempts: int,
        error_message: str | None,
        use_external_session: bool,
    ) -> None:
        if use_external_session:
            async for session in get_async_session():
                session.add(
                    EmailDeliveryLog(
                        email=email,
                        purpose=purpose,
                        channel=channel,
                        status=status,
                        attempts=attempts,
                        error_message=error_message,
                    ),
                )
                await session.commit()
                return
        self._session.add(
            EmailDeliveryLog(
                email=email,
                purpose=purpose,
                channel=channel,
                status=status,
                attempts=attempts,
                error_message=error_message,
            ),
        )
        await self._session.commit()

    async def _deliver_code(
        self,
        email: str,
        purpose: Purpose,
        record: CodeRecord,
        use_external_session: bool,
    ) -> None:
        sender = self._email_sender or get_email_sender()
        channel = "smtp" if sender.__class__.__name__ == "SmtpEmailSender" else "aliyun"
        retries = 3
        last_error = None
        for attempt in range(1, retries + 1):
            try:
                await asyncio.to_thread(
                    sender.send_verification_code,
                    email,
                    record.code,
                    self._expires_in,
                    self._resend_interval,
                    purpose,
                )
                await self._log_delivery(email, purpose, channel, "sent", attempt, None, use_external_session)
                return
            except Exception as exc:
                last_error = str(exc)
                if attempt < retries:
                    await asyncio.sleep(0.5 * attempt)
        await self._log_delivery(email, purpose, channel, "failed", retries, last_error, use_external_session)
        logger.error(f"Email delivery failed: {email} purpose={purpose} error={last_error}")

    async def send_code(
        self,
        email: str,
        purpose: Purpose,
        schedule: Callable[..., None] | None = None,
    ) -> dict:
        normalized = self._normalize(email)
        now = self._now()
        existing = await self._get_record(normalized, purpose)
        if existing and now < self._ensure_aware(existing.resend_available_at):
            raise ValueError("RESEND_TOO_FREQUENT")
        record = CodeRecord(
            code=self._generate_code(),
            expires_at=now + timedelta(seconds=self._expires_in),
            resend_available_at=now + timedelta(seconds=self._resend_interval),
            max_attempts=self._max_attempts,
            attempts_left=self._max_attempts,
        )
        code_hash = self._hash_code(record.code)
        if existing:
            existing.code_hash = code_hash
            existing.expires_at = record.expires_at
            existing.resend_available_at = record.resend_available_at
            existing.max_attempts = record.max_attempts
            existing.attempts_left = record.attempts_left
        else:
            self._session.add(
                VerificationCode(
                    email=normalized,
                    purpose=purpose,
                    code_hash=code_hash,
                    expires_at=record.expires_at,
                    resend_available_at=record.resend_available_at,
                    max_attempts=record.max_attempts,
                    attempts_left=record.attempts_left,
                ),
            )
        await self._session.commit()
        if schedule:
            schedule(self._deliver_code, email, purpose, record, True)
        else:
            await self._deliver_code(email, purpose, record, False)
        return {
            "sent": True,
            "expires_in": self._expires_in,
            "resend_interval": self._resend_interval,
            "max_attempts": record.max_attempts,
            "attempts_left": record.attempts_left,
        }

    async def verify_code(self, email: str, purpose: Purpose, code: str) -> None:
        normalized = self._normalize(email)
        record = await self._get_record(normalized, purpose)
        if not record:
            raise ValueError("CODE_INVALID")
        now = self._now()
        if now >= self._ensure_aware(record.expires_at):
            await self._session.execute(
                delete(VerificationCode).where(
                    VerificationCode.email == normalized,
                    VerificationCode.purpose == purpose,
                ),
            )
            await self._session.commit()
            raise ValueError("CODE_EXPIRED")
        if record.attempts_left <= 0:
            raise ValueError("TOO_MANY_ATTEMPTS")
        if not hmac.compare_digest(record.code_hash, self._hash_code(code)):
            record.attempts_left -= 1
            await self._session.commit()
            raise ValueError("CODE_INVALID")
        await self._session.execute(
            delete(VerificationCode).where(
                VerificationCode.email == normalized,
                VerificationCode.purpose == purpose,
            ),
        )
        await self._session.commit()


def get_verification_service(session: AsyncSession) -> VerificationCodeService:
    return VerificationCodeService(session)
