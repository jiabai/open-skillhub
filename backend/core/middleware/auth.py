from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from loguru import logger

from backend.domain.user_status import assert_user_active
from backend.core.security.jwt_utils import decode_token
from backend.core.middleware.logging import safe_log_context
from backend.db.session import get_async_session
from backend.repositories.user import UserRepository


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme), session=Depends(get_async_session)
):
    try:
        payload = decode_token(token)
    except ValueError as exc:
        logger.bind(reason=str(exc)).debug("Access token decode failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc
    if payload.get("type") != "access":
        logger.bind(token_type=payload.get("type")).debug(
            "Access token rejected because type is invalid"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type"
        )
    user_id = payload.get("sub")
    if not user_id:
        logger.debug("Access token rejected because subject is missing")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if not user:
        logger.bind(**safe_log_context(user_id=str(user_id))).debug(
            "Access token subject user not found"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    if payload.get("ver", 0) != user.jwt_token_version:
        logger.bind(
            **safe_log_context(
                user_id=str(user.id),
                token_version=payload.get("ver", 0),
                current_version=user.jwt_token_version,
            )
        ).debug("Access token version mismatch")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked"
        )
    return user


async def get_current_active_user(user=Depends(get_current_user)):
    assert_user_active(user)
    return user
