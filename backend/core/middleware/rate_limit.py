import asyncio
import time
from datetime import datetime, timezone

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from backend.config.settings import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._requests: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

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
            timestamps = self._requests.get(client, [])
            cutoff = now - window
            timestamps = [ts for ts in timestamps if ts >= cutoff]
            if len(timestamps) >= limit:
                payload = {
                    "detail": "Rate limit exceeded",
                    "code": "RATE_LIMIT_EXCEEDED",
                    "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                }
                return JSONResponse(status_code=429, content=payload)
            timestamps.append(now)
            self._requests[client] = timestamps
        return await call_next(request)
