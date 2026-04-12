from pydantic import BaseModel, Field, field_validator

from backend.core.security.user_state import UserStatus, normalize_user_status


class LDAPLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=256)


class UserIdentityUpdate(BaseModel):
    enterprise_id: str | None = Field(default=None, max_length=100)
    team_id: str | None = Field(default=None, max_length=100)
    role: str | None = Field(default=None, max_length=50)
    status: UserStatus | None = Field(default=None, max_length=32)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_user_status(value)
