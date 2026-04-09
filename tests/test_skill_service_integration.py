"""
SkillService 集成测试
覆盖 ZIP 上传、下载、版本管理等核心功能
"""
import base64
import io
import os
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.config.settings import settings
from backend.core.utils.skill_storage import (
    get_skill_versions_dir,
    get_user_skill_dir,
)
from backend.models.skill import Skill
from backend.models.skill_version import SkillVersion
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.services.skill import SkillService
from backend.services.skill_errors import SkillError, SkillErrorCode


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

This is a test skill.
"""
            zf.writestr("SKILL.md", skill_md_content)

        for path, content in files.items():
            zf.writestr(path, content)

    return buffer.getvalue()


@pytest.fixture
def mock_skill_repo():
    """Mock skill repository"""
    repo = AsyncMock(spec=SkillRepository)
    return repo


@pytest.fixture
def mock_version_repo():
    """Mock version repository"""
    repo = AsyncMock(spec=SkillVersionRepository)
    return repo


@pytest.fixture
def test_user():
    """Create test user"""
    user = MagicMock()
    user.id = "user-123"
    user.enterprise_id = "ent-1"
    user.team_id = "team-1"
    user.role = "admin"
    return user


@pytest.fixture
def test_skill(test_user):
    """Create test skill"""
    skill = MagicMock(spec=Skill)
    skill.id = "skill-uuid-123"
    skill.name = "test-skill"
    skill.description = "Test skill description"
    skill.user_id = test_user.id
    skill.is_active = True
    skill.current_version = None
    skill.visibility = "private"
    skill.source_skill_id = None
    skill.cloned_from_skill_id = None
    return skill


class TestSkillServiceUploadZip:
    """测试 ZIP 上传功能"""

    @pytest.mark.asyncio
    async def test_upload_zip_invalid_extension(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试无效文件扩展名"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        with pytest.raises(SkillError) as exc_info:
            await service.upload_zip(test_user, "skill-uuid-123", "test.tar", b"content")
        assert exc_info.value.code == SkillErrorCode.INVALID_ZIP_FILE

    @pytest.mark.asyncio
    async def test_upload_zip_bad_zip(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试损坏的 ZIP 文件"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        with pytest.raises(SkillError) as exc_info:
            await service.upload_zip(test_user, "skill-uuid-123", "test.zip", b"not a zip")
        assert exc_info.value.code == SkillErrorCode.INVALID_ZIP_FILE

    @pytest.mark.asyncio
    async def test_upload_zip_empty(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试空 ZIP 文件"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        # Create empty ZIP
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w"):
            pass
        empty_zip = buffer.getvalue()

        with pytest.raises(SkillError) as exc_info:
            await service.upload_zip(test_user, "skill-uuid-123", "test.zip", empty_zip)
        assert exc_info.value.code == SkillErrorCode.ZIP_EMPTY

    @pytest.mark.asyncio
    async def test_upload_zip_missing_skill_md(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试缺少 SKILL.md 的 ZIP"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        # Create ZIP without SKILL.md
        zip_content = create_test_zip({"main.py": "print('hello')"}, include_skill_md=False)

        with pytest.raises(SkillError) as exc_info:
            await service.upload_zip(test_user, "skill-uuid-123", "test.zip", zip_content)
        assert exc_info.value.code == SkillErrorCode.SKILL_MD_NOT_FOUND

    @pytest.mark.asyncio
    async def test_upload_zip_invalid_metadata(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试无效元数据"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        zip_content = create_test_zip({"main.py": "print('hello')"})

        with pytest.raises(SkillError) as exc_info:
            await service.upload_zip(
                test_user,
                "skill-uuid-123",
                "test.zip",
                zip_content,
                metadata_text="not valid json",
            )
        assert exc_info.value.code == SkillErrorCode.INVALID_METADATA

    @pytest.mark.asyncio
    async def test_upload_zip_not_owner(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试非所有者上传"""
        other_user = MagicMock()
        other_user.id = "other-user-456"

        test_skill.user_id = "different-user"
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)

        service = SkillService(mock_skill_repo, mock_version_repo)
        zip_content = create_test_zip({"main.py": "print('hello')"})

        with pytest.raises(SkillError) as exc_info:
            await service.upload_zip(test_user, "skill-uuid-123", "test.zip", zip_content)
        assert exc_info.value.code == SkillErrorCode.SKILL_NOT_FOUND


class TestSkillServiceDownload:
    """测试技能下载功能"""

    @pytest.mark.asyncio
    async def test_download_skill_without_version_repo(
        self, mock_skill_repo, test_user, test_skill
    ):
        """测试没有版本仓库时下载"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, None)

        with pytest.raises(SkillError) as exc_info:
            await service.download_skill(test_user, "skill-uuid-123")
        assert exc_info.value.code == SkillErrorCode.VERSION_REPOSITORY_NOT_CONFIGURED

    @pytest.mark.asyncio
    async def test_download_skill_deactivated(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试下载已停用的技能"""
        test_skill.is_active = False
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        with pytest.raises(SkillError) as exc_info:
            await service.download_skill(test_user, "skill-uuid-123")
        assert exc_info.value.code == SkillErrorCode.SKILL_DEACTIVATED

    @pytest.mark.asyncio
    async def test_download_skill_version_not_found(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试版本不存在"""
        test_skill.current_version = None
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        mock_version_repo.list_by_skill = AsyncMock(return_value=[])
        service = SkillService(mock_skill_repo, mock_version_repo)

        with pytest.raises(SkillError) as exc_info:
            await service.download_skill(test_user, "skill-uuid-123")
        assert exc_info.value.code == SkillErrorCode.VERSION_NOT_FOUND

    @pytest.mark.asyncio
    async def test_download_skill_specific_version_not_found(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试指定版本不存在"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        mock_version_repo.get_by_version = AsyncMock(return_value=None)
        service = SkillService(mock_skill_repo, mock_version_repo)

        with pytest.raises(SkillError) as exc_info:
            await service.download_skill(test_user, "skill-uuid-123", version="99.0.0")
        assert exc_info.value.code == SkillErrorCode.VERSION_NOT_FOUND


class TestSkillServiceDiffVersions:
    """测试版本差异比较"""

    @pytest.mark.asyncio
    async def test_diff_versions_deactivated_skill(
        self, mock_skill_repo, test_user, test_skill
    ):
        """测试比较已停用技能的版本"""
        test_skill.is_active = False
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, None)

        with pytest.raises(SkillError) as exc_info:
            await service.diff_versions(test_user, "skill-uuid-123", "1.0.0", "2.0.0")
        assert exc_info.value.code == SkillErrorCode.SKILL_DEACTIVATED

    @pytest.mark.asyncio
    async def test_diff_versions_invalid_version(
        self, mock_skill_repo, test_user, test_skill
    ):
        """测试无效版本号"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, None)

        with pytest.raises(SkillError) as exc_info:
            await service.diff_versions(test_user, "skill-uuid-123", "../etc", "2.0.0")
        assert exc_info.value.code == SkillErrorCode.INVALID_VERSION


class TestSkillServiceRollbackVersion:
    """测试版本回滚"""

    @pytest.mark.asyncio
    async def test_rollback_version_not_owner(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试非所有者回滚"""
        test_skill.user_id = "different-user"
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        with pytest.raises(SkillError) as exc_info:
            await service.rollback_version(test_user, "skill-uuid-123", "1.0.0")
        assert exc_info.value.code == SkillErrorCode.SKILL_NOT_FOUND

    @pytest.mark.asyncio
    async def test_rollback_version_not_found(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试版本不存在"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        mock_version_repo.get_by_version = AsyncMock(return_value=None)
        service = SkillService(mock_skill_repo, mock_version_repo)

        with pytest.raises(SkillError) as exc_info:
            await service.rollback_version(test_user, "skill-uuid-123", "99.0.0")
        assert exc_info.value.code == SkillErrorCode.VERSION_NOT_FOUND


class TestSkillServiceInstallInstructions:
    """测试安装指令生成"""

    @pytest.mark.asyncio
    async def test_get_install_instructions_python(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试 Python 安装指令"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        mock_version_repo.get_by_version = AsyncMock(return_value=MagicMock(
            dependency_spec={
                "python": {
                    "manager": "pip",
                    "requirements": ["requests>=2.0.0"],
                    "files": ["requirements.txt"],
                }
            },
            dependencies=["requests>=2.0.0"],
        ))

        service = SkillService(mock_skill_repo, mock_version_repo)
        result = await service.get_install_instructions(test_user, "skill-uuid-123", "1.0.0")

        assert result["ecosystem"] == "python"
        assert "uv pip install" in result["commands"][0]

    @pytest.mark.asyncio
    async def test_get_install_instructions_node(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试 Node.js 安装指令"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        mock_version_repo.get_by_version = AsyncMock(return_value=MagicMock(
            dependency_spec={
                "node": {
                    "manager": "npm",
                    "lockfile": "package-lock.json",
                }
            },
            dependencies=[],
        ))

        service = SkillService(mock_skill_repo, mock_version_repo)
        result = await service.get_install_instructions(test_user, "skill-uuid-123", "1.0.0")

        assert result["ecosystem"] == "node"
        assert "npm ci" in result["commands"]

    @pytest.mark.asyncio
    async def test_get_install_instructions_deactivated(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试已停用技能的安装指令"""
        test_skill.is_active = False
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        with pytest.raises(SkillError) as exc_info:
            await service.get_install_instructions(test_user, "skill-uuid-123", "1.0.0")
        assert exc_info.value.code == SkillErrorCode.SKILL_DEACTIVATED

    @pytest.mark.asyncio
    async def test_get_install_instructions_version_not_found(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试版本不存在"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        mock_version_repo.get_by_version = AsyncMock(return_value=None)
        service = SkillService(mock_skill_repo, mock_version_repo)

        with pytest.raises(SkillError) as exc_info:
            await service.get_install_instructions(test_user, "skill-uuid-123", "99.0.0")
        assert exc_info.value.code == SkillErrorCode.VERSION_NOT_FOUND


class TestSkillServiceListVersions:
    """测试版本列表"""

    @pytest.mark.asyncio
    async def test_list_versions_success(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试成功列出版本"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        mock_version_repo.list_by_skill = AsyncMock(return_value=[
            MagicMock(version="1.0.0"),
            MagicMock(version="2.0.0"),
        ])

        service = SkillService(mock_skill_repo, mock_version_repo)
        result = await service.list_versions(test_user, "skill-uuid-123")

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_list_versions_without_repo(
        self, mock_skill_repo, test_user, test_skill
    ):
        """测试没有版本仓库"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, None)

        with pytest.raises(SkillError) as exc_info:
            await service.list_versions(test_user, "skill-uuid-123")
        assert exc_info.value.code == SkillErrorCode.VERSION_REPOSITORY_NOT_CONFIGURED


class TestSkillServiceDeactivateActivate:
    """测试技能激活/停用"""

    @pytest.mark.asyncio
    async def test_deactivate_skill_not_owner(
        self, mock_skill_repo, test_user, test_skill
    ):
        """测试非所有者停用"""
        test_skill.user_id = "different-user"
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, None)

        with pytest.raises(SkillError) as exc_info:
            await service.deactivate_skill(test_user, "skill-uuid-123")
        assert exc_info.value.code == SkillErrorCode.SKILL_NOT_FOUND

    @pytest.mark.asyncio
    async def test_activate_skill_not_owner(
        self, mock_skill_repo, test_user, test_skill
    ):
        """测试非所有者激活"""
        test_skill.user_id = "different-user"
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, None)

        with pytest.raises(SkillError) as exc_info:
            await service.activate_skill(test_user, "skill-uuid-123")
        assert exc_info.value.code == SkillErrorCode.SKILL_NOT_FOUND


class TestSkillServiceNextVersion:
    """测试版本号生成"""

    @pytest.mark.asyncio
    async def test_next_version_first(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试第一个版本号"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        test_skill.current_version = None
        mock_version_repo.list_by_skill = AsyncMock(return_value=[])
        mock_version_repo.get_by_version = AsyncMock(return_value=None)

        service = SkillService(mock_skill_repo, mock_version_repo)
        result = await service._next_version(test_skill, mock_version_repo)

        assert result == "1.0.0"

    @pytest.mark.asyncio
    async def test_next_version_increment(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试版本号递增"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        test_skill.current_version = "1.2.3"
        mock_version_repo.list_by_skill = AsyncMock(return_value=[
            MagicMock(version="1.2.3"),
        ])
        mock_version_repo.get_by_version = AsyncMock(return_value=None)

        service = SkillService(mock_skill_repo, mock_version_repo)
        result = await service._next_version(test_skill, mock_version_repo)

        assert result == "1.2.4"


class TestSkillServiceFileOperations:
    """测试文件操作"""

    @pytest.mark.asyncio
    async def test_read_skill_file_invalid_path(
        self, mock_skill_repo, test_user, test_skill
    ):
        """测试读取无效路径"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, None)

        with pytest.raises(SkillError) as exc_info:
            await service.read_skill_file(test_user, "skill-uuid-123", "../../../etc/passwd")
        assert exc_info.value.code == SkillErrorCode.INVALID_FILE_PATH

    @pytest.mark.asyncio
    async def test_list_skill_files_deactivated(
        self, mock_skill_repo, test_user, test_skill
    ):
        """测试列出已停用技能的文件"""
        test_skill.is_active = False
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, None)

        with pytest.raises(SkillError) as exc_info:
            await service.list_skill_files(test_user, "skill-uuid-123")
        assert exc_info.value.code == SkillErrorCode.SKILL_DEACTIVATED

    @pytest.mark.asyncio
    async def test_upload_file_too_large(
        self, mock_skill_repo, test_user, test_skill
    ):
        """测试上传过大文件"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, None)

        from backend.core.utils.skill_storage import MAX_FILE_SIZE

        large_content = b"x" * (MAX_FILE_SIZE + 1)

        with pytest.raises(SkillError) as exc_info:
            await service.upload_file(test_user, "skill-uuid-123", "large.txt", large_content)
        assert exc_info.value.code == SkillErrorCode.FILE_TOO_LARGE


class TestSkillServiceVisibility:
    """测试技能可见性"""

    @pytest.mark.asyncio
    async def test_update_skill_invalid_visibility(
        self, mock_skill_repo, test_user, test_skill
    ):
        """测试更新无效的可见性"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, None)

        with pytest.raises(SkillError) as exc_info:
            await service.update_skill(test_user, "skill-uuid-123", visibility="invalid")
        assert exc_info.value.code == SkillErrorCode.INVALID_VISIBILITY

    @pytest.mark.asyncio
    async def test_create_skill_invalid_visibility(
        self, mock_skill_repo, test_user
    ):
        """测试创建时无效的可见性"""
        mock_skill_repo.get_by_name = AsyncMock(return_value=None)
        service = SkillService(mock_skill_repo, None)

        with pytest.raises(SkillError) as exc_info:
            await service.create_skill(test_user, "test-skill", "desc", visibility="invalid")
        assert exc_info.value.code == SkillErrorCode.INVALID_VISIBILITY

    @pytest.mark.asyncio
    async def test_upload_zip_create_skill_invalid_visibility(
        self, mock_skill_repo, mock_version_repo, test_user
    ):
        mock_skill_repo.get_by_name = AsyncMock(return_value=None)
        service = SkillService(mock_skill_repo, mock_version_repo)
        zip_content = create_test_zip({"main.py": "print('hello')"})

        with pytest.raises(SkillError) as exc_info:
            await service.upload_zip_create_skill(test_user, "test.zip", zip_content, visibility="invalid")
        assert exc_info.value.code == SkillErrorCode.INVALID_VISIBILITY
