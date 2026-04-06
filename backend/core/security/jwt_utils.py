from datetime import datetime, timedelta, timezone

import jwt as pyjwt

from backend.config.settings import settings


def _create_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    token_version: int = 0,
) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "type": token_type, "exp": expire, "ver": token_version}
    return pyjwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: str, token_version: int = 0) -> str:
    return _create_token(
        subject=subject,
        token_type="access",
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_version=token_version,
    )


def create_refresh_token(subject: str, token_version: int = 0) -> str:
    return _create_token(
        subject=subject,
        token_type="refresh",
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_version=token_version,
    )


def decode_token(token: str) -> dict:
    try:
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except pyjwt.ExpiredSignatureError as exc:
        raise ValueError("Token expired") from exc
    except pyjwt.PyJWTError as exc:
        raise ValueError("Invalid token") from exc
