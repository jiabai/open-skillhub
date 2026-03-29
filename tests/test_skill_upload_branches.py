"""
SkillService upload_zip 分支覆盖测试
"""
import io
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.config.settings import settings
from backend.models.skill import Skill
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.services.skill import SkillService
from backend.core.utils.skill_storage import MAX_FILE_SIZE, MAX_TOTAL_SIZE, MAX_FILES_PER_SKILL


def create_zip_with_files(files: dict[str, str]) -> bytes:
    """创建包含指定文件的 ZIP"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("SKILL.md", "---\nname: test\nversion: 1.0.0\n---\n# Test")
        for path, content in files.items():
            zf.writestr(path, content)
    return buffer.getvalue()


@pytest.fixture
def mock_skill_repo():
    return AsyncMock(spec=SkillRepository)


@pytest.fixture
def mock_version_repo():
    return AsyncMock(spec=SkillVersionRepository)


@pytest.fixture
def test_user():
    user = MagicMock()
    user.id = "user-123"
    user.enterprise_id = None
    user.team_id = None
    return user


@pytest.fixture
def test_skill(test_user):
    skill = MagicMock(spec=Skill)
    skill.id = "skill-123"
    skill.name = "test-skill"
    skill.user_id = test_user.id
    skill.is_active = True
    skill.current_version = None
    skill.description = "Test"
    return skill


class TestSkillServiceUploadZipSizeLimits:
    """测试上传大小限制"""

    @pytest.mark.asyncio
    async def test_upload_zip_file_too_large(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试单个文件过大"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        # Create a zip with a file that exceeds MAX_FILE_SIZE
        large_content = "x" * (MAX_FILE_SIZE + 1)
        zip_content = create_zip_with_files({"large.txt": large_content})

        with pytest.raises(ValueError, match="File too large"):
            await service.upload_zip(test_user, "skill-123", "test.zip", zip_content)

    @pytest.mark.asyncio
    async def test_upload_zip_total_size_exceeded(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试总大小超限"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        # Create multiple files that together exceed MAX_TOTAL_SIZE
        # Use fewer larger files to hit the total size limit
        files = {}
        large_size = MAX_TOTAL_SIZE // 2 + 1000  # Each file is over half the limit
        files["large1.txt"] = "x" * large_size
        files["large2.txt"] = "x" * large_size
        zip_content = create_zip_with_files(files)

        with pytest.raises(ValueError, match="Total skill size limit exceeded"):
            await service.upload_zip(test_user, "skill-123", "test.zip", zip_content)

    @pytest.mark.asyncio
    async def test_upload_zip_too_many_files(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试文件数量过多"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        # Create more files than MAX_FILES_PER_SKILL
        files = {}
        for i in range(MAX_FILES_PER_SKILL + 1):
            files[f"file{i}.txt"] = "x"
        zip_content = create_zip_with_files(files)

        with pytest.raises(ValueError, match="Too many files in skill"):
            await service.upload_zip(test_user, "skill-123", "test.zip", zip_content)


class TestSkillServiceUploadZipPathValidation:
    """测试路径验证"""

    @pytest.mark.asyncio
    async def test_upload_zip_invalid_file_path(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试无效文件路径"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        service = SkillService(mock_skill_repo, mock_version_repo)

        # Create a zip with a file that has invalid path
        zip_content = create_zip_with_files({"../../../etc/passwd": "malicious"})

        with pytest.raises(ValueError):  # validate_file_path will raise
            await service.upload_zip(test_user, "skill-123", "test.zip", zip_content)


class TestSkillServiceUploadZipMetadata:
    """测试元数据处理"""

    @pytest.mark.asyncio
    async def test_upload_zip_with_environment_yml(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试 environment.yml"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        mock_version_repo.get_by_version = AsyncMock(return_value=None)
        mock_version_repo.list_by_skill = AsyncMock(return_value=[])
        mock_version_repo.create_version = AsyncMock(return_value=MagicMock(
            version="1.0.0", dependencies=[]
        ))
        mock_skill_repo.update = AsyncMock(return_value=test_skill)

        service = SkillService(mock_skill_repo, mock_version_repo)

        zip_content = create_zip_with_files({
            "environment.yml": "name: test\ndependencies:\n  - python=3.10"
        })

        with patch.object(settings, 'SKILL_STORAGE_PATH', '/tmp'):
            with patch('backend.services.skill.save_archive', new_callable=AsyncMock):
                with patch('backend.services.skill.get_skill_versions_dir') as mock_dir:
                    mock_dir.return_value = Path('/tmp/v')

                    with patch.object(Path, 'mkdir'):
                        with patch.object(Path, 'write_bytes'):
                            with patch('backend.services.skill.clear_skill_current_dir'):
                                with patch('backend.services.skill.get_user_skill_dir'):
                                    with patch.object(Path, 'exists', return_value=False):
                                        result = await service.upload_zip(
                                            test_user, "skill-123", "test.zip", zip_content
                                        )


class TestSkillServiceUploadZipVersionHandling:
    """测试版本处理"""

    @pytest.mark.asyncio
    async def test_upload_zip_existing_version_auto_increment(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试已存在版本时自动递增"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)

        # Version 1.0.0 exists
        mock_version_repo.get_by_version = AsyncMock(side_effect=[
            MagicMock(),  # 1.0.0 exists
            None,         # 1.0.1 doesn't exist
        ])
        mock_version_repo.list_by_skill = AsyncMock(return_value=[])
        mock_version_repo.create_version = AsyncMock(return_value=MagicMock(
            version="1.0.1", dependencies=[]
        ))
        mock_skill_repo.update = AsyncMock(return_value=test_skill)

        service = SkillService(mock_skill_repo, mock_version_repo)

        # ZIP specifies version 1.0.0 but it exists
        zip_content = create_zip_with_files({})

        with patch.object(settings, 'SKILL_STORAGE_PATH', '/tmp'):
            with patch('backend.services.skill.save_archive', new_callable=AsyncMock):
                with patch('backend.services.skill.get_skill_versions_dir') as mock_dir:
                    mock_dir.return_value = Path('/tmp/v')

                    with patch.object(Path, 'mkdir'):
                        with patch.object(Path, 'write_bytes'):
                            with patch('backend.services.skill.clear_skill_current_dir'):
                                with patch('backend.services.skill.get_user_skill_dir'):
                                    with patch.object(Path, 'exists', return_value=False):
                                        result = await service.upload_zip(
                                            test_user, "skill-123", "test.zip", zip_content
                                        )

        # Should use auto-incremented version
        assert mock_version_repo.create_version.called


class TestSkillServiceDeleteWithArchives:
    """测试删除技能时的存档处理"""

    @pytest.mark.asyncio
    async def test_delete_skill_without_archives(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试删除技能时保留存档"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        mock_skill_repo.delete = AsyncMock(return_value=True)
        service = SkillService(mock_skill_repo, mock_version_repo)

        with patch('backend.services.skill.delete_skill_dir') as mock_delete_dir:
            with patch('backend.services.skill.delete_archives_for_skill') as mock_delete_archives:
                result = await service.delete_skill(test_user, "skill-123", delete_archives=False)

        assert result is True
        mock_delete_dir.assert_called_once()
        mock_delete_archives.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_skill_with_archives(
        self, mock_skill_repo, mock_version_repo, test_user, test_skill
    ):
        """测试删除技能时同时删除存档"""
        mock_skill_repo.get_by_id = AsyncMock(return_value=test_skill)
        mock_skill_repo.delete = AsyncMock(return_value=True)
        service = SkillService(mock_skill_repo, mock_version_repo)

        with patch('backend.services.skill.delete_skill_dir') as mock_delete_dir:
            with patch('backend.services.skill.delete_archives_for_skill') as mock_delete_archives:
                result = await service.delete_skill(test_user, "skill-123", delete_archives=True)

        assert result is True
        mock_delete_dir.assert_called_once()
        mock_delete_archives.assert_called_once_with(test_user.id, test_skill.name)


class TestSkillArchiveUtils:
    """测试存档工具函数"""

    def test_bump_patch_version(self):
        """测试版本号递增"""
        from backend.core.utils.skill_archive import bump_patch_version

        assert bump_patch_version("1.0.0") == "1.0.1"
        assert bump_patch_version("1.2.3") == "1.2.4"
        assert bump_patch_version("2.10.99") == "2.10.100"

    def test_bump_patch_version_invalid(self):
        """测试无效版本号保持不变"""
        from backend.core.utils.skill_archive import bump_patch_version

        assert bump_patch_version("1.0") == "1.0"
        assert bump_patch_version("invalid") == "invalid"

    def test_list_archive_versions_empty(self, tmp_path):
        """测试空存档目录"""
        from backend.core.utils.skill_archive import list_archive_versions

        with patch('backend.core.utils.skill_archive.settings') as mock_settings:
            mock_settings.SKILL_STORAGE_PATH = str(tmp_path)
            mock_settings.SKILL_ARCHIVE_BACKEND = "local"

            versions = list_archive_versions("user-123", "test-skill")
            assert versions == []

    def test_list_archive_versions_with_files(self, tmp_path):
        """测试有存档文件的情况"""
        from backend.core.utils.skill_archive import list_archive_versions

        archive_dir = tmp_path / "_archives" / "user-123" / "test-skill"
        archive_dir.mkdir(parents=True)
        (archive_dir / "1.0.0.zip").write_bytes(b"fake zip")
        (archive_dir / "1.0.1.zip").write_bytes(b"fake zip")
        (archive_dir / "1.1.0.zip").write_bytes(b"fake zip")

        with patch('backend.core.utils.skill_archive.settings') as mock_settings:
            mock_settings.SKILL_STORAGE_PATH = str(tmp_path)
            mock_settings.SKILL_ARCHIVE_BACKEND = "local"

            versions = list_archive_versions("user-123", "test-skill")
            assert set(versions) == {"1.0.0", "1.0.1", "1.1.0"}

    def test_delete_archives_for_skill(self, tmp_path):
        """测试删除技能存档"""
        from backend.core.utils.skill_archive import delete_archives_for_skill

        archive_dir = tmp_path / "_archives" / "user-123" / "test-skill"
        archive_dir.mkdir(parents=True)
        (archive_dir / "1.0.0.zip").write_bytes(b"fake zip")

        with patch('backend.core.utils.skill_archive.settings') as mock_settings:
            mock_settings.SKILL_STORAGE_PATH = str(tmp_path)
            mock_settings.SKILL_ARCHIVE_BACKEND = "local"

            delete_archives_for_skill("user-123", "test-skill")
            assert not archive_dir.exists()


class TestUploadWithOrphanArchives:
    """测试上传时遇到孤儿存档的处理"""

    @pytest.mark.asyncio
    async def test_upload_with_orphan_archives_version_bump(
        self, mock_skill_repo, mock_version_repo, test_user
    ):
        """测试孤儿存档存在时自动版本递增"""
        mock_skill_repo.get_by_name = AsyncMock(return_value=None)
        mock_skill_repo.create = AsyncMock(return_value=MagicMock(id="skill-new", name="test-skill"))
        mock_version_repo.get_by_version = AsyncMock(return_value=None)
        mock_version_repo.list_by_skill = AsyncMock(return_value=[])
        mock_version_repo.create_version = AsyncMock(return_value=MagicMock(version="1.0.2"))

        service = SkillService(mock_skill_repo, mock_version_repo)

        zip_content = create_zip_with_files({})

        with patch('backend.services.skill.list_archive_versions') as mock_list_versions:
            mock_list_versions.return_value = ["1.0.0", "1.0.1"]
            with patch('backend.services.skill.save_archive', new_callable=AsyncMock):
                with patch('backend.services.skill.get_skill_versions_dir') as mock_dir:
                    mock_dir.return_value = Path('/tmp/v')
                    with patch.object(Path, 'mkdir'):
                        with patch.object(Path, 'write_bytes'):
                            with patch('backend.services.skill.clear_skill_current_dir'):
                                with patch('backend.services.skill.get_user_skill_dir'):
                                    with patch.object(Path, 'exists', return_value=False):
                                        result = await service.upload_zip_create_skill(
                                            test_user, "test.zip", zip_content, "private"
                                        )

        mock_version_repo.create_version.assert_called_once()
        call_args = mock_version_repo.create_version.call_args
        assert call_args[1]["version"] == "1.0.2"