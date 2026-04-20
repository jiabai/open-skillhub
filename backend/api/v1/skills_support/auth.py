from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from backend.core.security.jwt_utils import decode_token
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
        return None
    if payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if not user or not user.is_active:
        return None
    if payload.get("ver", 0) != user.jwt_token_version:
        return None
    return user
