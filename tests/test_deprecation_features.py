from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from starlette.responses import JSONResponse

from backend.core.decorators.deprecation import deprecated
from backend.core.middleware.deprecation import DeprecationMiddleware
from backend.models.audit_log import AuditLog
from backend.repositories.audit_log import AuditLogRepository
from backend.services.deprecation_notification import DeprecationNotifier


@pytest.mark.asyncio
async def test_deprecated_decorator_works_without_response_parameter():
    @deprecated(sunset_date="2026-12-31", alternative="/api/v2/new")
    async def legacy_endpoint():
        return {"ok": True}

    payload = await legacy_endpoint()
    assert payload == {"ok": True}


@pytest.mark.asyncio
async def test_deprecation_middleware_uses_canonical_header_case():
    async def app(scope, receive, send):
        response = JSONResponse({"ok": True})
        await response(scope, receive, send)

    middleware = DeprecationMiddleware(
        app,
        deprecated_endpoints={"/api/v1/legacy": "2026-12-31"},
    )
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/legacy",
        "headers": [],
        "query_string": b"",
        "scheme": "http",
        "server": ("test", 80),
        "client": ("127.0.0.1", 1234),
        "http_version": "1.1",
    }
    messages = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        messages.append(message)

    await middleware(scope, receive, send)
    start_message = next(item for item in messages if item["type"] == "http.response.start")
    assert (b"Deprecation", b"true") in start_message["headers"]
    assert (b"Sunset", b"2026-12-31") in start_message["headers"]


@pytest.mark.asyncio
async def test_deprecation_notifier_creates_audit_event(async_session):
    repo = AuditLogRepository(async_session)
    notifier = DeprecationNotifier(repo, day_offsets=[90])
    target_date = (datetime.now(timezone.utc) + timedelta(days=90)).date().isoformat()

    notifications = await notifier.notify_upcoming_deprecation(
        deprecated_endpoints={"/api/v1/legacy": target_date},
    )
    assert len(notifications) == 1
    assert notifications[0]["endpoint"] == "/api/v1/legacy"
    result = await async_session.execute(
        select(AuditLog).where(
            AuditLog.actor_id == "system",
            AuditLog.action == "deprecation_notice",
            AuditLog.target == "/api/v1/legacy",
        )
    )
    assert result.scalar_one_or_none() is not None
