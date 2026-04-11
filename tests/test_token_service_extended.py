"""
Token Service 完整测试
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.token import TokenService
from backend.repositories.token import TokenRepository
from backend.repositories.user import UserRepository
from backend.models.token import APIToken
from backend.models.user import User
from backend.core.security.token import generate_api_token, hash_token


@pytest.fixture
def mock_token_repo():
    """Mock token repository"""
    return AsyncMock(spec=TokenRepository)


@pytest.fixture
def mock_user_repo():
    """Mock user repository"""
    return AsyncMock(spec=UserRepository)


@pytest.fixture
def test_user():
    """Create test user"""
    user = MagicMock(spec=User)
    user.id = "user-123"
    user.email = "test@example.com"
    user.username = "testuser"
    return user


@pytest.fixture
def test_token(test_user):
    """Create test token"""
    token = MagicMock(spec=APIToken)
    token.id = "token-123"
    token.user_id = test_user.id
    token.name = "Test Token"
    token.is_active = True
    token.expires_at = None
    return token


class TestTokenServiceCreate:
    """测试创建 Token"""

    @pytest.mark.asyncio
    async def test_create_token(self, mock_token_repo, mock_user_repo, test_user, test_token):
        """测试创建 Token"""
        mock_token_repo.create = AsyncMock(return_value=test_token)

        service = TokenService(mock_token_repo, mock_user_repo)
        result = await service.create_token(test_user, "New Token")

        mock_token_repo.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_token_with_expiry(self, mock_token_repo, mock_user_repo, test_user, test_token):
        """测试创建带过期时间的 Token"""
        mock_token_repo.create = AsyncMock(return_value=test_token)

        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        service = TokenService(mock_token_repo, mock_user_repo)
        result = await service.create_token(test_user, "Expiring Token", expires_at=expires_at)

        mock_token_repo.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_token_with_value(self, mock_token_repo, mock_user_repo, test_user, test_token):
        """测试创建并返回 Token 值"""
        mock_token_repo.create = AsyncMock(return_value=test_token)

        service = TokenService(mock_token_repo, mock_user_repo)
        token, value = await service.create_token_with_value(test_user, "Token With Value")

        mock_token_repo.create.assert_called_once()
        assert value is not None
        assert len(value) > 0


class TestTokenServiceList:
    """测试列出 Token"""

    @pytest.mark.asyncio
    async def test_list_tokens(self, mock_token_repo, mock_user_repo, test_user, test_token):
        """测试列出 Token"""
        mock_token_repo.list_by_user = AsyncMock(return_value=[test_token])

        service = TokenService(mock_token_repo, mock_user_repo)
        result = await service.list_tokens(test_user)

        assert len(result) == 1
        mock_token_repo.list_by_user.assert_called_once_with(test_user.id)


class TestTokenServiceRevoke:
    """测试撤销 Token"""

    @pytest.mark.asyncio
    async def test_revoke_token_success(self, mock_token_repo, mock_user_repo, test_user, test_token):
        """测试成功撤销 Token"""
        mock_token_repo.get_by_id = AsyncMock(return_value=test_token)
        mock_token_repo.revoke = AsyncMock()

        service = TokenService(mock_token_repo, mock_user_repo)
        result = await service.revoke_token(test_user, "token-123")

        assert result is True
        mock_token_repo.revoke.assert_called_once()

    @pytest.mark.asyncio
    async def test_revoke_token_not_found(self, mock_token_repo, mock_user_repo, test_user):
        """测试撤销不存在的 Token"""
        mock_token_repo.get_by_id = AsyncMock(return_value=None)

        service = TokenService(mock_token_repo, mock_user_repo)

        with pytest.raises(ValueError, match="Token not found"):
            await service.revoke_token(test_user, "non-existent")

    @pytest.mark.asyncio
    async def test_revoke_token_wrong_user(self, mock_token_repo, mock_user_repo, test_user, test_token):
        """测试撤销其他用户的 Token"""
        test_token.user_id = "different-user"
        mock_token_repo.get_by_id = AsyncMock(return_value=test_token)

        service = TokenService(mock_token_repo, mock_user_repo)

        with pytest.raises(ValueError, match="Token not found"):
            await service.revoke_token(test_user, "token-123")


class TestTokenServiceValidate:
    """测试验证 Token"""

    @pytest.mark.asyncio
    async def test_validate_token_success(self, mock_token_repo, mock_user_repo, test_token):
        """测试成功验证 Token"""
        token_value = generate_api_token()
        token_hash = hash_token(token_value)

        test_token.is_active = True
        test_token.expires_at = None

        mock_token_repo.get_by_hash = AsyncMock(return_value=test_token)
        mock_token_repo.mark_used = AsyncMock()

        service = TokenService(mock_token_repo, mock_user_repo)
        result = await service.validate_token(token_value)

        mock_token_repo.mark_used.assert_called_once()

    @pytest.mark.asyncio
    async def test_validate_token_not_found(self, mock_token_repo, mock_user_repo):
        """测试验证不存在的 Token"""
        mock_token_repo.get_by_hash = AsyncMock(return_value=None)

        service = TokenService(mock_token_repo, mock_user_repo)

        with pytest.raises(ValueError, match="Token not found"):
            await service.validate_token("invalid-token")

    @pytest.mark.asyncio
    async def test_validate_token_revoked(self, mock_token_repo, mock_user_repo, test_token):
        """测试验证已撤销的 Token"""
        token_value = generate_api_token()

        test_token.is_active = False

        mock_token_repo.get_by_hash = AsyncMock(return_value=test_token)

        service = TokenService(mock_token_repo, mock_user_repo)

        with pytest.raises(ValueError, match="Token revoked"):
            await service.validate_token(token_value)

    @pytest.mark.asyncio
    async def test_validate_token_expired(self, mock_token_repo, mock_user_repo, test_token):
        """测试验证已过期的 Token"""
        token_value = generate_api_token()

        test_token.is_active = True
        test_token.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)

        mock_token_repo.get_by_hash = AsyncMock(return_value=test_token)

        service = TokenService(mock_token_repo, mock_user_repo)

        with pytest.raises(ValueError, match="Token expired"):
            await service.validate_token(token_value)

    @pytest.mark.asyncio
    async def test_validate_token_expired_no_tz(self, mock_token_repo, mock_user_repo, test_token):
        """测试验证无时区信息的过期 Token"""
        token_value = generate_api_token()

        test_token.is_active = True
        # expires_at without timezone - set to past time
        test_token.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)

        mock_token_repo.get_by_hash = AsyncMock(return_value=test_token)

        service = TokenService(mock_token_repo, mock_user_repo)

        with pytest.raises(ValueError, match="Token expired"):
            await service.validate_token(token_value)

    @pytest.mark.asyncio
    async def test_validate_token_not_expired(self, mock_token_repo, mock_user_repo, test_token):
        """测试验证未过期的 Token"""
        token_value = generate_api_token()

        test_token.is_active = True
        test_token.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        mock_token_repo.get_by_hash = AsyncMock(return_value=test_token)
        mock_token_repo.mark_used = AsyncMock()

        service = TokenService(mock_token_repo, mock_user_repo)
        result = await service.validate_token(token_value)

        mock_token_repo.mark_used.assert_called_once()


class TestTokenServiceHashing:
    """测试 Token 哈希"""

    def test_hash_token_consistent(self):
        """测试哈希一致性"""
        token = "test-token-value"
        hash1 = hash_token(token)
        hash2 = hash_token(token)
        assert hash1 == hash2

    def test_hash_token_different(self):
        """测试不同 Token 哈希不同"""
        hash1 = hash_token("token1")
        hash2 = hash_token("token2")
        assert hash1 != hash2

    def test_generate_api_token_unique(self):
        """测试生成唯一 Token"""
        token1 = generate_api_token()
        token2 = generate_api_token()
        assert token1 != token2
