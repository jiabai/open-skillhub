import json
from datetime import datetime, timedelta, timezone
import sys
import time
from pathlib import Path
from typing import Any

from loguru import logger
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from backend.config.settings import settings
from backend.db.session import get_async_session
from backend.repositories.request_metric import RequestMetricRepository


_REQUEST_WINDOW_SECONDS = 24 * 60 * 60
_SENSITIVE_LOG_KEYS = {
    "api_token",
    "access_token",
    "refresh_token",
    "id_token",
    "token",
    "authorization",
    "authorization_code",
    "client_secret",
    "code_verifier",
    "cookie",
    "password",
    "secret",
    "state",
    "otp_code",
    "verification_code",
}
_SENSITIVE_LOG_SUFFIXES = ("_token", "_secret", "_password", "_verifier")


def _should_track_request(path: str) -> bool:
    return False


def _mask_text(value: str, *, prefix: int = 4, suffix: int = 4) -> str:
    if len(value) <= prefix + suffix:
        return "***"
    return f"{value[:prefix]}...{value[-suffix:]}"


def safe_log_value(key: str, value: Any) -> Any:
    lower_key = str(key or "").lower()
    if value is None or isinstance(value, bool | int | float):
        return value
    if lower_key in _SENSITIVE_LOG_KEYS or lower_key.endswith(_SENSITIVE_LOG_SUFFIXES):
        return "<redacted>"
    if isinstance(value, str):
        if not value:
            return value
        if "email" in lower_key or "@" in value:
            return _mask_text(value, prefix=3, suffix=3)
        if lower_key.endswith("_id") or lower_key in {
            "actor_id",
            "owner_id",
            "source_user_id",
            "stored_user_id",
            "target_id",
            "target",
            "subject",
        }:
            return _mask_text(value, prefix=4, suffix=4)
    return value


def safe_log_context(**context: Any) -> dict[str, Any]:
    return {key: safe_log_value(key, value) for key, value in context.items()}


def _scope_headers(scope: Scope) -> dict[str, str]:
    headers: dict[str, str] = {}
    for raw_key, raw_value in scope.get("headers", []):
        try:
            key = raw_key.decode("latin-1").lower()
            value = raw_value.decode("latin-1", errors="replace")
        except Exception:
            continue
        headers[key] = value
    return headers


def _client_host(scope: Scope) -> str:
    client = scope.get("client")
    if not client:
        return ""
    return str(client[0] or "")


async def get_success_rate(
    user_id: str, window_seconds: int = _REQUEST_WINDOW_SECONDS
) -> tuple[float | None, int]:
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
                        "time": dt,
                    },
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


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = str(scope.get("method") or "")
        path = str(scope.get("path") or "")
        headers = _scope_headers(scope)
        request_id = (
            headers.get("x-request-id") or headers.get("x-correlation-id") or ""
        )
        user_agent = headers.get("user-agent", "")
        client = _client_host(scope)
        started_at = time.perf_counter()
        status_code = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            duration_ms = int((time.perf_counter() - started_at) * 1000)
            context = safe_log_context(
                request_id=request_id,
                method=method,
                path=path,
                status_code=500,
                duration_ms=duration_ms,
                client=client,
                user_agent=user_agent,
            )
            logger.bind(**context).exception("HTTP request failed")
            logger.info(f"{method} {path} 500")
            raise
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        context = safe_log_context(
            request_id=request_id,
            method=method,
            path=path,
            status_code=status_code,
            duration_ms=duration_ms,
            client=client,
            user_agent=user_agent,
        )
        logger.bind(**context).debug("HTTP request completed")
        logger.info(f"{method} {path} {status_code}")
