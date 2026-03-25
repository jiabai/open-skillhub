from datetime import datetime

from pydantic import BaseModel


class SkillDownloadRequest(BaseModel):
    skill_uuid: str
    version: str | None = None


class SkillDownloadResponse(BaseModel):
    skill_uuid: str
    version: str
    encrypted_code: str
    checksum: str
    expires_at: datetime
    cache_ttl_seconds: int | None = None
