import pytest
from datetime import datetime, timedelta, timezone

from skillhub.api.mcp import reset_mcp_session_provider, set_mcp_session_provider
from skillhub.repositories.token import TokenRepository
from skillhub.repositories.user import UserRepository
from skillhub.services.token import TokenService


@pytest.mark.asyncio
async def test_mcp_http_requires_auth(client):
    response = await client.post("/mcp")
    assert response.status_code == 401
    assert response.json()["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_mcp_sse_requires_auth(client):
    response = await client.get("/sse")
    assert response.status_code == 401
    assert response.json()["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_mcp_invalid_token_format_returns_code(client):
    response = await client.post("/mcp", headers={"Authorization": "Bearer invalid"})
    assert response.status_code == 401
    payload = response.json()
    assert payload["code"] == "INVALID_TOKEN_FORMAT"
    assert payload["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_mcp_token_not_found_returns_code(client, async_session):
    async def session_provider():
        yield async_session

    set_mcp_session_provider(session_provider)
    try:
        response = await client.post("/mcp", headers={"Authorization": "Bearer ask_live_" + "0" * 64})
        assert response.status_code == 401
        payload = response.json()
        assert payload["code"] == "TOKEN_NOT_FOUND"
        assert payload["timestamp"].endswith("Z")
    finally:
        reset_mcp_session_provider()


@pytest.mark.asyncio
async def test_mcp_token_revoked_returns_code(client, async_session):
    user_repo = UserRepository(async_session)
    user = await user_repo.create(email="revoked@example.com", username="revoked", password="pass1234")
    service = TokenService(TokenRepository(async_session), user_repo)
    token, value = await service.create_token_with_value(user, name="revoked")
    await service.token_repo.revoke(token)
    async def session_provider():
        yield async_session

    set_mcp_session_provider(session_provider)
    try:
        response = await client.post("/mcp", headers={"Authorization": f"Bearer {value}"})
        assert response.status_code == 401
        payload = response.json()
        assert payload["code"] == "TOKEN_REVOKED"
        assert payload["timestamp"].endswith("Z")
    finally:
        reset_mcp_session_provider()


@pytest.mark.asyncio
async def test_mcp_token_expired_returns_code(client, async_session):
    user_repo = UserRepository(async_session)
    user = await user_repo.create(email="expired@example.com", username="expired", password="pass1234")
    service = TokenService(TokenRepository(async_session), user_repo)
    expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    _, value = await service.create_token_with_value(user, name="expired", expires_at=expires_at)
    async def session_provider():
        yield async_session

    set_mcp_session_provider(session_provider)
    try:
        response = await client.post("/mcp", headers={"Authorization": f"Bearer {value}"})
        assert response.status_code == 401
        payload = response.json()
        assert payload["code"] == "TOKEN_EXPIRED"
        assert payload["timestamp"].endswith("Z")
    finally:
        reset_mcp_session_provider()


@pytest.mark.asyncio
async def test_mcp_valid_token_marks_used_once(client, async_session, monkeypatch):
    user_repo = UserRepository(async_session)
    user = await user_repo.create(email="used@example.com", username="used", password="pass1234")
    service = TokenService(TokenRepository(async_session), user_repo)
    token, value = await service.create_token_with_value(user, name="used")
    assert token.last_used_at is None

    calls = {"count": 0}
    original_mark_used = TokenRepository.mark_used

    async def wrapped_mark_used(self, token_obj):
        calls["count"] += 1
        return await original_mark_used(self, token_obj)

    monkeypatch.setattr(TokenRepository, "mark_used", wrapped_mark_used)

    async def session_provider():
        yield async_session

    set_mcp_session_provider(session_provider)
    try:
        await client.post("/mcp", headers={"Authorization": f"Bearer {value}"})
    finally:
        reset_mcp_session_provider()

    refreshed = await service.token_repo.get_by_id(token.id)
    assert refreshed is not None
    assert refreshed.last_used_at is not None
    assert calls["count"] == 1


@pytest.mark.asyncio
async def test_mcp_initialization_does_not_set_auth(monkeypatch):
    import sys
    import types

    import skillhub.api.mcp as mcp_module

    class Context:
        flow_dict = {}

    flowllm_context = types.ModuleType("flowllm.core.context")
    flowllm_context.C = Context()

    flowllm_flow = types.ModuleType("flowllm.core.flow")

    class BaseToolFlow:
        pass

    flowllm_flow.BaseToolFlow = BaseToolFlow

    flowllm_mcp_service = types.ModuleType("flowllm.core.service.mcp_service")

    class StubMcp:
        def __init__(self):
            self.auth = None

        def http_app(self, *args, **kwargs):
            async def app(scope, receive, send):
                return

            return app

    class MCPService:
        def __init__(self, service_config):
            self.service_config = service_config
            self.mcp = StubMcp()

        def integrate_tool_flow(self, flow):
            return None

    flowllm_mcp_service.MCPService = MCPService

    agentskills_main = types.ModuleType("skillhub.main")

    class SkillHubMcpApp:
        def __init__(self, *args, **kwargs):
            self.service_config = types.SimpleNamespace(metadata={})

        async def async_start(self):
            return None

        async def async_stop(self):
            return None

    agentskills_main.SkillHubMcpApp = SkillHubMcpApp

    monkeypatch.setitem(sys.modules, "flowllm.core.context", flowllm_context)
    monkeypatch.setitem(sys.modules, "flowllm.core.flow", flowllm_flow)
    monkeypatch.setitem(sys.modules, "flowllm.core.service.mcp_service", flowllm_mcp_service)
    monkeypatch.setitem(sys.modules, "skillhub.main", agentskills_main)

    await mcp_module.shutdown_mcp()
    await mcp_module.ensure_mcp_initialized()
    assert mcp_module._mcp_service is not None
    assert getattr(mcp_module._mcp_service.mcp, "auth", None) is None
    await mcp_module.shutdown_mcp()


@pytest.mark.asyncio
async def test_mcp_fallback_error_format():
    import httpx

    import skillhub.api.mcp as mcp_module

    app = mcp_module._build_fallback_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as session:
        response = await session.get("/any")
    assert response.status_code == 401
    payload = response.json()
    assert "detail" in payload
    assert "code" in payload
    assert "timestamp" in payload
