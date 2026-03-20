import asyncio
import time
from datetime import datetime, timezone

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from skillhub.config.settings import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._requests: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()
        self._limit = settings.RATE_LIMIT_REQUESTS
        self._window = settings.RATE_LIMIT_WINDOW

    async def dispatch(self, request: Request, call_next):
        if not settings.ENABLE_RATE_LIMIT:
            return await call_next(request)
        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        async with self._lock:
            timestamps = self._requests.get(client, [])
            cutoff = now - self._window
            timestamps = [ts for ts in timestamps if ts >= cutoff]
            if len(timestamps) >= self._limit:
                payload = {
                    "detail": "Rate limit exceeded",
                    "code": "RATE_LIMIT_EXCEEDED",
                    "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                }
                return JSONResponse(status_code=429, content=payload)
            timestamps.append(now)
            self._requests[client] = timestamps
        return await call_next(request)
