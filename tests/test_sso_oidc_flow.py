from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select

from backend.models.sso_auth_request import SSOAuthRequest
from backend.models.user import User
from backend.services.sso_oidc import SSOOIDCService


@pytest.mark.asyncio
async def test_sso_authorize_redirects_to_provider_with_pkce(client, async_session):
    response = await client.get("/api/v1/auth/sso/authorize", follow_redirects=False)

    assert response.status_code == 302
    location = response.headers["location"]
    parsed = urlparse(location)
    params = parse_qs(parsed.query)

    assert parsed.scheme == "https"
    assert parsed.netloc == "sso.example.com"
    assert parsed.path == "/oauth2/authorize"
    assert params["response_type"] == ["code"]
    assert params["client_id"] == ["skillhub-web"]
    assert params["redirect_uri"] == ["http://test/api/v1/auth/sso/callback"]
    assert params["code_challenge_method"] == ["S256"]
    assert params["scope"] == ["openid email profile"]
    assert params["state"]
    assert params["nonce"]
    assert params["code_challenge"]

    records = (await async_session.execute(select(SSOAuthRequest))).scalars().all()
    assert len(records) == 1
    assert records[0].used_at is None


@pytest.mark.asyncio
async def test_sso_callback_exchanges_code_and_redirects_with_app_tokens(client, async_session, monkeypatch):
    authorize = await client.get("/api/v1/auth/sso/authorize", follow_redirects=False)
    params = parse_qs(urlparse(authorize.headers["location"]).query)
    state = params["state"][0]
    nonce = params["nonce"][0]

    async def _fake_exchange(self, code: str, code_verifier: str):
        assert code == "auth-code-123"
        assert code_verifier
        return {"id_token": "oidc-id-token", "access_token": "provider-access-token"}

    async def _fake_decode(self, id_token: str):
        assert id_token == "oidc-id-token"
        return {
            "email": "oidc@example.com",
            "username": "oidc-user",
            "nonce": nonce,
            "enterprise_id": "ent-oidc",
            "team_id": "team-oidc",
            "role": "admin",
            "status": "active",
            "iat": 1704067200,
            "exp": 4102444800,
            "jti": "oidc-jti-123",
        }

    monkeypatch.setattr(SSOOIDCService, "exchange_code_for_tokens", _fake_exchange)
    monkeypatch.setattr(SSOOIDCService, "decode_id_token", _fake_decode)

    response = await client.get(
        "/api/v1/auth/sso/callback",
        params={"code": "auth-code-123", "state": state},
        follow_redirects=False,
    )

    assert response.status_code == 302
    parsed = urlparse(response.headers["location"])
    assert parsed.scheme == "http"
    assert parsed.netloc == "frontend.test"
    assert parsed.path == "/login/sso/callback"
    fragment = parse_qs(parsed.fragment)
    assert fragment["access_token"]
    assert fragment["refresh_token"]

    user = (await async_session.execute(select(User).where(User.email == "oidc@example.com"))).scalar_one()
    assert user.username == "oidc-user"
    assert user.enterprise_id == "ent-oidc"
    assert user.team_id == "team-oidc"
    assert user.role == "admin"

    auth_request = (await async_session.execute(select(SSOAuthRequest))).scalar_one()
    assert auth_request.used_at is not None


@pytest.mark.asyncio
async def test_sso_callback_invalid_state_redirects_with_error(client):
    response = await client.get(
        "/api/v1/auth/sso/callback",
        params={"code": "auth-code-123", "state": "missing-state"},
        follow_redirects=False,
    )

    assert response.status_code == 302
    parsed = urlparse(response.headers["location"])
    params = parse_qs(parsed.query)
    assert parsed.netloc == "frontend.test"
    assert params["error"] == ["sso_error"]
    assert params["error_description"] == ["SSO_STATE_INVALID"]
