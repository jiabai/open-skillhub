import importlib
import re
from collections.abc import AsyncGenerator, Callable
from datetime import timezone
from typing import TYPE_CHECKING

from mcp.server.auth.provider import AccessToken
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.user_context import set_current_user_id
from backend.db.session import get_async_session
from backend.repositories.token import TokenRepository
from backend.repositories.user import UserRepository
from backend.services.token import TokenService

if TYPE_CHECKING:
    from fastmcp.server.auth.auth import TokenVerifier
else:
    try:
        TokenVerifier = importlib.import_module("fastmcp.server.auth.auth").TokenVerifier
    except Exception:

        class TokenVerifier:
            async def verify_token(self, token: str):
                raise NotImplementedError


SessionProvider = Callable[[], AsyncGenerator[AsyncSession, None]]

_token_pattern = re.compile(r"^ask_live_[0-9a-f]{64}$")


async def _default_session_provider() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_async_session():
        yield session


_session_provider: SessionProvider = _default_session_provider


def set_session_provider(provider: SessionProvider) -> None:
    global _session_provider
    _session_provider = provider


def reset_session_provider() -> None:
    global _session_provider
    _session_provider = _default_session_provider


def _map_token_error(message: str) -> str:
    lowered = message.lower()
    if "expired" in lowered:
        return "TOKEN_EXPIRED"
    if "revoked" in lowered:
        return "TOKEN_REVOKED"
    if "not found" in lowered:
        return "TOKEN_NOT_FOUND"
    return "TOKEN_NOT_FOUND"


class ApiTokenVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> AccessToken | None:
        access_token, _ = await self.verify_token_with_error(token)
        return access_token

    async def verify_token_with_error(self, token: str) -> tuple[AccessToken | None, tuple[str, str] | None]:
        if not _token_pattern.match(token):
            return None, ("INVALID_TOKEN_FORMAT", "Invalid token format")
        async for session in _session_provider():
            token_repo = TokenRepository(session)
            user_repo = UserRepository(session)
            service = TokenService(token_repo, user_repo)
            try:
                api_token = await service.validate_token(token)
            except ValueError as exc:
                code = _map_token_error(str(exc))
                return None, (code, str(exc))
            user = await user_repo.get_by_id(api_token.user_id)
            if not user or not user.is_active:
                return None, ("TOKEN_REVOKED", "Token revoked")
            set_current_user_id(str(user.id))
            expires_at = None
            if api_token.expires_at:
                expires_at = int(api_token.expires_at.replace(tzinfo=timezone.utc).timestamp())
            return AccessToken(token=token, client_id=str(user.id), scopes=[], expires_at=expires_at), None
        return None, ("TOKEN_NOT_FOUND", "Token not found")
