import json
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


def _parse_timezone(tz_str: str) -> timezone:
    if tz_str.upper() == "UTC":
        return timezone.utc
    if tz_str.upper().startswith("UTC+") or tz_str.upper().startswith("UTC-"):
        offset = int(tz_str[3:])
        return timezone(timedelta(hours=offset))
    if "+" in tz_str or tz_str.startswith("-"):
        sign = 1 if tz_str[0] != "-" else -1
        parts = tz_str.lstrip("-").split(":")
        hours = int(parts[0])
        minutes = int(parts[1]) if len(parts) > 1 else 0
        return timezone(timedelta(hours=sign * hours, minutes=sign * minutes))
    try:
        hours = int(tz_str)
        return timezone(timedelta(hours=hours))
    except ValueError:
        return timezone.utc


def configure_loguru() -> None:
    serialize = str(settings.LOG_FORMAT).lower() == "json"
    logger.remove()
    tz = _parse_timezone(settings.TIMEZONE)
    
    def create_sink(sink_dest):
        def sink(message):
            record = message.record
            dt = record["time"].astimezone(tz)
            time_str = dt.strftime("%Y-%m-%d %H:%M:%S")
            
            if not serialize:
                line = f"{time_str} | {record['level'].name: <8} | {record['name']}:{record['function']}:{record['line']} - {record['message']}\n"
            else:
                result = {
                    "text": f"{time_str} | {record['level'].name: <8} | {record['name']}:{record['function']}:{record['line']} - {record['message']}\n",
                    "record": {
                        "elapsed": record["elapsed"],
                        "exception": record["exception"],
                        "extra": record["extra"],
                        "file": record["file"],
                        "function": record["function"],
                        "level": record["level"],
                        "line": record["line"],
                        "message": record["message"],
                        "module": record["module"],
                        "name": record["name"],
                        "process": record["process"],
                        "thread": record["thread"],
                        "time": dt
                    }
                }
                line = json.dumps(result, default=str, ensure_ascii=False) + "\n"
            
            if hasattr(sink_dest, "write"):
                sink_dest.write(line)
                sink_dest.flush()
            else:
                with open(sink_dest, "a", encoding="utf-8") as f:
                    f.write(line)
        
        return sink
    
    logger.add(create_sink(sys.stderr), level=settings.LOG_LEVEL)
    log_file = str(settings.LOG_FILE).strip()
    if log_file:
        try:
            log_path = Path(log_file).expanduser().resolve()
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(log_path, "a", encoding="utf-8"):
                pass
            logger.add(create_sink(log_path), level=settings.LOG_LEVEL)
        except Exception:
            pass


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
        except Exception as exc:
            detail = "Internal Server Error"
            if settings.DEBUG:
                detail = str(exc) or exc.__class__.__name__
            response = JSONResponse(
                status_code=500,
                content={
                    "detail": detail,
                    "code": "INTERNAL_SERVER_ERROR",
                    "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                },
            )
        logger.info(f"{request.method} {request.url.path} {response.status_code}")
        return response
