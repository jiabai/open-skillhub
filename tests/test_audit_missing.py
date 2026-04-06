import os
import pytest
from sqlalchemy import select

from backend.models.audit_log import AuditLog
from sso_helpers import sso_login


@pytest.mark.asyncio
async def test_user_delete_creates_audit_log(client, async_session):
    token = await sso_login(
        client,
        email="delete-user@example.com",
        username="delete-user",
        enterprise_id="ent-audit",
        team_id="team-audit",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {token}"}
    await client.post("/api/v1/users/me/delete-request", headers=headers)
    response = await client.request(
        "DELETE",
        "/api/v1/users/me",
        json={"code": "123456"},
        headers=headers,
    )
    assert response.status_code == 204
    query = select(AuditLog).where(
        AuditLog.action == "user.delete",
    )
    result = await async_session.execute(query)
    event = result.scalar_one_or_none()
    assert event is not None


@pytest.mark.asyncio
async def test_skill_update_creates_audit_log(client, async_session):
    token = await sso_login(
        client,
        email="update-skill@example.com",
        username="update-skill",
        enterprise_id="ent-audit",
        team_id="team-audit",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {token}"}
    create_response = await client.post(
        "/api/v1/skills",
        json={"name": "update-test-skill", "description": "original", "visibility": "private"},
        headers=headers,
    )
    assert create_response.status_code == 201
    skill_id = create_response.json()["id"]
    update_response = await client.put(
        f"/api/v1/skills/{skill_id}",
        json={"description": "updated"},
        headers=headers,
    )
    assert update_response.status_code == 200
    query = select(AuditLog).where(
        AuditLog.action == "skill.update",
        AuditLog.target == skill_id,
    )
    result = await async_session.execute(query)
    event = result.scalar_one_or_none()
    assert event is not None


@pytest.mark.asyncio
async def test_skill_delete_creates_audit_log(client, async_session):
    token = await sso_login(
        client,
        email="delete-skill@example.com",
        username="delete-skill",
        enterprise_id="ent-audit",
        team_id="team-audit",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {token}"}
    create_response = await client.post(
        "/api/v1/skills",
        json={"name": "delete-test-skill", "description": "to be deleted", "visibility": "private"},
        headers=headers,
    )
    assert create_response.status_code == 201
    skill_id = create_response.json()["id"]
    delete_response = await client.delete(
        f"/api/v1/skills/{skill_id}",
        headers=headers,
    )
    assert delete_response.status_code == 204
    query = select(AuditLog).where(
        AuditLog.action == "skill.delete",
        AuditLog.target == skill_id,
    )
    result = await async_session.execute(query)
    event = result.scalar_one_or_none()
    assert event is not None


@pytest.mark.asyncio
async def test_token_create_creates_audit_log(client, async_session):
    token = await sso_login(
        client,
        email="create-token@example.com",
        username="create-token",
        enterprise_id="ent-audit",
        team_id="team-audit",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {token}"}
    create_response = await client.post(
        "/api/v1/tokens",
        json={"name": "test-token"},
        headers=headers,
    )
    assert create_response.status_code == 201
    token_id = create_response.json()["id"]
    query = select(AuditLog).where(
        AuditLog.action == "token.create",
        AuditLog.target == token_id,
    )
    result = await async_session.execute(query)
    event = result.scalar_one_or_none()
    assert event is not None


@pytest.mark.asyncio
async def test_token_delete_creates_audit_log(client, async_session):
    token = await sso_login(
        client,
        email="delete-token@example.com",
        username="delete-token",
        enterprise_id="ent-audit",
        team_id="team-audit",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {token}"}
    create_response = await client.post(
        "/api/v1/tokens",
        json={"name": "token-to-delete"},
        headers=headers,
    )
    assert create_response.status_code == 201
    token_id = create_response.json()["id"]
    delete_response = await client.delete(
        f"/api/v1/tokens/{token_id}",
        headers=headers,
    )
    assert delete_response.status_code == 204
    revoke_query = select(AuditLog).where(
        AuditLog.action == "token.revoke",
        AuditLog.target == token_id,
    )
    revoke_result = await async_session.execute(revoke_query)
    revoke_event = revoke_result.scalar_one_or_none()
    assert revoke_event is not None
