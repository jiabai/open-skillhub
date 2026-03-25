from pydantic import BaseModel, Field


class SSOLoginRequest(BaseModel):
    id_token: str = Field(min_length=10)


class LDAPLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=256)


class UserIdentityUpdate(BaseModel):
    enterprise_id: str | None = Field(default=None, max_length=100)
    team_id: str | None = Field(default=None, max_length=100)
    role: str | None = Field(default=None, max_length=50)
    status: str | None = Field(default=None, max_length=32)
