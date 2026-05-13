from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.domain.user_status import DEFAULT_USER_STATUS
from backend.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    enterprise_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(50), default="member")
    status: Mapped[str] = mapped_column(String(32), default=DEFAULT_USER_STATUS)
    jwt_token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    tokens = relationship("APIToken", back_populates="user", cascade="all, delete-orphan")
    skills = relationship("Skill", back_populates="user", cascade="all, delete-orphan")
    refresh_token_sessions = relationship("RefreshTokenSession", back_populates="user", cascade="all, delete-orphan")
