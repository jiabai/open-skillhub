from datetime import datetime

from pydantic import BaseModel, Field


class AuditLogItem(BaseModel):
    id: str
    actor_id: str
    action: str
    target: str
    result: str
    timestamp: datetime
    ip: str
    user_agent: str
    details: dict

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogItem]


class AuditLogExportRequest(BaseModel):
    format: str = Field(default="json")
    filters: dict = Field(default_factory=dict)


class AuditLogExportResponse(BaseModel):
    format: str
    content: str
