from datetime import datetime

from pydantic import BaseModel, Field


class TokenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    expires_at: datetime | None = None


class TokenRefresh(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    id: str
    name: str
    token: str | None = None
    is_active: bool
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenListResponse(BaseModel):
    items: list[TokenResponse]
    total: int
