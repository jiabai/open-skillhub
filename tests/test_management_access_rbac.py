import pytest

from backend.config.settings import settings
from sso_helpers import sso_login


@pytest.mark.asyncio
async def test_users_list_denied_when_rbac_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    access = await sso_login(
        client,
        email="rbac-off-users@example.com",
        username="rbacoffusers",
        enterprise_id="ent-rbac-off",
        team_id="team-rbac-off",
        role="member",
    )
    response = await client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Management access requires RBAC"


@pytest.mark.asyncio
async def test_update_identity_denied_when_rbac_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    access = await sso_login(
        client,
        email="rbac-off-identity@example.com",
        username="rbacoffidentity",
        enterprise_id="ent-rbac-off",
        team_id="team-rbac-off",
        role="member",
    )
    response = await client.put(
        "/api/v1/users/some-user-id/identity",
        headers={"Authorization": f"Bearer {access}"},
        json={"role": "admin"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Management access requires RBAC"


@pytest.mark.asyncio
async def test_audit_logs_denied_when_rbac_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    access = await sso_login(
        client,
        email="rbac-off-audit@example.com",
        username="rbacoffaudit",
        enterprise_id="ent-rbac-off",
        team_id="team-rbac-off",
        role="admin",
    )
    response = await client.get(
        "/api/v1/audit/logs",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Management access requires RBAC"


@pytest.mark.asyncio
async def test_metrics_cleanup_denied_when_rbac_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    access = await sso_login(
        client,
        email="rbac-off-metrics@example.com",
        username="rbacoffmetrics",
        enterprise_id="ent-rbac-off",
        team_id="team-rbac-off",
        role="admin",
    )
    response = await client.post(
        "/api/v1/dashboard/metrics/cleanup",
        headers={"Authorization": f"Bearer {access}"},
        json={"retention_days": 5},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Management access requires RBAC"
