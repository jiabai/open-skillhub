from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from backend.models.request_metric import RequestMetric
from backend.repositories.user import UserRepository


@pytest.mark.asyncio
async def test_metrics_reset_24h_requires_superuser(client):
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "basic-reset@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "basic-reset@example.com", "username": "basicreset", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "basic-reset@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "basic-reset@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    response = await client.post(
        "/api/v1/dashboard/metrics/reset-24h",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_metrics_reset_24h_removes_only_window_buckets(client, async_session):
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "admin-reset@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "admin-reset@example.com", "username": "adminreset", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "admin-reset@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin-reset@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]

    user_repo = UserRepository(async_session)
    user = await user_repo.get_by_email("admin-reset@example.com")
    await user_repo.update(user, is_superuser=True)

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    async_session.add_all(
        [
            RequestMetric(
                user_id=user.id,
                bucket_start=now - timedelta(hours=23),
                total_count=2,
                success_count=2,
                failure_count=0,
            ),
            RequestMetric(
                user_id=user.id,
                bucket_start=now - timedelta(hours=25),
                total_count=3,
                success_count=3,
                failure_count=0,
            ),
        ]
    )
    await async_session.commit()

    response = await client.post(
        "/api/v1/dashboard/metrics/reset-24h",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["window_hours"] == 24
    assert payload["removed"] == 1

    result = await async_session.execute(
        select(func.count()).select_from(RequestMetric).where(RequestMetric.user_id == user.id)
    )
    assert int(result.scalar_one()) == 1
