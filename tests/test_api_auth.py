import httpx
import pytest
from sqlalchemy import select

from backend.api_app import create_application
from backend.config.settings import settings
from backend.core.security.user_state import DEFAULT_USER_STATUS, UserStatus
from backend.models.audit_log import AuditLog
from backend.models.user import User
from backend.repositories.user import UserRepository
from backend.services.auth import AuthService
from sso_helpers import sso_login


@pytest.mark.asyncio
async def test_register_login_refresh(client):
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "api@example.com", "purpose": "register"},
    )
    register = await client.post(
        "/api/v1/auth/register",
        json={"email": "api@example.com", "username": "apiuser", "code": "123456"},
    )
    assert register.status_code == 201
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "api@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "api@example.com", "code": "123456"},
    )
    assert login.status_code == 200
    payload = login.json()
    assert "access_token" in payload
    assert "refresh_token" in payload
    assert "token_type" not in payload
    refresh_token = payload["refresh_token"]
    refreshed = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 200
    refreshed_payload = refreshed.json()
    assert "access_token" in refreshed_payload
    assert "refresh_token" in refreshed_payload
    assert refreshed_payload["refresh_token"] != ""
    assert "token_type" not in refreshed_payload


@pytest.mark.asyncio
async def test_refresh_requires_token(client):
    response = await client.post("/api/v1/auth/refresh", json={})
    assert response.status_code == 422
    payload = response.json()
    assert "detail" in payload
    assert isinstance(payload["detail"], str)
    assert "code" in payload
    assert "timestamp" in payload
    assert payload["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_verification_code_response_contains_limits(client):
    response = await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "code@example.com", "purpose": "login"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["sent"] is True
    assert payload["expires_in"] > 0
    assert payload["resend_interval"] > 0
    assert payload["max_attempts"] > 0
    assert payload["attempts_left"] == payload["max_attempts"]


@pytest.mark.asyncio
async def test_verification_code_creates_audit_log(client, async_session):
    response = await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "audit-code@example.com", "purpose": "login"},
    )
    assert response.status_code == 200
    query = select(AuditLog).where(
        AuditLog.action == "auth.verification_code.send",
        AuditLog.target == "audit-code@example.com",
    )
    result = await async_session.execute(query)
    event = result.scalar_one_or_none()
    assert event is not None


@pytest.mark.asyncio
async def test_login_invalid_credentials_format(client, async_session):
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "bad@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "bad@example.com", "username": "baduser", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "bad@example.com", "purpose": "login"},
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "bad@example.com", "code": "000000"},
    )
    assert response.status_code == 401
    payload = response.json()
    assert "detail" in payload
    assert payload["code"] == "CODE_INVALID"
    assert "timestamp" in payload
    assert payload["timestamp"].endswith("Z")
    query = select(AuditLog).where(
        AuditLog.action == "auth.login.failed",
        AuditLog.target == "bad@example.com",
    )
    result = await async_session.execute(query)
    event = result.scalar_one_or_none()
    assert event is not None


@pytest.mark.asyncio
async def test_refresh_invalid_token_creates_audit_log(client, async_session):
    response = await client.post("/api/v1/auth/refresh", json={"refresh_token": "invalid.token.value"})
    assert response.status_code == 401
    query = select(AuditLog).where(
        AuditLog.action == "auth.refresh.failed",
        AuditLog.target == "unknown",
    )
    result = await async_session.execute(query)
    event = result.scalar_one_or_none()
    assert event is not None


@pytest.mark.asyncio
async def test_logout_revokes_existing_access_and_refresh_tokens(client, async_session):
    user_repo = UserRepository(async_session)
    auth_service = AuthService(user_repo)
    user = await auth_service.register(
        email="logout@example.com",
        username="logoutuser",
        password="pass1234",
    )
    token_pair = auth_service.issue_token(user)
    access_token = token_pair.access_token
    refresh_token = token_pair.refresh_token
    headers = {"Authorization": f"Bearer {access_token}"}

    logout = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout.status_code == 200

    listed = await client.get("/api/v1/tokens", headers=headers)
    assert listed.status_code == 401
    assert listed.json()["detail"] == "Token revoked"

    refreshed = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 401
    assert refreshed.json()["detail"] == "Token revoked"


@pytest.mark.asyncio
async def test_login_does_not_auto_register_when_public_signup_disabled(client, async_session, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_PUBLIC_SIGNUP", False)
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "blocked-signup@example.com", "purpose": "login"},
    )

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "blocked-signup@example.com", "code": "123456"},
    )

    assert login.status_code == 403
    result = await async_session.execute(select(User).where(User.email == "blocked-signup@example.com"))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_user_with_inactive_status_cannot_access_authenticated_endpoints(client, async_session):
    access_token = await sso_login(
        client,
        email="inactive-status@example.com",
        username="inactive-status",
        enterprise_id="ent-inactive",
        team_id="team-inactive",
        role="member",
        status=DEFAULT_USER_STATUS,
    )
    user_repo = UserRepository(async_session)
    user = await user_repo.get_by_email("inactive-status@example.com")
    assert user is not None
    await user_repo.update(user, status=UserStatus.INACTIVE)

    response = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Inactive user"


@pytest.mark.asyncio
async def test_rate_limit_enforced():
    original_requests = settings.RATE_LIMIT_REQUESTS
    original_window = settings.RATE_LIMIT_WINDOW
    settings.RATE_LIMIT_REQUESTS = 1
    settings.RATE_LIMIT_WINDOW = 60
    app = create_application()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as session:
        first = await session.get("/health")
        second = await session.get("/health")
    settings.RATE_LIMIT_REQUESTS = original_requests
    settings.RATE_LIMIT_WINDOW = original_window
    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json()["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_health_returns_minimal_payload(client):
    response = await client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["db_connected"] is True


@pytest.mark.asyncio
async def test_livez_returns_alive_status(client):
    response = await client.get("/livez")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


@pytest.mark.asyncio
async def test_readyz_returns_minimal_payload(client):
    response = await client.get("/readyz")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["db_connected"] is True


@pytest.mark.asyncio
async def test_readyz_reports_db_failure(monkeypatch):
    from backend import api_app

    class BrokenConnection:
        async def __aenter__(self):
            raise RuntimeError("db down")

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class BrokenEngine:
        def connect(self):
            return BrokenConnection()

    monkeypatch.setattr(api_app, "engine", BrokenEngine())
    app = create_application()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as session:
        response = await session.get("/readyz")
    assert response.status_code == 503
    payload = response.json()
    assert payload["status"] == "unhealthy"
    assert payload["db_connected"] is False


@pytest.mark.asyncio
async def test_health_ignores_db_failure(monkeypatch):
    from backend import api_app

    class BrokenConnection:
        async def __aenter__(self):
            raise RuntimeError("db down")

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class BrokenEngine:
        def connect(self):
            return BrokenConnection()

    monkeypatch.setattr(api_app, "engine", BrokenEngine())
    app = create_application()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as session:
        response = await session.get("/health")
    assert response.status_code == 503
    payload = response.json()
    assert payload["status"] == "unhealthy"
    assert payload["db_connected"] is False


@pytest.mark.asyncio
async def test_unhandled_exception_uses_error_format(app):
    async def boom():
        raise RuntimeError("boom")

    app.add_api_route("/boom", boom, methods=["GET"])
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as session:
        response = await session.get("/boom")
    assert response.status_code == 500
    payload = response.json()
    assert "detail" in payload
    assert "code" in payload
    assert "timestamp" in payload
    assert payload["detail"] == "Internal Server Error"
    assert payload["code"] == "INTERNAL_SERVER_ERROR"
    assert payload["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_logging_middleware_records_request(client, monkeypatch):
    from backend.core.middleware import logging as logging_middleware

    captured = []

    def fake_info(message: str, *args, **kwargs):
        captured.append(message)

    monkeypatch.setattr(logging_middleware.logger, "info", fake_info)
    response = await client.get("/health")
    assert response.status_code == 200
    assert any("GET /health" in message for message in captured)


def test_loguru_writes_to_configured_file(tmp_path):
    original_log_file = settings.LOG_FILE
    original_log_level = settings.LOG_LEVEL
    original_log_format = settings.LOG_FORMAT
    settings.LOG_FILE = str(tmp_path / "app.log")
    settings.LOG_LEVEL = "INFO"
    settings.LOG_FORMAT = "json"
    try:
        create_application()
        from loguru import logger

        logger.info("log-test-message")
        content = (tmp_path / "app.log").read_text(encoding="utf-8")
        assert "log-test-message" in content
    finally:
        settings.LOG_FILE = original_log_file
        settings.LOG_LEVEL = original_log_level
        settings.LOG_FORMAT = original_log_format
