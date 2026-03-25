from datetime import datetime, timedelta, timezone
import sys
from pathlib import Path

from fastapi import Request
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware

from backend.config.settings import settings
from backend.db.session import get_async_session
from backend.repositories.request_metric import RequestMetricRepository


_REQUEST_WINDOW_SECONDS = 24 * 60 * 60


def _should_track_request(path: str) -> bool:
    return False


async def get_success_rate(user_id: str, window_seconds: int = _REQUEST_WINDOW_SECONDS) -> tuple[float | None, int]:
    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(seconds=window_seconds)
    async for session in get_async_session():
        repo = RequestMetricRepository(session)
        total, success = await repo.aggregate_window(user_id, window_start, window_end)
        if total == 0:
            return 0, 0
        rate = success / total * 100
        return rate, total
    return 0, 0


def configure_loguru() -> None:
    serialize = str(settings.LOG_FORMAT).lower() == "json"
    logger.remove()
    logger.add(sys.stderr, level=settings.LOG_LEVEL, serialize=serialize)
    log_file = str(settings.LOG_FILE).strip()
    if not log_file:
        return
    try:
        Path(log_file).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        logger.add(log_file, level=settings.LOG_LEVEL, serialize=serialize)
    except Exception:
        return


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
        except Exception:
            response = JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal Server Error",
                    "code": "INTERNAL_SERVER_ERROR",
                    "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                },
            )
        logger.info(f"{request.method} {request.url.path} {response.status_code}")
        return response
