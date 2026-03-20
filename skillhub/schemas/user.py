from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRegisterCode(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=64)
    code: str = Field(min_length=4, max_length=12)


class UserLoginCode(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=12)


class UserBindEmail(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=12)


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    username: str | None = Field(default=None, min_length=2, max_length=64)


class UserDeleteConfirm(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    username: str
    is_active: bool
    is_superuser: bool
    enterprise_id: str | None = None
    team_id: str | None = None
    role: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserInDB(UserResponse):
    hashed_password: str
