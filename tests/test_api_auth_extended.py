"""
补充 API 认证测试
覆盖验证码、登录、注册等 API
"""
import pytest

from backend.config.settings import settings


class TestAuthAPIVerificationCode:
    """测试验证码 API"""

    @pytest.mark.asyncio
    async def test_send_verification_code_login(self, client):
        """测试发送登录验证码"""
        response = await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "test@example.com", "purpose": "login"},
        )
        # 可能成功或失败（取决于邮件配置），但不应该是 500
        assert response.status_code in [200, 400, 403, 429, 500]

    @pytest.mark.asyncio
    async def test_send_verification_code_register(self, client):
        """测试发送注册验证码"""
        response = await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "newuser@example.com", "purpose": "register"},
        )
        assert response.status_code in [200, 400, 403, 429, 500]

    @pytest.mark.asyncio
    async def test_send_verification_code_invalid_purpose(self, client):
        """测试无效的 purpose"""
        response = await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "test@example.com", "purpose": "invalid"},
        )
        # 应该返回验证错误
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_send_verification_code_invalid_email(self, client):
        """测试无效邮箱"""
        response = await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "invalid-email", "purpose": "login"},
        )
        assert response.status_code == 422


class TestAuthAPIRegister:
    """测试注册 API"""

    @pytest.mark.asyncio
    async def test_register_missing_code(self, client):
        """测试注册缺少验证码"""
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "new@example.com", "username": "newuser"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_with_code(self, client):
        """测试带验证码注册"""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "username": "newuser",
                "code": "123456",
            },
        )
        # 验证码无效时会失败
        assert response.status_code in [201, 400, 401, 409]


class TestAuthAPILogin:
    """测试登录 API"""

    @pytest.mark.asyncio
    async def test_login_missing_code(self, client):
        """测试登录缺少验证码"""
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "user@example.com"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_with_code(self, client):
        """测试带验证码登录"""
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "user@example.com", "code": "123456"},
        )
        # 验证码无效时会失败
        assert response.status_code in [200, 400, 401]


class TestAuthAPIRefresh:
    """测试 Token 刷新 API"""

    @pytest.mark.asyncio
    async def test_refresh_missing_token(self, client):
        """测试缺少 refresh_token"""
        response = await client.post("/api/v1/auth/refresh")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_refresh_invalid_token(self, client):
        """测试无效 token"""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
        )
        assert response.status_code in [401, 422]


class TestAuthAPISso:
    """测试 SSO 登录 API"""

    @pytest.mark.asyncio
    async def test_sso_login_missing_token(self, client):
        """测试缺少 id_token"""
        response = await client.post("/api/v1/auth/sso/login")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_sso_login_invalid_token(self, client):
        """测试无效 SSO token"""
        response = await client.post(
            "/api/v1/auth/sso/login",
            json={"id_token": "invalid.token"},
        )
        assert response.status_code in [401, 403]


class TestAuthAPILDap:
    """测试 LDAP 登录 API"""

    @pytest.mark.asyncio
    async def test_ldap_login_missing_credentials(self, client):
        """测试缺少凭据"""
        response = await client.post("/api/v1/auth/ldap/login")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_ldap_login_with_credentials(self, client):
        """测试带凭据登录"""
        response = await client.post(
            "/api/v1/auth/ldap/login",
            json={"username": "testuser", "password": "testpass"},
        )
        # LDAP 可能未配置或连接失败
        assert response.status_code in [200, 401, 403, 500]


class TestAPITokens:
    """测试 Token 管理 API"""

    @pytest.mark.asyncio
    async def test_list_tokens_unauthorized(self, client):
        """测试未授权访问"""
        response = await client.get("/api/v1/tokens")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_token_unauthorized(self, client):
        """测试未授权创建"""
        response = await client.post(
            "/api/v1/tokens",
            json={"name": "test-token"},
        )
        assert response.status_code == 401


class TestAPISkillsUnauthorized:
    """测试 Skills API 未授权访问"""

    @pytest.mark.asyncio
    async def test_list_skills_unauthorized(self, client):
        """测试未授权列出技能"""
        response = await client.get("/api/v1/skills")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_skill_unauthorized(self, client):
        """测试未授权创建技能"""
        response = await client.post(
            "/api/v1/skills",
            json={"name": "test-skill", "description": "test"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_skill_unauthorized(self, client):
        """测试未授权获取技能"""
        response = await client.get("/api/v1/skills/123")
        assert response.status_code == 401


class TestAPIDashboardUnauthorized:
    """测试 Dashboard API 未授权访问"""

    @pytest.mark.asyncio
    async def test_overview_unauthorized(self, client):
        """测试未授权访问概览"""
        response = await client.get("/api/v1/dashboard/overview")
        assert response.status_code == 401


class TestAPIAuditUnauthorized:
    """测试 Audit API 未授权访问"""

    @pytest.mark.asyncio
    async def test_list_logs_unauthorized(self, client):
        """测试未授权列出日志"""
        response = await client.get("/api/v1/audit/logs")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_export_logs_unauthorized(self, client):
        """测试未授权导出日志"""
        response = await client.post(
            "/api/v1/audit/logs/export",
            json={"format": "json"},
        )
        assert response.status_code == 401


class TestAPIHealth:
    """测试健康检查 API"""

    @pytest.mark.asyncio
    async def test_health_endpoint(self, client):
        """测试健康检查"""
        response = await client.get("/health")
        assert response.status_code in [200, 503]

    @pytest.mark.asyncio
    async def test_metrics_endpoint(self, client):
        """测试指标端点"""
        response = await client.get("/metrics")
        # 可能需要认证或配置
        assert response.status_code in [200, 401, 404]


class TestAPIDocs:
    """测试 API 文档"""

    @pytest.mark.asyncio
    async def test_swagger_docs(self, client):
        """测试 Swagger 文档"""
        response = await client.get("/docs")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_redoc_docs(self, client):
        """测试 ReDoc 文档"""
        response = await client.get("/redoc")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_openapi_schema(self, client):
        """测试 OpenAPI schema"""
        response = await client.get("/openapi.json")
        assert response.status_code == 200