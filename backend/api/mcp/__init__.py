import asyncio
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.types import Receive, Scope, Send
from backend.api.mcp.auth import (
    ApiTokenVerifier,
    SessionProvider,
    reset_session_provider,
    set_session_provider,
)
from backend.api.mcp.http_handler import (
    create_http_app,
    get_http_app,
    set_http_app,
)
from backend.api.mcp.sse_handler import (
    create_sse_app,
    get_sse_app,
    set_sse_app,
)
from backend.config.settings import settings
from backend.core.utils.user_context import set_current_user_id
from backend.core.security.jwt_utils import decode_token
from backend.db.session import get_async_session
from backend.repositories.user import UserRepository
_mcp_app: Any | None = None
_mcp_service: Any | None = None
_initialized = False
_init_lock = asyncio.Lock()
_init_error: Exception | None = None


def _error_payload(detail: object, code: str) -> dict:
    return {
        "detail": detail,
        "code": code,
        "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    }


def set_mcp_session_provider(provider: SessionProvider) -> None:
    set_session_provider(provider)


def reset_mcp_session_provider() -> None:
    reset_session_provider()


def _extract_bearer_token(scope: Scope) -> str | None:
    headers = scope.get("headers") or []
    for key, value in headers:
        if key.decode().lower() == "authorization":
            auth_value = value.decode()
            parts = auth_value.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                return parts[1]
            return None
    return None


async def _send_error(
    scope: Scope,
    receive: Receive,
    send: Send,
    detail: str,
    code: str,
    status_code: int = 401,
) -> None:
    response = JSONResponse(status_code=status_code, content=_error_payload(detail, code))
    await response(scope, receive, send)


async def _load_active_user(user_id: str):
    async for session in get_async_session():
        repo = UserRepository(session)
        user = await repo.get_by_id(user_id)
        if user and user.is_active:
            return user
        return None
    return None


async def _authorize_mcp_request(scope: Scope, receive: Receive, send: Send) -> bool:
    token = _extract_bearer_token(scope)
    if not token:
        await _send_error(scope, receive, send, "Invalid token format", "INVALID_TOKEN_FORMAT")
        return False
    verifier = ApiTokenVerifier()
    access_token, error = await verifier.verify_token_with_error(token)
    if access_token:
        return True
    try:
        payload = decode_token(token)
    except ValueError:
        if error:
            code, detail = error
            await _send_error(scope, receive, send, detail, code)
            return False
        await _send_error(scope, receive, send, "Token not found", "TOKEN_NOT_FOUND")
        return False
    if payload.get("type") != "access":
        await _send_error(scope, receive, send, "Invalid token type", "INVALID_TOKEN_TYPE")
        return False
    user_id = payload.get("sub")
    if not user_id:
        await _send_error(scope, receive, send, "Invalid token", "INVALID_TOKEN")
        return False
    user = await _load_active_user(str(user_id))
    if not user:
        await _send_error(scope, receive, send, "User not found", "USER_NOT_FOUND")
        return False
    if payload.get("ver", 0) != user.jwt_token_version:
        await _send_error(scope, receive, send, "Token revoked", "TOKEN_REVOKED")
        return False
    set_current_user_id(str(user.id))
    return True


def _build_fallback_app() -> Starlette:
    async def handler(_request):
        return JSONResponse(status_code=401, content=_error_payload("Unauthorized", "UNAUTHORIZED"))

    return Starlette(
        routes=[
            Route(
                "/{path:path}",
                handler,
                methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            ),
        ],
    )


async def ensure_mcp_initialized() -> None:
    global _initialized
    global _mcp_app
    global _mcp_service
    global _init_error
    if _initialized:
        return
    async with _init_lock:
        if _initialized:
            return
        try:
            from flowllm.core.context import C
            from flowllm.core.flow import BaseToolFlow
            from flowllm.core.service.mcp_service import MCPService

            from backend.core.app import SkillHubMcpApp
            import backend.core.tools
        except Exception as exc:
            _init_error = exc
            fallback = _build_fallback_app()
            set_http_app(fallback)
            set_sse_app(fallback)
            _initialized = True
            return
        _mcp_app = SkillHubMcpApp("config=default")
        await _mcp_app.async_start()
        _mcp_app.service_config.metadata["skill_dir"] = str(Path(settings.SKILL_STORAGE_PATH).resolve())
        service = MCPService(service_config=_mcp_app.service_config)
        for flow in C.flow_dict.values():
            if isinstance(flow, BaseToolFlow):
                service.integrate_tool_flow(flow)
        _mcp_service = service
        set_http_app(create_http_app(service.mcp))
        set_sse_app(create_sse_app(service.mcp))
        _initialized = True


async def shutdown_mcp() -> None:
    global _initialized
    global _mcp_app
    global _mcp_service
    if not _initialized:
        return
    if _mcp_app:
        await _mcp_app.async_stop()
    _mcp_app = None
    _mcp_service = None
    set_http_app(None)
    set_sse_app(None)
    _initialized = False


class McpAppProxy:
    def __init__(self, app_getter: Callable[[], Any]):
        self._app_getter = app_getter

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        try:
            if scope.get("type") == "http":
                authorized = await _authorize_mcp_request(scope, receive, send)
                if not authorized:
                    return
            await ensure_mcp_initialized()
            app = self._app_getter()
            await app(scope, receive, send)
        finally:
            set_current_user_id(None)


__all__ = [
    "McpAppProxy",
    "ensure_mcp_initialized",
    "get_http_app",
    "get_sse_app",
    "reset_mcp_session_provider",
    "set_mcp_session_provider",
    "shutdown_mcp",
]
