import os
import jwt
import pytest
from sqlalchemy import select

from skillhub.models.audit_log import AuditLog


async def _sso_login(client, email, username, role="admin"):
    payload = {
        "email": email,
        "username": username,
        "enterprise_id": "ent-audit",
        "team_id": "team-audit",
        "role": role,
        "status": "active",
        "iss": os.environ["SSO_JWT_ISSUER"],
        "aud": os.environ["SSO_JWT_AUDIENCE"],
    }
    token = jwt.encode(payload, os.environ["SSO_JWT_SECRET"], algorithm="HS256")
    response = await client.post("/api/v1/auth/sso/login", json={"id_token": token})
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.mark.asyncio
async def test_user_delete_creates_audit_log(client, async_session):
    token = await _sso_login(client, "delete-user@example.com", "delete-user")
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
    token = await _sso_login(client, "update-skill@example.com", "update-skill")
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
    token = await _sso_login(client, "delete-skill@example.com", "delete-skill")
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
    token = await _sso_login(client, "create-token@example.com", "create-token")
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
    token = await _sso_login(client, "delete-token@example.com", "delete-token")
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
