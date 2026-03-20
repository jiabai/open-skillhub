from datetime import datetime

from pydantic import AliasChoices, BaseModel, Field


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=50)
    visible: str = Field(
        default="private",
        max_length=20,
        validation_alias=AliasChoices("visible", "visibility"),
    )


class SkillUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = Field(default=None, max_length=50)
    visible: str | None = Field(
        default=None,
        max_length=20,
        validation_alias=AliasChoices("visible", "visibility"),
    )


class SkillResponse(BaseModel):
    id: str
    name: str
    description: str
    tags: list[str]
    visible: str = Field(alias="visibility", serialization_alias="visible")
    enterprise_id: str | None
    team_id: str | None
    skill_dir: str
    current_version: str | None
    is_active: bool
    cache_revoked_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class SkillListResponse(BaseModel):
    items: list[SkillResponse]
    total: int


class SkillCachePolicyResponse(BaseModel):
    cache_ttl_seconds: int
    encryption_enabled: bool
    download_encryption_enabled: bool
