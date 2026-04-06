from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from backend.models.request_metric import RequestMetric
from backend.repositories.user import UserRepository
from sso_helpers import sso_login


@pytest.mark.asyncio
async def test_metrics_cleanup_requires_superuser(client):
    access = await sso_login(
        client,
        email="basic@example.com",
        username="basic",
        enterprise_id="ent-metrics",
        team_id="team-metrics",
        role="member",
    )
    response = await client.post(
        "/api/v1/dashboard/metrics/cleanup",
        headers={"Authorization": f"Bearer {access}"},
        json={"retention_days": 5},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_metrics_cleanup_removes_old_metrics(client, async_session):
    access = await sso_login(
        client,
        email="admin@example.com",
        username="admin",
        enterprise_id="ent-metrics",
        team_id="team-metrics",
        role="admin",
    )

    user_repo = UserRepository(async_session)
    user = await user_repo.get_by_email("admin@example.com")

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    async_session.add_all(
        [
            RequestMetric(
                user_id=user.id,
                bucket_start=now - timedelta(days=10),
                total_count=1,
                success_count=1,
                failure_count=0,
            ),
            RequestMetric(
                user_id=user.id,
                bucket_start=now - timedelta(days=2),
                total_count=2,
                success_count=2,
                failure_count=0,
            ),
        ]
    )
    await async_session.commit()

    response = await client.post(
        "/api/v1/dashboard/metrics/cleanup",
        headers={"Authorization": f"Bearer {access}"},
        json={"retention_days": 5},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["removed"] == 1
    assert payload["retention_days"] == 5

    result = await async_session.execute(
        select(func.count()).select_from(RequestMetric).where(RequestMetric.user_id == user.id)
    )
    assert int(result.scalar_one()) == 1
