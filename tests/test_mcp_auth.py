import pytest

from skillhub.api.mcp.auth import ApiTokenVerifier, reset_session_provider, set_session_provider
from skillhub.core.utils.user_context import get_current_user_id, set_current_user_id
from skillhub.repositories.token import TokenRepository
from skillhub.repositories.user import UserRepository
from skillhub.services.token import TokenService


@pytest.mark.asyncio
async def test_api_token_verifier_rejects_invalid_format(async_session):
    async def session_provider():
        yield async_session

    set_session_provider(session_provider)
    verifier = ApiTokenVerifier()
    assert await verifier.verify_token("invalid_token") is None
    reset_session_provider()


@pytest.mark.asyncio
async def test_api_token_verifier_accepts_valid_token(async_session):
    user_repo = UserRepository(async_session)
    user = await user_repo.create(email="user@example.com", username="user", password="password")
    service = TokenService(TokenRepository(async_session), user_repo)
    _, token_value = await service.create_token_with_value(user, name="test")

    async def session_provider():
        yield async_session

    set_session_provider(session_provider)
    verifier = ApiTokenVerifier()
    result = await verifier.verify_token(token_value)
    assert result is not None
    assert result.client_id == str(user.id)
    assert get_current_user_id() == str(user.id)
    set_current_user_id(None)
    reset_session_provider()
