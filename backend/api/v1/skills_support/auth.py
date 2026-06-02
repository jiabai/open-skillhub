from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from loguru import logger

from backend.core.security.jwt_utils import decode_token
from backend.core.middleware.logging import safe_log_context
from backend.db.session import get_async_session
from backend.repositories.user import UserRepository


optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_optional_current_user(
    token: str | None = Depends(optional_oauth2_scheme),
    session=Depends(get_async_session),
):
    if not token:
        return None
    try:
        payload = decode_token(token)
    except ValueError:
        logger.debug("Optional user token ignored because decode failed")
        return None
    if payload.get("type") != "access":
        logger.bind(token_type=payload.get("type")).debug("Optional user token ignored because type is invalid")
        return None
    user_id = payload.get("sub")
    if not user_id:
        logger.debug("Optional user token ignored because subject is missing")
        return None
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if not user or not user.is_active:
        logger.bind(**safe_log_context(user_id=str(user_id), user_found=bool(user))).debug(
            "Optional user token ignored because user is missing or inactive"
        )
        return None
    if payload.get("ver", 0) != user.jwt_token_version:
        logger.bind(
            **safe_log_context(
                user_id=str(user.id),
                token_version=payload.get("ver", 0),
                current_version=user.jwt_token_version,
            )
        ).debug("Optional user token ignored because version is stale")
        return None
    return user
