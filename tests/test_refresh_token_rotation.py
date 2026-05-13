from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import select

from backend.config.settings import settings
from backend.models.audit_log import AuditLog
from backend.models.refresh_token import RefreshTokenSession
from backend.models.user import User
from backend.repositories.refresh_token import REFRESH_TOKEN_STATUS_REVOKED, RefreshTokenRepository


async def _register_and_login(client, email: str, username: str) -> dict:
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": email, "purpose": "register"},
    )
    register = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "username": username, "code": "123456"},
    )
    assert register.status_code == 201
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": email, "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "code": "123456"},
    )
    assert login.status_code == 200
    return login.json()


@pytest.mark.asyncio
async def test_refresh_token_rotates_once_and_rejects_reuse(client):
    token_pair = await _register_and_login(client, "rotate@example.com", "rotate-user")
    original_refresh_token = token_pair["refresh_token"]

    first_refresh = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original_refresh_token},
    )
    assert first_refresh.status_code == 200
    first_refresh_payload = first_refresh.json()
    assert first_refresh_payload["refresh_token"] != original_refresh_token

    reused = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original_refresh_token},
    )
    assert reused.status_code == 401

    next_refresh = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_refresh_payload["refresh_token"]},
    )
    assert next_refresh.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_reuse_revokes_current_access_token(client, async_session):
    token_pair = await _register_and_login(client, "reuse@example.com", "reuse-user")
    original_refresh_token = token_pair["refresh_token"]

    first_refresh = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original_refresh_token},
    )
    assert first_refresh.status_code == 200
    access_token_from_rotated_session = first_refresh.json()["access_token"]

    reused = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original_refresh_token},
    )
    assert reused.status_code == 401

    protected = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {access_token_from_rotated_session}"},
    )
    assert protected.status_code == 401
    assert protected.json()["detail"] == "Token revoked"

    result = await async_session.execute(
        select(AuditLog).where(AuditLog.action == "auth.refresh.reuse_detected")
    )
    event = result.scalar_one_or_none()
    assert event is not None


@pytest.mark.asyncio
async def test_legacy_refresh_token_without_rotation_claims_is_rejected(client, async_session):
    await _register_and_login(client, "legacy-refresh@example.com", "legacy-refresh-user")
    result = await async_session.execute(
        select(User).where(User.email == "legacy-refresh@example.com")
    )
    user = result.scalar_one()
    expires_at = datetime.now(timezone.utc) + timedelta(days=1)
    legacy_refresh_token = jwt.encode(
        {
            "sub": str(user.id),
            "type": "refresh",
            "exp": expires_at,
            "ver": user.jwt_token_version,
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": legacy_refresh_token},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_session_stores_hash_not_raw_token(client, async_session):
    token_pair = await _register_and_login(client, "hash-only@example.com", "hash-only-user")
    raw_refresh_token = token_pair["refresh_token"]
    result = await async_session.execute(
        select(User).where(User.email == "hash-only@example.com")
    )
    user = result.scalar_one()

    expected_hash = RefreshTokenRepository.hash_token(raw_refresh_token)
    token_result = await async_session.execute(
        select(RefreshTokenSession).where(
            RefreshTokenSession.user_id == user.id,
            RefreshTokenSession.token_hash == expected_hash,
        )
    )
    token_session = token_result.scalar_one()

    assert token_session.token_hash != raw_refresh_token
    assert len(token_session.token_hash) == 64
    assert raw_refresh_token not in {
        token_session.token_hash,
        token_session.jti,
        token_session.family_id,
    }
    all_sessions_result = await async_session.execute(
        select(RefreshTokenSession).where(RefreshTokenSession.user_id == user.id)
    )
    assert all(raw_refresh_token != session.token_hash for session in all_sessions_result.scalars().all())


@pytest.mark.asyncio
async def test_logout_revokes_stored_refresh_token_sessions(client, async_session):
    token_pair = await _register_and_login(client, "logout-rotation@example.com", "logout-rotation")
    access_token = token_pair["access_token"]
    refresh_token = token_pair["refresh_token"]

    logout = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert logout.status_code == 200

    result = await async_session.execute(
        select(User).where(User.email == "logout-rotation@example.com")
    )
    user = result.scalar_one()
    token_result = await async_session.execute(
        select(RefreshTokenSession).where(RefreshTokenSession.user_id == user.id)
    )
    sessions = list(token_result.scalars().all())
    assert sessions
    assert {session.status for session in sessions} == {REFRESH_TOKEN_STATUS_REVOKED}

    refreshed = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refreshed.status_code == 401
