from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class RefreshTokenSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "refresh_token_sessions"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    family_id: Mapped[str] = mapped_column(String(64), index=True)
    jti: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by_jti: Mapped[str | None] = mapped_column(String(64), nullable=True)

    user = relationship("User", back_populates="refresh_token_sessions")
