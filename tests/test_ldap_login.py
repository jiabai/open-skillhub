"""
LDAP 登录集成测试
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.config.settings import settings
from backend.models.user import User
from backend.repositories.user import UserRepository
from backend.services.auth import AuthService, TokenPair


@pytest.fixture
def mock_user_repo():
    return AsyncMock(spec=UserRepository)


@pytest.fixture
def test_user():
    user = MagicMock(spec=User)
    user.id = "user-123"
    user.email = "test@example.com"
    user.username = "testuser"
    user.is_active = True
    return user


class TestAuthServiceLDAP:
    """LDAP 登录测试"""

    @pytest.mark.asyncio
    async def test_ldap_not_configured_no_url(self, mock_user_repo):
        """测试 LDAP URL 未配置"""
        with patch.object(settings, 'LDAP_URL', ''):
            with patch.object(settings, 'LDAP_USER_DN_TEMPLATE', 'uid={username},ou=users'):
                service = AuthService(mock_user_repo)

                with pytest.raises(ValueError, match="LDAP not configured"):
                    await service.login_ldap("testuser", "password")

    @pytest.mark.asyncio
    async def test_ldap_not_configured_no_template(self, mock_user_repo):
        """测试 LDAP 模板未配置"""
        with patch.object(settings, 'LDAP_URL', 'ldap://localhost:389'):
            with patch.object(settings, 'LDAP_USER_DN_TEMPLATE', ''):
                service = AuthService(mock_user_repo)

                with pytest.raises(ValueError, match="LDAP not configured"):
                    await service.login_ldap("testuser", "password")

    @pytest.mark.asyncio
    async def test_ldap_login_new_user_no_search_base(self, mock_user_repo):
        """测试 LDAP 登录新用户（无搜索基础）"""
        with patch.object(settings, 'LDAP_URL', 'ldap://localhost:389'):
            with patch.object(settings, 'LDAP_USER_DN_TEMPLATE', 'uid={username},ou=users,dc=example,dc=com'):
                with patch.object(settings, 'LDAP_SEARCH_BASE', ''):
                    with patch.object(settings, 'ENABLE_ORG_MODEL', False):
                        with patch.object(settings, 'ENABLE_RBAC', False):
                            mock_user_repo.get_by_email = AsyncMock(return_value=None)

                            new_user = MagicMock(spec=User)
                            new_user.id = "ldap-user-123"
                            mock_user_repo.create = AsyncMock(return_value=new_user)

                            service = AuthService(mock_user_repo)

                            # Mock ldap3
                            mock_connection = MagicMock()
                            mock_connection.entries = []
                            mock_connection.auto_bind = True

                            mock_server = MagicMock()

                            mock_ldap3 = MagicMock()
                            mock_ldap3.Connection = MagicMock(return_value=mock_connection)
                            mock_ldap3.Server = MagicMock(return_value=mock_server)

                            with patch.dict('sys.modules', {'ldap3': mock_ldap3}):
                                with patch('importlib.import_module', return_value=mock_ldap3):
                                    result = await service.login_ldap("testuser", "password")

                            assert isinstance(result, TokenPair)

    @pytest.mark.asyncio
    async def test_ldap_login_existing_user(self, mock_user_repo, test_user):
        """测试 LDAP 登录已有用户"""
        with patch.object(settings, 'LDAP_URL', 'ldap://localhost:389'):
            with patch.object(settings, 'LDAP_USER_DN_TEMPLATE', 'uid={username},ou=users,dc=example,dc=com'):
                with patch.object(settings, 'LDAP_SEARCH_BASE', ''):
                    with patch.object(settings, 'ENABLE_ORG_MODEL', False):
                        with patch.object(settings, 'ENABLE_RBAC', False):
                            test_user.email = "testuser@local"
                            mock_user_repo.get_by_email = AsyncMock(return_value=test_user)
                            mock_user_repo.update = AsyncMock(return_value=test_user)

                            service = AuthService(mock_user_repo)

                            mock_connection = MagicMock()
                            mock_connection.entries = []
                            mock_connection.auto_bind = True

                            mock_server = MagicMock()

                            mock_ldap3 = MagicMock()
                            mock_ldap3.Connection = MagicMock(return_value=mock_connection)
                            mock_ldap3.Server = MagicMock(return_value=mock_server)

                            with patch.dict('sys.modules', {'ldap3': mock_ldap3}):
                                with patch('importlib.import_module', return_value=mock_ldap3):
                                    result = await service.login_ldap("testuser", "password")

                            assert isinstance(result, TokenPair)
                            mock_user_repo.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_ldap_login_with_search_base(self, mock_user_repo):
        """测试带搜索基础的 LDAP 登录"""
        with patch.object(settings, 'LDAP_URL', 'ldap://localhost:389'):
            with patch.object(settings, 'LDAP_USER_DN_TEMPLATE', 'uid={username},ou=users,dc=example,dc=com'):
                with patch.object(settings, 'LDAP_SEARCH_BASE', 'ou=users,dc=example,dc=com'):
                    with patch.object(settings, 'LDAP_SEARCH_FILTER', '(uid={username})'):
                        with patch.object(settings, 'LDAP_EMAIL_ATTR', 'mail'):
                            with patch.object(settings, 'LDAP_USERNAME_ATTR', 'uid'):
                                with patch.object(settings, 'LDAP_ENTERPRISE_ATTR', 'ou'):
                                    with patch.object(settings, 'LDAP_TEAM_ATTR', 'departmentNumber'):
                                        with patch.object(settings, 'LDAP_ROLE_ATTR', 'title'):
                                            with patch.object(settings, 'LDAP_STATUS_ATTR', 'employeeStatus'):
                                                with patch.object(settings, 'ENABLE_ORG_MODEL', False):
                                                    with patch.object(settings, 'ENABLE_RBAC', False):
                                                        mock_user_repo.get_by_email = AsyncMock(return_value=None)

                                                        new_user = MagicMock(spec=User)
                                                        new_user.id = "ldap-user-123"
                                                        mock_user_repo.create = AsyncMock(return_value=new_user)

                                                        service = AuthService(mock_user_repo)

                                                        # Mock LDAP entry
                                                        mock_entry = MagicMock()
                                                        mock_entry.__getitem__ = lambda self, key: {
                                                            'mail': MagicMock(value='ldap@example.com'),
                                                            'uid': MagicMock(value='testuser'),
                                                            'ou': MagicMock(value=None),
                                                            'departmentNumber': MagicMock(value=None),
                                                            'title': MagicMock(value=None),
                                                            'employeeStatus': MagicMock(value=None),
                                                        }[key]

                                                        mock_connection = MagicMock()
                                                        mock_connection.entries = [mock_entry]
                                                        mock_connection.search = MagicMock()
                                                        mock_connection.auto_bind = True

                                                        mock_server = MagicMock()

                                                        mock_ldap3 = MagicMock()
                                                        mock_ldap3.Connection = MagicMock(return_value=mock_connection)
                                                        mock_ldap3.Server = MagicMock(return_value=mock_server)

                                                        with patch.dict('sys.modules', {'ldap3': mock_ldap3}):
                                                            with patch('importlib.import_module', return_value=mock_ldap3):
                                                                result = await service.login_ldap("testuser", "password")

                                                        assert isinstance(result, TokenPair)

    @pytest.mark.asyncio
    async def test_ldap_login_invalid_credentials_search(self, mock_user_repo):
        """测试 LDAP 搜索无结果"""
        with patch.object(settings, 'LDAP_URL', 'ldap://localhost:389'):
            with patch.object(settings, 'LDAP_USER_DN_TEMPLATE', 'uid={username},ou=users,dc=example,dc=com'):
                with patch.object(settings, 'LDAP_SEARCH_BASE', 'ou=users,dc=example,dc=com'):
                    with patch.object(settings, 'LDAP_SEARCH_FILTER', '(uid={username})'):
                        mock_connection = MagicMock()
                        mock_connection.entries = []  # No entries found
                        mock_connection.search = MagicMock()
                        mock_connection.auto_bind = True

                        mock_server = MagicMock()

                        mock_ldap3 = MagicMock()
                        mock_ldap3.Connection = MagicMock(return_value=mock_connection)
                        mock_ldap3.Server = MagicMock(return_value=mock_server)

                        service = AuthService(mock_user_repo)

                        with patch.dict('sys.modules', {'ldap3': mock_ldap3}):
                            with patch('importlib.import_module', return_value=mock_ldap3):
                                with pytest.raises(ValueError, match="Invalid credentials"):
                                    await service.login_ldap("testuser", "password")

    @pytest.mark.asyncio
    async def test_ldap_login_with_org_model_enabled(self, mock_user_repo):
        """测试启用组织模型的 LDAP 登录"""
        with patch.object(settings, 'LDAP_URL', 'ldap://localhost:389'):
            with patch.object(settings, 'LDAP_USER_DN_TEMPLATE', 'uid={username},ou=users,dc=example,dc=com'):
                with patch.object(settings, 'LDAP_SEARCH_BASE', 'ou=users,dc=example,dc=com'):
                    with patch.object(settings, 'LDAP_SEARCH_FILTER', '(uid={username})'):
                        with patch.object(settings, 'LDAP_EMAIL_ATTR', 'mail'):
                            with patch.object(settings, 'LDAP_USERNAME_ATTR', 'uid'):
                                with patch.object(settings, 'LDAP_ENTERPRISE_ATTR', 'ou'):
                                    with patch.object(settings, 'LDAP_TEAM_ATTR', 'departmentNumber'):
                                        with patch.object(settings, 'LDAP_ROLE_ATTR', 'title'):
                                            with patch.object(settings, 'LDAP_STATUS_ATTR', 'employeeStatus'):
                                                with patch.object(settings, 'ENABLE_ORG_MODEL', True):
                                                    with patch.object(settings, 'ENABLE_RBAC', False):
                                                        mock_user_repo.get_by_email = AsyncMock(return_value=None)

                                                        new_user = MagicMock(spec=User)
                                                        new_user.id = "ldap-user-123"
                                                        mock_user_repo.create = AsyncMock(return_value=new_user)

                                                        service = AuthService(mock_user_repo)

                                                        mock_entry = MagicMock()
                                                        mock_entry.__getitem__ = lambda self, key: {
                                                            'mail': MagicMock(value='ldap@example.com'),
                                                            'uid': MagicMock(value='testuser'),
                                                            'ou': MagicMock(value='enterprise-1'),
                                                            'departmentNumber': MagicMock(value='team-1'),
                                                            'title': MagicMock(value=None),
                                                            'employeeStatus': MagicMock(value=None),
                                                        }[key]

                                                        mock_connection = MagicMock()
                                                        mock_connection.entries = [mock_entry]
                                                        mock_connection.search = MagicMock()
                                                        mock_connection.auto_bind = True

                                                        mock_server = MagicMock()

                                                        mock_ldap3 = MagicMock()
                                                        mock_ldap3.Connection = MagicMock(return_value=mock_connection)
                                                        mock_ldap3.Server = MagicMock(return_value=mock_server)

                                                        with patch.dict('sys.modules', {'ldap3': mock_ldap3}):
                                                            with patch('importlib.import_module', return_value=mock_ldap3):
                                                                result = await service.login_ldap("testuser", "password")

                                                        # Verify enterprise_id and team_id were passed
                                                        call_args = mock_user_repo.create.call_args
                                                        assert call_args.kwargs['enterprise_id'] == 'enterprise-1'
                                                        assert call_args.kwargs['team_id'] == 'team-1'

    @pytest.mark.asyncio
    async def test_ldap_login_with_rbac_enabled(self, mock_user_repo):
        """测试启用 RBAC 的 LDAP 登录"""
        with patch.object(settings, 'LDAP_URL', 'ldap://localhost:389'):
            with patch.object(settings, 'LDAP_USER_DN_TEMPLATE', 'uid={username},ou=users,dc=example,dc=com'):
                with patch.object(settings, 'LDAP_SEARCH_BASE', 'ou=users,dc=example,dc=com'):
                    with patch.object(settings, 'LDAP_SEARCH_FILTER', '(uid={username})'):
                        with patch.object(settings, 'LDAP_EMAIL_ATTR', 'mail'):
                            with patch.object(settings, 'LDAP_USERNAME_ATTR', 'uid'):
                                with patch.object(settings, 'LDAP_ENTERPRISE_ATTR', 'ou'):
                                    with patch.object(settings, 'LDAP_TEAM_ATTR', 'departmentNumber'):
                                        with patch.object(settings, 'LDAP_ROLE_ATTR', 'title'):
                                            with patch.object(settings, 'LDAP_STATUS_ATTR', 'employeeStatus'):
                                                with patch.object(settings, 'ENABLE_ORG_MODEL', False):
                                                    with patch.object(settings, 'ENABLE_RBAC', True):
                                                        mock_user_repo.get_by_email = AsyncMock(return_value=None)

                                                        new_user = MagicMock(spec=User)
                                                        new_user.id = "ldap-user-123"
                                                        mock_user_repo.create = AsyncMock(return_value=new_user)

                                                        service = AuthService(mock_user_repo)

                                                        mock_entry = MagicMock()
                                                        mock_entry.__getitem__ = lambda self, key: {
                                                            'mail': MagicMock(value='ldap@example.com'),
                                                            'uid': MagicMock(value='testuser'),
                                                            'ou': MagicMock(value=None),
                                                            'departmentNumber': MagicMock(value=None),
                                                            'title': MagicMock(value='admin'),
                                                            'employeeStatus': MagicMock(value=None),
                                                        }[key]

                                                        mock_connection = MagicMock()
                                                        mock_connection.entries = [mock_entry]
                                                        mock_connection.search = MagicMock()
                                                        mock_connection.auto_bind = True

                                                        mock_server = MagicMock()

                                                        mock_ldap3 = MagicMock()
                                                        mock_ldap3.Connection = MagicMock(return_value=mock_connection)
                                                        mock_ldap3.Server = MagicMock(return_value=mock_server)

                                                        with patch.dict('sys.modules', {'ldap3': mock_ldap3}):
                                                            with patch('importlib.import_module', return_value=mock_ldap3):
                                                                result = await service.login_ldap("testuser", "password")

                                                        # Verify role was passed
                                                        call_args = mock_user_repo.create.call_args
                                                        assert call_args.kwargs['role'] == 'admin'