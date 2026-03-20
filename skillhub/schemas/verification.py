from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class VerificationCodeRequest(BaseModel):
    email: EmailStr
    purpose: Literal["login", "register", "bind_email", "delete_account"]


class VerificationCodeResponse(BaseModel):
    sent: bool
    expires_in: int = Field(ge=1)
    resend_interval: int = Field(ge=1)
    max_attempts: int = Field(ge=1)
    attempts_left: int = Field(ge=0)
