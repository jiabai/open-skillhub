import os

import jwt
import pytest
from sso_helpers import prepare_sso_nonce


@pytest.mark.asyncio
async def test_sso_login_creates_user_with_org_fields(client):
    nonce = await prepare_sso_nonce(client)
    payload = {
        "email": "sso@example.com",
        "username": "sso-user",
        "nonce": nonce,
        "enterprise_id": "ent-1",
        "team_id": "team-1",
        "role": "admin",
        "status": "active",
        "exp": 4102444800,
        "iat": 1704067200,
        "iss": os.environ["SSO_JWT_ISSUER"],
        "aud": os.environ["SSO_JWT_AUDIENCE"],
    }
    token = jwt.encode(payload, os.environ["SSO_JWT_SECRET"], algorithm="HS256")
    response = await client.post("/api/v1/auth/sso/login", json={"id_token": token, "nonce": nonce})
    assert response.status_code == 200
    access_token = response.json()["access_token"]
    me_response = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_response.status_code == 200
    data = me_response.json()
    assert data["enterprise_id"] == "ent-1"
    assert data["team_id"] == "team-1"
    assert data["role"] == "admin"
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_sso_login_rejects_replayed_token(client):
    nonce = await prepare_sso_nonce(client)
    payload = {
        "email": "replay@example.com",
        "username": "replay-user",
        "nonce": nonce,
        "exp": 4102444800,
        "iat": 1704067200,
        "iss": os.environ["SSO_JWT_ISSUER"],
        "aud": os.environ["SSO_JWT_AUDIENCE"],
    }
    token = jwt.encode(payload, os.environ["SSO_JWT_SECRET"], algorithm="HS256")
    first = await client.post("/api/v1/auth/sso/login", json={"id_token": token, "nonce": nonce})
    assert first.status_code == 200
    second = await client.post("/api/v1/auth/sso/login", json={"id_token": token, "nonce": nonce})
    assert second.status_code == 401
