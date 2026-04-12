from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, Field


WritableSkillVisibility = Literal["private", "team", "enterprise"]


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=50)
    visible: WritableSkillVisibility = Field(
        default="private",
        validation_alias=AliasChoices("visible", "visibility"),
    )


class SkillUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = Field(default=None, max_length=50)
    visible: WritableSkillVisibility | None = Field(
        default=None,
        validation_alias=AliasChoices("visible", "visibility"),
    )


class SkillResponse(BaseModel):
    id: str
    user_id: str | None = None
    name: str
    description: str
    tags: list[str]
    visible: str = Field(alias="visibility", serialization_alias="visible")
    enterprise_id: str | None
    team_id: str | None
    skill_dir: str
    source_skill_id: str | None = None
    pinned_version: str | None = None
    resolved_version: str | None = None
    skill_kind: Literal["regular", "public", "reference", "clone"] = "regular"
    is_reference_read_only: bool = False
    current_version: str | None
    is_active: bool
    cache_revoked_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class SkillListResponse(BaseModel):
    items: list[SkillResponse]
    total: int


class PublicSkillListItem(SkillResponse):
    has_reference: bool = False
    has_clone: bool = False


class PublicSkillListResponse(BaseModel):
    items: list[PublicSkillListItem]
    total: int


class SkillReferenceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    pinned_version: str | None = Field(default=None, max_length=50)


class SkillCloneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    visible: WritableSkillVisibility = Field(
        default="private",
        validation_alias=AliasChoices("visible", "visibility"),
    )


class SkillPinVersionRequest(BaseModel):
    version: str = Field(min_length=1, max_length=50)


class SkillCachePolicyResponse(BaseModel):
    cache_ttl_seconds: int
    encryption_enabled: bool
    download_encryption_enabled: bool
