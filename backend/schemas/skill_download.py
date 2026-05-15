from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class SkillDownloadRequest(BaseModel):
    skill_uuid: str
    version: str | None = Field(default=None, max_length=100)

    @field_validator("skill_uuid")
    @classmethod
    def validate_skill_uuid(cls, value: str) -> str:
        return str(UUID(str(value).strip()))

    @field_validator("version")
    @classmethod
    def normalize_version(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SkillDownloadResponse(BaseModel):
    skill_uuid: str
    version: str
    encrypted_code: str
    checksum: str
    checksum_basis: Literal["encrypted_payload", "plaintext_archive"]
    expires_at: datetime
    cache_ttl_seconds: int | None = None
    archive_size_bytes: int
    encryption_enabled: bool
    download_filename: str
    decryption_hint: str | None = None
    warning: str | None = None
