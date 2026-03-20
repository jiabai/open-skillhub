from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from skillhub.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class RequestMetric(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "request_metrics"
    __table_args__ = (UniqueConstraint("user_id", "bucket_start", name="uix_request_metrics_user_bucket"),)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    bucket_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    total_count: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
