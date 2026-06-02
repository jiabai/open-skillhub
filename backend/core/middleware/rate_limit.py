import asyncio
import time

from loguru import logger
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from backend.config.settings import settings
from backend.core.errors import error_payload
from backend.core.middleware.logging import safe_log_context

_RATE_LIMIT_CLEANUP_INTERVAL_SECONDS = 60


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app
        self._requests: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()
        self._last_cleanup = 0.0

    def _cleanup_requests(self, now: float, window: int) -> None:
        cleanup_interval = min(window, _RATE_LIMIT_CLEANUP_INTERVAL_SECONDS)
        if now - self._last_cleanup < cleanup_interval:
            return
        cutoff = now - window
        stale_clients: list[str] = []
        for client, timestamps in self._requests.items():
            recent = [ts for ts in timestamps if ts >= cutoff]
            if recent:
                self._requests[client] = recent
            else:
                stale_clients.append(client)
        for client in stale_clients:
            self._requests.pop(client, None)
        self._last_cleanup = now
        if stale_clients:
            logger.bind(stale_client_count=len(stale_clients)).debug(
                "Cleaned up stale rate limit clients"
            )

    @staticmethod
    def _current_limits() -> tuple[int, int]:
        return int(settings.RATE_LIMIT_REQUESTS), int(settings.RATE_LIMIT_WINDOW)

    async def _is_rate_limited(self, client: str) -> bool:
        limit, window = self._current_limits()
        if limit <= 0 or window <= 0:
            return False

        now = time.monotonic()
        async with self._lock:
            self._cleanup_requests(now, window)
            timestamps = self._requests.get(client, [])
            cutoff = now - window
            timestamps = [ts for ts in timestamps if ts >= cutoff]
            if len(timestamps) >= limit:
                logger.bind(
                    **safe_log_context(
                        client=client,
                        request_count=len(timestamps),
                        limit=limit,
                        window_seconds=window,
                    )
                ).debug("Rate limit exceeded")
                return True
            timestamps.append(now)
            self._requests[client] = timestamps
        return False

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if not settings.ENABLE_RATE_LIMIT:
            await self.app(scope, receive, send)
            return

        client_address = scope.get("client")
        client = str(client_address[0]) if client_address else "unknown"
        if await self._is_rate_limited(client):
            payload = error_payload("Rate limit exceeded", "RATE_LIMIT_EXCEEDED")
            response = JSONResponse(status_code=429, content=payload)
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
