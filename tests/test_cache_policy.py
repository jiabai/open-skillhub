import pytest
from sso_helpers import sso_login


@pytest.mark.asyncio
async def test_skill_cache_policy(client):
    token = await sso_login(
        client,
        email="cache@example.com",
        username="cache-user",
        enterprise_id="ent-cache",
        team_id="team-cache",
    )
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get("/api/v1/skills/cache-policy", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert "cache_ttl_seconds" in payload
    assert "encryption_enabled" in payload
