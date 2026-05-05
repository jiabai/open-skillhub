from types import SimpleNamespace

import pytest

from backend.config.settings import settings
from backend.core.middleware.rate_limit import RateLimitMiddleware


@pytest.mark.asyncio
async def test_download_rate_limit_state_periodically_cleans_expired_clients(monkeypatch):
    from backend.api.v1.skills_support import download as download_module

    original_enabled = settings.ENABLE_RATE_LIMIT
    original_requests = settings.SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS
    original_window = settings.SKILL_DOWNLOAD_RATE_LIMIT_WINDOW
    settings.ENABLE_RATE_LIMIT = True
    settings.SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS = 10
    settings.SKILL_DOWNLOAD_RATE_LIMIT_WINDOW = 10
    clock = {"now": 0.0}
    monkeypatch.setattr(download_module.time, "monotonic", lambda: clock["now"])
    download_module._download_rate_limit_state.clear()
    download_module._download_rate_limit_last_cleanup = 0.0
    request_a = SimpleNamespace(client=SimpleNamespace(host="client-a"))
    request_b = SimpleNamespace(client=SimpleNamespace(host="client-b"))
    current_user = SimpleNamespace(id=None)

    try:
        await download_module.enforce_download_rate_limit(request_a, current_user)
        assert "client-a" in download_module._download_rate_limit_state

        clock["now"] = 20.0
        await download_module.enforce_download_rate_limit(request_b, current_user)

        assert "client-a" not in download_module._download_rate_limit_state
        assert "client-b" in download_module._download_rate_limit_state
    finally:
        settings.ENABLE_RATE_LIMIT = original_enabled
        settings.SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS = original_requests
        settings.SKILL_DOWNLOAD_RATE_LIMIT_WINDOW = original_window
        download_module._download_rate_limit_state.clear()
        download_module._download_rate_limit_last_cleanup = 0.0


@pytest.mark.asyncio
async def test_rate_limit_middleware_periodically_cleans_expired_clients(monkeypatch):
    from backend.core.middleware import rate_limit as rate_limit_module

    original_enabled = settings.ENABLE_RATE_LIMIT
    original_requests = settings.RATE_LIMIT_REQUESTS
    original_window = settings.RATE_LIMIT_WINDOW
    settings.ENABLE_RATE_LIMIT = True
    settings.RATE_LIMIT_REQUESTS = 10
    settings.RATE_LIMIT_WINDOW = 10
    clock = {"now": 0.0}
    monkeypatch.setattr(rate_limit_module.time, "monotonic", lambda: clock["now"])
    middleware = RateLimitMiddleware(lambda scope, receive, send: None)

    try:
        limited_a = await middleware._is_rate_limited("client-a")
        assert limited_a is False
        assert "client-a" in middleware._requests

        clock["now"] = 20.0
        limited_b = await middleware._is_rate_limited("client-b")
        assert limited_b is False
        assert "client-a" not in middleware._requests
        assert "client-b" in middleware._requests
    finally:
        settings.ENABLE_RATE_LIMIT = original_enabled
        settings.RATE_LIMIT_REQUESTS = original_requests
        settings.RATE_LIMIT_WINDOW = original_window
