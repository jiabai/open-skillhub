"""
AuthService 完整流程测试
"""
import jwt
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.config.settings import settings
from backend.models.user import User
from backend.repositories.user import UserRepository
from backend.services.auth import AuthService, TokenPair


@pytest.fixture
def mock_user_repo():
    """Mock user repository"""
    repo = AsyncMock(spec=UserRepository)
    return repo


@pytest.fixture
def test_user():
    """Create test user"""
    user = MagicMock(spec=User)
    user.id = "user-123"
    user.email = "test@example.com"
    user.username = "testuser"
    user.is_active = True
    user.enterprise_id = None
    user.team_id = None
    user.role = "user"
    user.status = "active"
    return user


class TestAuthServiceRegister:
    """测试注册功能"""

    @pytest.mark.asyncio
    async def test_register_success(self, mock_user_repo):
        """测试成功注册"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)
        mock_user_repo.get_by_username = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "new-user-123"
        new_user.email = "new@example.com"
        new_user.username = "newuser"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)
        result = await service.register("new@example.com", "newuser", "password123")

        assert result.email == "new@example.com"

    @pytest.mark.asyncio
    async def test_register_email_exists(self, mock_user_repo, test_user):
        """测试邮箱已存在"""
        mock_user_repo.get_by_email = AsyncMock(return_value=test_user)
        service = AuthService(mock_user_repo)

        with pytest.raises(ValueError, match="Email already registered"):
            await service.register("test@example.com", "newuser", "password")

    @pytest.mark.asyncio
    async def test_register_username_exists(self, mock_user_repo, test_user):
        """测试用户名已存在"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)
        mock_user_repo.get_by_username = AsyncMock(return_value=test_user)
        service = AuthService(mock_user_repo)

        with pytest.raises(ValueError, match="Username already registered"):
            await service.register("new@example.com", "testuser", "password")

    @pytest.mark.asyncio
    async def test_register_auto_password(self, mock_user_repo):
        """测试自动生成密码"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)
        mock_user_repo.get_by_username = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "new-user-123"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)
        await service.register("new@example.com", "newuser", None)

        call_args = mock_user_repo.create.call_args
        assert call_args.kwargs["password"] is not None


class TestAuthServiceSSOLogin:
    """测试 SSO 登录"""

    def _create_sso_token(self, email="sso@example.com", username="ssouser", **extra):
        """创建测试 SSO token"""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "sso-user-123",
            "email": email,
            "username": username,
            "nonce": "test-sso-nonce",
            "exp": now + timedelta(hours=1),
            "iat": now,
            "iss": settings.SSO_JWT_ISSUER,
            "aud": settings.SSO_JWT_AUDIENCE,
            **extra
        }
        return jwt.encode(payload, settings.SSO_JWT_SECRET, algorithm=settings.SSO_JWT_ALGORITHM)

    @pytest.mark.asyncio
    async def test_sso_login_new_user(self, mock_user_repo):
        """测试 SSO 登录新用户"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "sso-user-123"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)
        token = self._create_sso_token()
        result = await service.login_sso(token)

        assert isinstance(result, TokenPair)

    @pytest.mark.asyncio
    async def test_sso_login_existing_user(self, mock_user_repo, test_user):
        """测试 SSO 登录已有用户"""
        mock_user_repo.get_by_email = AsyncMock(return_value=test_user)
        mock_user_repo.update = AsyncMock(return_value=test_user)

        service = AuthService(mock_user_repo)
        token = self._create_sso_token(email="test@example.com")
        result = await service.login_sso(token)

        assert isinstance(result, TokenPair)

    @pytest.mark.asyncio
    async def test_sso_login_with_org_info(self, mock_user_repo):
        """测试带组织信息的 SSO 登录"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "sso-user-123"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)
        token = self._create_sso_token(
            enterprise_id="ent-123",
            team_id="team-456",
            role="admin",
            status="active"
        )
        result = await service.login_sso(token)

        call_args = mock_user_repo.create.call_args
        assert call_args.kwargs["enterprise_id"] == "ent-123"
        assert call_args.kwargs["team_id"] == "team-456"
        assert call_args.kwargs["role"] == "admin"

    @pytest.mark.asyncio
    async def test_sso_login_invalid_token(self, mock_user_repo):
        """测试无效 token"""
        service = AuthService(mock_user_repo)

        with pytest.raises(Exception):
            await service.login_sso("invalid.token")

    @pytest.mark.asyncio
    async def test_sso_login_expired_token(self, mock_user_repo):
        """测试过期 token"""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "sso-user-123",
            "email": "sso@example.com",
            "username": "ssouser",
            "nonce": "test-sso-nonce",
            "exp": now - timedelta(hours=1),
            "iat": now - timedelta(hours=2),
            "iss": settings.SSO_JWT_ISSUER,
            "aud": settings.SSO_JWT_AUDIENCE,
        }
        token = jwt.encode(payload, settings.SSO_JWT_SECRET, algorithm=settings.SSO_JWT_ALGORITHM)

        service = AuthService(mock_user_repo)

        with pytest.raises(Exception):
            await service.login_sso(token)

    @pytest.mark.asyncio
    async def test_sso_login_wrong_secret(self, mock_user_repo):
        """测试错误密钥"""
        token = self._create_sso_token()
        service = AuthService(mock_user_repo)

        # 使用不同的密钥解码会失败
        with pytest.raises(Exception):
            # 手动创建使用错误密钥的 token
            now = datetime.now(timezone.utc)
            payload = {
                "sub": "sso-user-123",
                "email": "sso@example.com",
                "username": "ssouser",
                "nonce": "test-sso-nonce",
                "exp": now + timedelta(hours=1),
                "iat": now,
                "iss": settings.SSO_JWT_ISSUER,
                "aud": settings.SSO_JWT_AUDIENCE,
            }
            wrong_token = jwt.encode(
                payload,
                "wrong-secret-key-at-least-32chars",
                algorithm=settings.SSO_JWT_ALGORITHM,
            )
            await service.login_sso(wrong_token)

    @pytest.mark.asyncio
    async def test_sso_login_missing_email(self, mock_user_repo):
        """测试缺少邮箱"""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "sso-user-123",
            "username": "ssouser",
            "nonce": "test-sso-nonce",
            "exp": now + timedelta(hours=1),
            "iat": now,
            "iss": settings.SSO_JWT_ISSUER,
            "aud": settings.SSO_JWT_AUDIENCE,
        }
        token = jwt.encode(payload, settings.SSO_JWT_SECRET, algorithm=settings.SSO_JWT_ALGORITHM)

        service = AuthService(mock_user_repo)

        with pytest.raises(ValueError, match="Invalid SSO token"):
            await service.login_sso(token)

    @pytest.mark.asyncio
    async def test_sso_login_empty_email(self, mock_user_repo):
        """测试空邮箱"""
        token = self._create_sso_token(email="   ")
        service = AuthService(mock_user_repo)

        with pytest.raises(ValueError, match="Invalid SSO token"):
            await service.login_sso(token)

    @pytest.mark.asyncio
    async def test_sso_login_username_from_email(self, mock_user_repo):
        """测试从邮箱提取用户名"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "sso-user-123"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        now = datetime.now(timezone.utc)
        payload = {
            "sub": "sso-user-123",
            "email": "john.doe@example.com",
            "nonce": "test-sso-nonce",
            "exp": now + timedelta(hours=1),
            "iat": now,
            "iss": settings.SSO_JWT_ISSUER,
            "aud": settings.SSO_JWT_AUDIENCE,
        }
        token = jwt.encode(payload, settings.SSO_JWT_SECRET, algorithm=settings.SSO_JWT_ALGORITHM)

        service = AuthService(mock_user_repo)
        await service.login_sso(token)

        call_args = mock_user_repo.create.call_args
        assert call_args.kwargs["username"] == "john.doe"


class TestAuthServiceRefreshToken:
    """测试 Token 刷新"""

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, mock_user_repo, test_user):
        """测试成功刷新"""
        mock_user_repo.get_by_id = AsyncMock(return_value=test_user)

        service = AuthService(mock_user_repo)

        from backend.core.security.jwt_utils import create_refresh_token
        refresh_token = create_refresh_token(subject=str(test_user.id))

        result = await service.refresh_token(refresh_token)

        assert isinstance(result, TokenPair)

    @pytest.mark.asyncio
    async def test_refresh_token_wrong_type(self, mock_user_repo, test_user):
        """测试使用 access token"""
        mock_user_repo.get_by_id = AsyncMock(return_value=test_user)

        service = AuthService(mock_user_repo)

        from backend.core.security.jwt_utils import create_access_token
        access_token = create_access_token(subject=str(test_user.id))

        with pytest.raises(ValueError, match="Invalid token type"):
            await service.refresh_token(access_token)

    @pytest.mark.asyncio
    async def test_refresh_token_user_not_found(self, mock_user_repo):
        """测试用户不存在"""
        mock_user_repo.get_by_id = AsyncMock(return_value=None)

        service = AuthService(mock_user_repo)

        from backend.core.security.jwt_utils import create_refresh_token
        refresh_token = create_refresh_token(subject="non-existent")

        with pytest.raises(ValueError, match="User not found"):
            await service.refresh_token(refresh_token)

    @pytest.mark.asyncio
    async def test_refresh_token_user_inactive(self, mock_user_repo, test_user):
        """测试用户已停用"""
        test_user.is_active = False
        mock_user_repo.get_by_id = AsyncMock(return_value=test_user)

        service = AuthService(mock_user_repo)

        from backend.core.security.jwt_utils import create_refresh_token
        refresh_token = create_refresh_token(subject=str(test_user.id))

        with pytest.raises(ValueError, match="User not found"):
            await service.refresh_token(refresh_token)

    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, mock_user_repo):
        """测试无效 token"""
        service = AuthService(mock_user_repo)

        with pytest.raises(Exception):
            await service.refresh_token("invalid.token")

    @pytest.mark.asyncio
    async def test_refresh_token_missing_subject(self, mock_user_repo):
        """测试缺少 subject"""
        service = AuthService(mock_user_repo)

        now = datetime.now(timezone.utc)
        payload = {
            "type": "refresh",
            "exp": now + timedelta(hours=1),
            "iat": now,
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

        with pytest.raises(ValueError, match="Invalid token"):
            await service.refresh_token(token)


class TestAuthServiceIssueToken:
    """测试发放 Token"""

    @pytest.mark.asyncio
    async def test_issue_token(self, mock_user_repo, test_user):
        """测试发放 token"""
        service = AuthService(mock_user_repo)
        result = service.issue_token(test_user)

        assert isinstance(result, TokenPair)
        assert result.access_token
        assert result.refresh_token

    @pytest.mark.asyncio
    async def test_token_contains_user_id(self, mock_user_repo, test_user):
        """测试 token 包含用户 ID"""
        service = AuthService(mock_user_repo)
        result = service.issue_token(test_user)

        from backend.core.security.jwt_utils import decode_token
        payload = decode_token(result.access_token)

        assert payload.get("sub") == str(test_user.id)
        assert payload.get("type") == "access"


class TestAuthServiceOrgAndRBAC:
    """测试组织和 RBAC"""

    @pytest.mark.asyncio
    async def test_sso_org_model_disabled(self, mock_user_repo):
        """测试禁用组织模型"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "sso-user-123"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)

        now = datetime.now(timezone.utc)
        payload = {
            "sub": "sso-user-123",
            "email": "sso@example.com",
            "username": "ssouser",
            "nonce": "test-sso-nonce",
            "enterprise_id": "ent-123",
            "team_id": "team-456",
            "exp": now + timedelta(hours=1),
            "iat": now,
            "iss": settings.SSO_JWT_ISSUER,
            "aud": settings.SSO_JWT_AUDIENCE,
        }
        token = jwt.encode(payload, settings.SSO_JWT_SECRET, algorithm=settings.SSO_JWT_ALGORITHM)

        with patch.object(settings, 'ENABLE_ORG_MODEL', False):
            await service.login_sso(token)

            call_args = mock_user_repo.create.call_args
            assert call_args.kwargs.get("enterprise_id") is None
            assert call_args.kwargs.get("team_id") is None

    @pytest.mark.asyncio
    async def test_sso_rbac_disabled(self, mock_user_repo):
        """测试禁用 RBAC"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "sso-user-123"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)

        now = datetime.now(timezone.utc)
        payload = {
            "sub": "sso-user-123",
            "email": "sso@example.com",
            "username": "ssouser",
            "nonce": "test-sso-nonce",
            "role": "admin",
            "exp": now + timedelta(hours=1),
            "iat": now,
            "iss": settings.SSO_JWT_ISSUER,
            "aud": settings.SSO_JWT_AUDIENCE,
        }
        token = jwt.encode(payload, settings.SSO_JWT_SECRET, algorithm=settings.SSO_JWT_ALGORITHM)

        with patch.object(settings, 'ENABLE_RBAC', False):
            await service.login_sso(token)

            call_args = mock_user_repo.create.call_args
            assert call_args.kwargs.get("role") == settings.DEFAULT_ROLE
