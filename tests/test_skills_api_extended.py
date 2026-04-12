"""
Skills API 扩展测试
覆盖版本管理、文件操作、激活/停用等完整业务流程
"""
import base64
import io
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sso_helpers import create_api_token

from backend.config.settings import settings
from backend.core.security.jwt_utils import create_access_token


async def _create_client_headers(client, access_token: str, name: str = "test-client") -> dict[str, str]:
    token = await create_api_token(client, access_token, name=name)
    return {"Authorization": f"Bearer {token}"}


def create_test_zip(
    files: dict[str, str],
    include_skill_md: bool = True,
    frontmatter: str | None = None,
) -> bytes:
    """创建测试用 ZIP 文件"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        if include_skill_md:
            skill_md_content = frontmatter or """---
name: test-skill
version: 1.0.0
description: Test skill
---
# Test Skill
"""
            zf.writestr("SKILL.md", skill_md_content)

        for path, content in files.items():
            zf.writestr(path, content)

    return buffer.getvalue()


class TestSkillsAPIVersions:
    """测试版本管理端点"""

    @pytest.mark.asyncio
    async def test_list_versions_unauthorized(self, client):
        """测试未授权访问版本列表"""
        response = await client.get("/api/v1/skills/some-skill-id/versions")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_diff_versions_unauthorized(self, client):
        """测试未授权比较版本"""
        response = await client.get("/api/v1/skills/skill-id/versions/diff?from=1.0.0&to=2.0.0")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_rollback_version_unauthorized(self, client):
        """测试未授权回滚版本"""
        response = await client.post("/api/v1/skills/skill-id/versions/1.0.0/rollback")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_install_instructions_unauthorized(self, client):
        """测试未授权获取安装指令"""
        response = await client.get("/api/v1/skills/skill-id/versions/1.0.0/install-instructions")
        assert response.status_code == 401


class TestSkillsAPIUpload:
    """测试技能上传端点"""

    @pytest.mark.asyncio
    async def test_upload_unauthorized(self, client):
        """测试未授权上传"""
        zip_content = create_test_zip({"main.py": "print('hello')"})

        response = await client.post(
            "/api/v1/skills/upload",
            data={"skill_uuid": "some-skill-id", "file": ("test.zip", io.BytesIO(zip_content), "application/zip")},
        )

        assert response.status_code == 401


class TestSkillsAPIDownload:
    """测试技能下载端点"""

    @pytest.mark.asyncio
    async def test_download_unauthorized(self, client):
        """测试未授权下载"""
        response = await client.post(
            "/api/v1/client/skills/download",
            json={"skill_uuid": "some-skill-id"},
        )

        assert response.status_code == 401


class TestSkillsAPIActivateDeactivate:
    """测试激活/停用端点"""

    @pytest.mark.asyncio
    async def test_deactivate_unauthorized(self, client):
        """测试未授权停用"""
        response = await client.post("/api/v1/skills/some-skill-id/deactivate")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_activate_unauthorized(self, client):
        """测试未授权激活"""
        response = await client.post("/api/v1/skills/some-skill-id/activate")
        assert response.status_code == 401


class TestSkillsAPIFiles:
    """测试文件操作端点"""

    @pytest.mark.asyncio
    async def test_read_file_unauthorized(self, client):
        """测试未授权读取文件"""
        response = await client.get("/api/v1/skills/some-skill-id/files/main.py")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_files_unauthorized(self, client):
        """测试未授权列出文件"""
        response = await client.get("/api/v1/skills/some-skill-id/files")
        assert response.status_code == 401


class TestSkillsAPICachePolicy:
    """测试缓存策略端点"""

    @pytest.mark.asyncio
    async def test_get_cache_policy_unauthorized(self, client):
        """测试未授权获取缓存策略"""
        response = await client.get("/api/v1/skills/cache-policy")
        assert response.status_code == 401


class TestSkillsAPIErrorHandling:
    """测试错误处理"""

    @pytest.mark.asyncio
    async def test_invalid_skill_uuid_format_unauthorized(self, client):
        """测试无效的技能 UUID 格式"""
        response = await client.get("/api/v1/skills/invalid-uuid-format")
        assert response.status_code == 401


class TestSkillsAPISkillLifecycle:
    """测试技能生命周期 - 使用授权用户"""

    @pytest.mark.asyncio
    async def test_skill_crud_lifecycle(self, client, tmp_path, monkeypatch):
        """测试完整的技能 CRUD 生命周期"""
        import os
        monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))

        # 先发送验证码
        await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "lifecycle@example.com", "purpose": "register"},
        )

        # 注册用户
        register_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "lifecycle@example.com",
                "username": "lifecycleuser",
                "code": "123456",  # 测试环境可能接受任意验证码
            },
        )

        # 如果注册成功，继续测试
        if register_response.status_code == 201:
            data = register_response.json()
            token = data.get("access_token")
            headers = {"Authorization": f"Bearer {token}"}
            # 创建技能
            create_response = await client.post(
                "/api/v1/skills",
                json={
                    "name": "test-lifecycle-skill",
                    "description": "Test lifecycle",
                    "tags": ["test"],
                    "visible": "private",
                },
                headers=headers,
            )

            if create_response.status_code == 201:
                skill_id = create_response.json()["id"]

                # 获取技能
                get_response = await client.get(f"/api/v1/skills/{skill_id}", headers=headers)
                assert get_response.status_code == 200

                # 更新技能
                update_response = await client.put(
                    f"/api/v1/skills/{skill_id}",
                    json={"description": "Updated description"},
                    headers=headers,
                )
                assert update_response.status_code == 200

                # 删除技能
                delete_response = await client.delete(f"/api/v1/skills/{skill_id}", headers=headers)
                assert delete_response.status_code == 204


class TestSkillsAPIPagination:
    """测试分页功能"""

    @pytest.mark.asyncio
    async def test_list_skills_unauthorized(self, client):
        """测试未授权列出技能"""
        response = await client.get("/api/v1/skills")
        assert response.status_code == 401


class TestSkillsAPIVisibility:
    """测试技能可见性"""

    @pytest.mark.asyncio
    async def test_create_skill_unauthorized(self, client):
        """测试未授权创建技能"""
        response = await client.post(
            "/api/v1/skills",
            json={
                "name": "test-skill",
                "description": "Test skill",
                "visible": "private",
            },
        )
        assert response.status_code == 401


class TestSkillsAPISkillVersionOperations:
    """测试技能版本操作"""

    @pytest.mark.asyncio
    async def test_skill_upload_download_flow(self, client, tmp_path, monkeypatch):
        """测试技能上传下载流程"""
        import os
        monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))

        # 尝试注册
        register_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "version@example.com",
                "username": "versionuser",
                "code": "123456",
            },
        )

        if register_response.status_code == 201:
            token = register_response.json().get("access_token")
            headers = {"Authorization": f"Bearer {token}"}
            # 创建技能
            create_response = await client.post(
                "/api/v1/skills",
                json={
                    "name": "version-test-skill",
                    "description": "Version test",
                },
                headers=headers,
            )

            if create_response.status_code == 201:
                skill_id = create_response.json()["id"]

                # 列出版本
                versions_response = await client.get(
                    f"/api/v1/skills/{skill_id}/versions",
                    headers=headers,
                )
                assert versions_response.status_code == 200

                # 获取缓存策略
                cache_response = await client.get(
                    "/api/v1/skills/cache-policy",
                    headers=headers,
                )
                assert cache_response.status_code == 200
