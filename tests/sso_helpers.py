from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from backend.core.security.user_state import DEFAULT_USER_STATUS
from backend.services.sso_oidc import SSOOIDCService


def build_sso_claims(
    *,
    nonce: str,
    email: str,
    username: str,
    enterprise_id: str | None = None,
    team_id: str | None = None,
    role: str = "member",
    status: str = DEFAULT_USER_STATUS,
    extra_claims: dict | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    payload = {
        "email": email,
        "username": username,
        "nonce": nonce,
        "exp": int((now + timedelta(hours=1)).timestamp()),
        "iat": int(now.timestamp()),
        "role": role,
        "status": status,
        "jti": f"jti-{email}",
    }
    if enterprise_id is not None:
        payload["enterprise_id"] = enterprise_id
    if team_id is not None:
        payload["team_id"] = team_id
    if extra_claims:
        payload.update(extra_claims)
    return payload


async def sso_login(
    client,
    *,
    email: str,
    username: str,
    enterprise_id: str | None = None,
    team_id: str | None = None,
    role: str = "member",
    status: str = DEFAULT_USER_STATUS,
    extra_claims: dict | None = None,
) -> str:
    authorize = await client.get("/api/v1/auth/sso/authorize", follow_redirects=False)
    assert authorize.status_code == 302
    params = parse_qs(urlparse(authorize.headers["location"]).query)
    nonce = params["nonce"][0]
    state = params["state"][0]
    claims = build_sso_claims(
        nonce=nonce,
        email=email,
        username=username,
        enterprise_id=enterprise_id,
        team_id=team_id,
        role=role,
        status=status,
        extra_claims=extra_claims,
    )

    async def _fake_exchange(self, code: str, code_verifier: str):
        return {"id_token": "test-id-token", "access_token": "provider-access-token"}

    async def _fake_decode(self, id_token: str):
        return claims

    with patch.object(SSOOIDCService, "exchange_code_for_tokens", _fake_exchange), patch.object(
        SSOOIDCService, "decode_id_token", _fake_decode
    ):
        response = await client.get(
            "/api/v1/auth/sso/callback",
            params={"code": "test-auth-code", "state": state},
            follow_redirects=False,
        )
    assert response.status_code == 302
    fragment = parse_qs(urlparse(response.headers["location"]).fragment)
    return fragment["access_token"][0]


async def create_api_token(
    client,
    access_token: str,
    *,
    name: str = "test-client-token",
) -> str:
    response = await client.post(
        "/api/v1/tokens",
        json={"name": name},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 201
    return response.json()["token"]
