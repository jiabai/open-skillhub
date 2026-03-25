from datetime import datetime, timedelta, timezone

import pytest

from backend.models.request_metric import RequestMetric

@pytest.mark.asyncio
async def test_dashboard_overview_zero_when_no_metrics(client):
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "dash@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "dash@example.com", "username": "dashuser", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "dash@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "dash@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    response = await client.get("/api/v1/dashboard/overview", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["success_rate"] == 0
    assert payload["success_rate_total"] == 0


@pytest.mark.asyncio
async def test_dashboard_overview_aggregates_persisted_metrics(client, async_session):
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "dash2@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "dash2@example.com", "username": "dashuser2", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "dash2@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "dash2@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    me = await client.get("/api/v1/users/me", headers=headers)
    user_id = me.json()["id"]

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    async_session.add_all(
        [
            RequestMetric(
                user_id=user_id,
                bucket_start=now - timedelta(hours=1),
                total_count=5,
                success_count=3,
                failure_count=2,
            ),
            RequestMetric(
                user_id=user_id,
                bucket_start=now - timedelta(hours=3),
                total_count=2,
                success_count=2,
                failure_count=0,
            ),
        ]
    )
    await async_session.commit()

    response = await client.get("/api/v1/dashboard/overview", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["success_rate_total"] == 7
    assert payload["success_rate"] == pytest.approx(71.428, rel=1e-2)
