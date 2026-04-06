"""
AuthService SSO/LDAP 测试
覆盖 SSO 登录、LDAP 登录、Token 刷新等完整流程
"""
import jwt
import secrets
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
    return user


def create_sso_token(
    email: str = "sso@example.com",
    username: str = "ssouser",
    nonce: str = "test-sso-nonce",
    enterprise_id: str | None = None,
    team_id: str | None = None,
    role: str = "user",
    status: str = "active",
    secret: str = None,
    issuer: str = None,
    audience: str = None,
    expired: bool = False,
    email_claim: str = "email",
    username_claim: str = "username",
) -> str:
    """创建测试用 SSO JWT token"""
    now = datetime.now(timezone.utc)
    if expired:
        exp = now - timedelta(hours=1)
    else:
        exp = now + timedelta(hours=1)

    payload = {
        "sub": "sso-user-123",
        "nonce": nonce,
        "exp": exp,
        "iat": now,
    }

    # 使用传入的 claim 名称
    payload[email_claim] = email
    payload[username_claim] = username

    if enterprise_id:
        payload["enterprise_id"] = enterprise_id
    if team_id:
        payload["team_id"] = team_id
    if role:
        payload["role"] = role
    if status:
        payload["status"] = status

    secret = secret or settings.SSO_JWT_SECRET
    issuer = issuer or settings.SSO_JWT_ISSUER
    audience = audience or settings.SSO_JWT_AUDIENCE

    if issuer:
        payload["iss"] = issuer
    if audience:
        payload["aud"] = audience

    return jwt.encode(payload, secret, algorithm=settings.SSO_JWT_ALGORITHM)


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
        mock_user_repo.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_register_email_already_exists(self, mock_user_repo, test_user):
        """测试邮箱已存在"""
        mock_user_repo.get_by_email = AsyncMock(return_value=test_user)
        service = AuthService(mock_user_repo)

        with pytest.raises(ValueError, match="Email already registered"):
            await service.register("test@example.com", "newuser", "password123")

    @pytest.mark.asyncio
    async def test_register_username_already_exists(self, mock_user_repo, test_user):
        """测试用户名已存在"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)
        mock_user_repo.get_by_username = AsyncMock(return_value=test_user)
        service = AuthService(mock_user_repo)

        with pytest.raises(ValueError, match="Username already registered"):
            await service.register("new@example.com", "testuser", "password123")

    @pytest.mark.asyncio
    async def test_register_auto_password(self, mock_user_repo):
        """测试自动生成密码"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)
        mock_user_repo.get_by_username = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "new-user-123"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)
        result = await service.register("new@example.com", "newuser", None)

        # 验证调用了 create，密码参数不为空
        call_args = mock_user_repo.create.call_args
        assert call_args.kwargs["password"] is not None


class TestAuthServiceSSOLogin:
    """测试 SSO 登录"""

    @pytest.mark.asyncio
    async def test_sso_login_new_user(self, mock_user_repo):
        """测试 SSO 登录新用户"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "sso-user-123"
        new_user.email = "sso@example.com"
        new_user.username = "ssouser"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)
        token = create_sso_token()
        result = await service.login_sso(token)

        assert isinstance(result, TokenPair)
        assert result.access_token is not None
        assert result.refresh_token is not None

    @pytest.mark.asyncio
    async def test_sso_login_existing_user(self, mock_user_repo, test_user):
        """测试 SSO 登录已有用户"""
        mock_user_repo.get_by_email = AsyncMock(return_value=test_user)
        mock_user_repo.update = AsyncMock(return_value=test_user)

        service = AuthService(mock_user_repo)
        token = create_sso_token(email="test@example.com")
        result = await service.login_sso(token)

        assert isinstance(result, TokenPair)
        mock_user_repo.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_sso_login_with_enterprise_and_team(self, mock_user_repo):
        """测试带企业和团队信息的 SSO 登录"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "sso-user-123"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)
        token = create_sso_token(
            enterprise_id="ent-123",
            team_id="team-456",
            role="admin",
        )
        result = await service.login_sso(token)

        assert isinstance(result, TokenPair)
        # 验证 create 调用时包含 enterprise_id 和 team_id
        call_args = mock_user_repo.create.call_args
        assert call_args.kwargs["enterprise_id"] == "ent-123"
        assert call_args.kwargs["team_id"] == "team-456"

    @pytest.mark.asyncio
    async def test_sso_login_invalid_token(self, mock_user_repo):
        """测试无效 SSO token"""
        service = AuthService(mock_user_repo)

        with pytest.raises(Exception):
            await service.login_sso("invalid.token.here")

    @pytest.mark.asyncio
    async def test_sso_login_expired_token(self, mock_user_repo):
        """测试过期的 SSO token"""
        service = AuthService(mock_user_repo)
        token = create_sso_token(expired=True)

        with pytest.raises(Exception):
            await service.login_sso(token)

    @pytest.mark.asyncio
    async def test_sso_login_wrong_secret(self, mock_user_repo):
        """测试错误的密钥"""
        service = AuthService(mock_user_repo)
        token = create_sso_token(secret="wrong-secret")

        with pytest.raises(Exception):
            await service.login_sso(token)

    @pytest.mark.asyncio
    async def test_sso_login_missing_email_claim(self, mock_user_repo):
        """测试缺少邮箱声明"""
        # 创建没有 email 的 token
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "sso-user-123",
            "nonce": "test-sso-nonce",
            "username": "ssouser",
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
    async def test_sso_login_username_from_email(self, mock_user_repo):
        """测试从邮箱提取用户名"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "sso-user-123"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)

        # token 中没有 username，应从 email 提取
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

        result = await service.login_sso(token)

        assert isinstance(result, TokenPair)
        # 验证 username 是从 email 提取的
        call_args = mock_user_repo.create.call_args
        assert call_args.kwargs["username"] == "john.doe"


class TestAuthServiceLDAPLogin:
    """测试 LDAP 登录"""

    @pytest.mark.asyncio
    async def test_ldap_login_not_configured_url(self, mock_user_repo):
        """测试 LDAP URL 未配置"""
        # 直接 mock settings
        with patch.object(settings, 'LDAP_URL', ''):
            service = AuthService(mock_user_repo)

            with pytest.raises(ValueError, match="LDAP not configured"):
                await service.login_ldap("testuser", "password")

    @pytest.mark.asyncio
    async def test_ldap_login_not_configured_template(self, mock_user_repo):
        """测试 LDAP 用户模板未配置"""
        with patch.object(settings, 'LDAP_URL', 'ldap://localhost:389'):
            with patch.object(settings, 'LDAP_USER_DN_TEMPLATE', ''):
                service = AuthService(mock_user_repo)

                with pytest.raises(ValueError, match="LDAP not configured"):
                    await service.login_ldap("testuser", "password")


class TestAuthServiceRefreshToken:
    """测试 Token 刷新"""

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, mock_user_repo, test_user):
        """测试成功刷新 token"""
        mock_user_repo.get_by_id = AsyncMock(return_value=test_user)

        service = AuthService(mock_user_repo)

        # 先创建一个有效的 refresh token
        from backend.core.security.jwt_utils import create_refresh_token
        refresh_token = create_refresh_token(subject=str(test_user.id))

        result = await service.refresh_token(refresh_token)

        assert isinstance(result, TokenPair)
        assert result.access_token is not None

    @pytest.mark.asyncio
    async def test_refresh_token_wrong_type(self, mock_user_repo, test_user):
        """测试使用 access token 刷新"""
        mock_user_repo.get_by_id = AsyncMock(return_value=test_user)

        service = AuthService(mock_user_repo)

        # 使用 access token 尝试刷新
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
        refresh_token = create_refresh_token(subject="non-existent-user")

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
            await service.refresh_token("invalid.token.here")

    @pytest.mark.asyncio
    async def test_refresh_token_expired(self, mock_user_repo, test_user):
        """测试过期 token"""
        mock_user_repo.get_by_id = AsyncMock(return_value=test_user)

        service = AuthService(mock_user_repo)

        # 创建一个过期的 refresh token
        now = datetime.now(timezone.utc)
        payload = {
            "sub": str(test_user.id),
            "type": "refresh",
            "exp": now - timedelta(hours=1),  # 过期
            "iat": now - timedelta(hours=2),
        }
        expired_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

        with pytest.raises(Exception):
            await service.refresh_token(expired_token)


class TestAuthServiceIssueToken:
    """测试 Token 发放"""

    @pytest.mark.asyncio
    async def test_issue_token(self, mock_user_repo, test_user):
        """测试发放 token"""
        service = AuthService(mock_user_repo)
        result = service.issue_token(test_user)

        assert isinstance(result, TokenPair)
        assert result.access_token is not None
        assert result.refresh_token is not None

    @pytest.mark.asyncio
    async def test_issue_token_contains_user_id(self, mock_user_repo, test_user):
        """测试 token 包含用户 ID"""
        service = AuthService(mock_user_repo)
        result = service.issue_token(test_user)

        # 解码 access token
        from backend.core.security.jwt_utils import decode_token
        payload = decode_token(result.access_token)

        assert payload.get("sub") == str(test_user.id)
        assert payload.get("type") == "access"


class TestAuthServiceOrgModelAndRBAC:
    """测试组织模型和 RBAC 集成"""

    @pytest.mark.asyncio
    async def test_sso_login_org_model_disabled(self, mock_user_repo):
        """测试禁用组织模型时的 SSO 登录"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "sso-user-123"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)
        token = create_sso_token(enterprise_id="ent-123", team_id="team-456")

        # Mock ENABLE_ORG_MODEL 为 False
        with patch.object(settings, 'ENABLE_ORG_MODEL', False):
            result = await service.login_sso(token)

            # 验证 enterprise_id 和 team_id 被忽略
            call_args = mock_user_repo.create.call_args
            assert call_args.kwargs.get("enterprise_id") is None
            assert call_args.kwargs.get("team_id") is None

    @pytest.mark.asyncio
    async def test_sso_login_rbac_disabled(self, mock_user_repo):
        """测试禁用 RBAC 时的 SSO 登录"""
        mock_user_repo.get_by_email = AsyncMock(return_value=None)

        new_user = MagicMock(spec=User)
        new_user.id = "sso-user-123"
        mock_user_repo.create = AsyncMock(return_value=new_user)

        service = AuthService(mock_user_repo)
        token = create_sso_token(role="admin")

        # Mock ENABLE_RBAC 为 False
        with patch.object(settings, 'ENABLE_RBAC', False):
            result = await service.login_sso(token)

            # 验证 role 被设置为默认值
            call_args = mock_user_repo.create.call_args
            assert call_args.kwargs.get("role") == settings.DEFAULT_ROLE


class TestAuthServiceEdgeCases:
    """测试边缘情况"""

    @pytest.mark.asyncio
    async def test_sso_login_empty_email_stripped(self, mock_user_repo):
        """测试 SSO token 中邮箱为空格"""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "sso-user-123",
            "email": "   ",  # 只有空格
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
    async def test_refresh_token_missing_subject(self, mock_user_repo):
        """测试 refresh token 缺少 subject"""
        service = AuthService(mock_user_repo)

        # 创建没有 sub 的 token
        now = datetime.now(timezone.utc)
        payload = {
            "type": "refresh",
            "exp": now + timedelta(hours=1),
            "iat": now,
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

        with pytest.raises(ValueError, match="Invalid token"):
            await service.refresh_token(token)
