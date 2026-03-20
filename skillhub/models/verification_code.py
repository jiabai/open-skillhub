from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from skillhub.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class VerificationCode(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "verification_codes"
    __table_args__ = (UniqueConstraint("email", "purpose", name="uix_verification_codes_email_purpose"),)

    email: Mapped[str] = mapped_column(String(320), index=True)
    purpose: Mapped[str] = mapped_column(String(32), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    resend_available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    attempts_left: Mapped[int] = mapped_column(Integer, default=5)
