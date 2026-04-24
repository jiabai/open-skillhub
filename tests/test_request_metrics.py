from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from backend.config.settings import settings
from backend.core.middleware.logging import _should_track_request
from backend.models.request_metric import RequestMetric
from backend.repositories.request_metric import RequestMetricRepository


def test_should_track_request_filters_auth_and_non_api():
    assert _should_track_request("/api/v1/auth/login") is False
    assert _should_track_request("/health") is False
    assert _should_track_request("/api/v1/skills") is False
    assert _should_track_request("/sse") is False


@pytest.mark.asyncio
async def test_cleanup_before_removes_old_metrics(async_session):
    repo = RequestMetricRepository(async_session)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    old_bucket = now - timedelta(days=10)
    new_bucket = now - timedelta(days=1)
    async_session.add_all(
        [
            RequestMetric(
                user_id="user",
                bucket_start=old_bucket,
                total_count=1,
                success_count=1,
                failure_count=0,
            ),
            RequestMetric(
                user_id="user",
                bucket_start=new_bucket,
                total_count=2,
                success_count=2,
                failure_count=0,
            ),
        ]
    )
    await async_session.commit()

    await repo.cleanup_before(now - timedelta(days=5))

    result = await async_session.execute(
        select(func.count()).select_from(RequestMetric).where(RequestMetric.user_id == "user")
    )
    assert int(result.scalar_one()) == 1


@pytest.mark.asyncio
async def test_rate_limit_toggle_controls_middleware(client):
    original_enable = settings.ENABLE_RATE_LIMIT
    original_limit = settings.RATE_LIMIT_REQUESTS
    original_window = settings.RATE_LIMIT_WINDOW
    settings.ENABLE_RATE_LIMIT = True
    settings.RATE_LIMIT_REQUESTS = 1
    settings.RATE_LIMIT_WINDOW = 60
    try:
        first = await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "rl-enable-1@example.com", "purpose": "register"},
        )
        second = await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "rl-enable-2@example.com", "purpose": "register"},
        )
        assert first.status_code != 429
        assert second.status_code == 429
        assert second.json()["code"] == "RATE_LIMIT_EXCEEDED"

        settings.ENABLE_RATE_LIMIT = False
        third = await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "rl-disable-1@example.com", "purpose": "register"},
        )
        fourth = await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "rl-disable-2@example.com", "purpose": "register"},
        )
        assert third.status_code != 429
        assert fourth.status_code != 429
    finally:
        settings.ENABLE_RATE_LIMIT = original_enable
        settings.RATE_LIMIT_REQUESTS = original_limit
        settings.RATE_LIMIT_WINDOW = original_window


@pytest.mark.asyncio
async def test_metrics_endpoint_respects_enable_metrics_toggle(client):
    original_enable = settings.ENABLE_METRICS
    settings.ENABLE_METRICS = False
    try:
        response = await client.get("/metrics")
        assert response.status_code == 404
    finally:
        settings.ENABLE_METRICS = original_enable
