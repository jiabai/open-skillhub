"""
Users API 端点测试
覆盖用户管理、身份更新、邮箱绑定等完整流程
"""
import pytest

from skillhub.config.settings import settings


class TestUsersAPIMe:
    """测试 /me 端点"""

    @pytest.mark.asyncio
    async def test_get_me_unauthorized(self, client):
        """测试未授权访问"""
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me_invalid_token(self, client):
        """测试无效 token"""
        headers = {"Authorization": "Bearer invalid.token.here"}
        response = await client.get("/api/v1/users/me", headers=headers)
        assert response.status_code == 401


class TestUsersAPIUpdateMe:
    """测试 PUT /me 端点"""

    @pytest.mark.asyncio
    async def test_update_me_unauthorized(self, client):
        """测试未授权更新"""
        response = await client.put(
            "/api/v1/users/me",
            json={"username": "newname"},
        )
        assert response.status_code == 401


class TestUsersAPIDeleteMe:
    """测试 DELETE /me 端点"""

    @pytest.mark.asyncio
    async def test_delete_me_unauthorized(self, client):
        """测试未授权删除"""
        # DELETE without body - just checking unauthorized response
        response = await client.delete("/api/v1/users/me")
        assert response.status_code == 401


class TestUsersAPIBindEmail:
    """测试 /bind-email 端点"""

    @pytest.mark.asyncio
    async def test_bind_email_unauthorized(self, client):
        """测试未授权绑定邮箱"""
        response = await client.post(
            "/api/v1/users/bind-email",
            json={"email": "new@example.com", "code": "123456"},
        )
        assert response.status_code == 401


class TestUsersAPIUpdateIdentity:
    """测试 PUT /{user_id}/identity 端点"""

    @pytest.mark.asyncio
    async def test_update_identity_unauthorized(self, client):
        """测试未授权更新身份"""
        response = await client.put(
            "/api/v1/users/some-user-id/identity",
            json={"role": "admin"},
        )
        assert response.status_code == 401


class TestUsersAPITokenManagement:
    """测试 Token 管理"""

    @pytest.mark.asyncio
    async def test_expired_token(self, client):
        """测试过期 token"""
        from datetime import datetime, timedelta, timezone
        import jwt

        # 创建一个过期的 token
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "some-user-id",
            "type": "access",
            "exp": now - timedelta(hours=1),
            "iat": now - timedelta(hours=2),
        }
        expired_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

        headers = {"Authorization": f"Bearer {expired_token}"}
        response = await client.get("/api/v1/users/me", headers=headers)

        assert response.status_code == 401


class TestUsersAPIErrorHandling:
    """测试错误处理"""

    @pytest.mark.asyncio
    async def test_invalid_email_format(self, client):
        """测试无效邮箱格式"""
        # 先注册一个用户来获取 token
        response = await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "not-an-email", "purpose": "login"},
        )
        # 应该返回验证错误
        assert response.status_code == 422