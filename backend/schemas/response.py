from typing import Generic, TypeVar

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str
    code: str
    timestamp: str


T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str


class DashboardOverviewResponse(BaseModel):
    active_skills: int
    available_tokens: int
    success_rate: float | None = None
    success_rate_window_hours: int
    success_rate_total: int
