from pydantic import BaseModel, Field


class MetricsCleanupRequest(BaseModel):
    retention_days: int | None = Field(default=None, ge=1, le=3650)


class MetricsCleanupResponse(BaseModel):
    removed: int
    retention_days: int
    cutoff: str
