import json
from collections.abc import AsyncGenerator, Callable
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from skillhub.config.settings import settings
from skillhub.core.utils.user_context import get_current_user_id
from skillhub.db.session import get_async_session
from skillhub.repositories.request_metric import RequestMetricRepository


SessionProvider = Callable[[], AsyncGenerator[AsyncSession, None]]


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


def _is_error_output(output: object) -> bool:
    if not isinstance(output, str):
        return False
    text = output.strip()
    if not (text.startswith("{") and text.endswith("}")):
        return False
    try:
        payload = json.loads(text)
    except Exception:
        return False
    if not isinstance(payload, dict):
        return False
    return "code" in payload and "detail" in payload and "timestamp" in payload


async def record_tool_call(tool_name: str, output: object = None, exception: Exception | None = None) -> None:
    if not settings.ENABLE_METRICS:
        return
    user_id = get_current_user_id()
    if not user_id:
        return
    success = exception is None and not _is_error_output(output)
    bucket_start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    try:
        async for session in _session_provider():
            repo = RequestMetricRepository(session)
            await repo.upsert_hour_bucket(str(user_id), bucket_start, success)
            return
    except Exception:
        return
