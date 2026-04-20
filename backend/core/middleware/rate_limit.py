import asyncio
import time

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from backend.config.settings import settings
from backend.core.errors import error_payload

_RATE_LIMIT_CLEANUP_INTERVAL_SECONDS = 60


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
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

    @staticmethod
    def _current_limits() -> tuple[int, int]:
        return int(settings.RATE_LIMIT_REQUESTS), int(settings.RATE_LIMIT_WINDOW)

    async def dispatch(self, request: Request, call_next):
        if not settings.ENABLE_RATE_LIMIT:
            return await call_next(request)

        limit, window = self._current_limits()
        if limit <= 0 or window <= 0:
            return await call_next(request)

        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        async with self._lock:
            self._cleanup_requests(now, window)
            timestamps = self._requests.get(client, [])
            cutoff = now - window
            timestamps = [ts for ts in timestamps if ts >= cutoff]
            if len(timestamps) >= limit:
                payload = error_payload("Rate limit exceeded", "RATE_LIMIT_EXCEEDED")
                return JSONResponse(status_code=429, content=payload)
            timestamps.append(now)
            self._requests[client] = timestamps
        return await call_next(request)
