from datetime import datetime

from pydantic import BaseModel, Field


class SkillVersionResponse(BaseModel):
    version: str
    description: str
    dependencies: list[str]
    dependency_spec: dict | None = None
    dependency_spec_version: str | None = None
    metadata: dict = Field(alias="metadata_json")
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class SkillVersionListResponse(BaseModel):
    items: list[SkillVersionResponse]
