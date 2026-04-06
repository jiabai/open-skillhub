from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SSOReplayToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "sso_replay_tokens"

    replay_key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    purpose: Mapped[str] = mapped_column(String(32), index=True, default="sso_login")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
