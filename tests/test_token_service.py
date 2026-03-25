import pytest

from backend.repositories.token import TokenRepository
from backend.repositories.user import UserRepository
from backend.services.token import TokenService


@pytest.mark.asyncio
async def test_create_list_revoke_token(async_session):
    user_repo = UserRepository(async_session)
    token_repo = TokenRepository(async_session)
    token_service = TokenService(token_repo, user_repo)
    user = await user_repo.create(email="d_token@example.com", username="userd_token", password="pass1234")
    created = await token_service.create_token(user, name="default")
    tokens = await token_service.list_tokens(user)
    assert len(tokens) == 1
    revoked = await token_service.revoke_token(user, created.id)
    assert revoked is True
    tokens_after = await token_service.list_tokens(user)
    assert tokens_after[0].is_active is False
