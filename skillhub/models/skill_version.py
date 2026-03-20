from sqlalchemy import JSON, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from skillhub.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SkillVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skill_versions"
    __table_args__ = (UniqueConstraint("skill_id", "version", name="uix_skill_versions"),)

    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    version: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(String(500), default="")
    dependencies: Mapped[list[str]] = mapped_column(JSON, default=list)
    dependency_spec: Mapped[dict] = mapped_column(JSON, default=dict)
    dependency_spec_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)

    skill = relationship("Skill", back_populates="versions")
