import os
from datetime import datetime, timedelta, timezone

import jwt


async def prepare_sso_nonce(client) -> str:
    response = await client.post("/api/v1/auth/sso/prepare")
    assert response.status_code == 200
    return response.json()["nonce"]


def create_sso_token(
    *,
    nonce: str,
    email: str,
    username: str,
    enterprise_id: str | None = None,
    team_id: str | None = None,
    role: str = "member",
    status: str = "active",
    extra_claims: dict | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "email": email,
        "username": username,
        "nonce": nonce,
        "exp": now + timedelta(hours=1),
        "iat": now,
        "iss": os.environ["SSO_JWT_ISSUER"],
        "aud": os.environ["SSO_JWT_AUDIENCE"],
        "role": role,
        "status": status,
    }
    if enterprise_id is not None:
        payload["enterprise_id"] = enterprise_id
    if team_id is not None:
        payload["team_id"] = team_id
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, os.environ["SSO_JWT_SECRET"], algorithm="HS256")


async def sso_login(
    client,
    *,
    email: str,
    username: str,
    enterprise_id: str | None = None,
    team_id: str | None = None,
    role: str = "member",
    status: str = "active",
    extra_claims: dict | None = None,
) -> str:
    nonce = await prepare_sso_nonce(client)
    token = create_sso_token(
        nonce=nonce,
        email=email,
        username=username,
        enterprise_id=enterprise_id,
        team_id=team_id,
        role=role,
        status=status,
        extra_claims=extra_claims,
    )
    response = await client.post("/api/v1/auth/sso/login", json={"id_token": token, "nonce": nonce})
    assert response.status_code == 200
    return response.json()["access_token"]
