from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from backend.core.security.jwt_utils import decode_token
from backend.db.session import get_async_session
from backend.repositories.user import UserRepository


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme), session=Depends(get_async_session)):
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if payload.get("ver", 0) != user.jwt_token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")
    return user


async def get_current_active_user(user=Depends(get_current_user)):
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return user
