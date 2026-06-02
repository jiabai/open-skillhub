from pathlib import Path
import shutil
from typing import TYPE_CHECKING

from loguru import logger

from backend.config.settings import settings
from backend.core.middleware.logging import safe_log_context
from backend.core.utils.skill_storage import (
    MAX_FILES_PER_SKILL,
    MAX_FILE_SIZE,
    MAX_TOTAL_SIZE,
    get_safe_skill_path,
    get_user_skill_dir,
    list_files,
    validate_file_path,
    validate_filename,
)
from backend.models.user import User
from backend.services.skill_errors import SkillError, SkillErrorCode
from backend.services.skill_lifecycle import SkillLifecycleCoordinator
from backend.services.skill_upload import _cleanup_temp_upload, _write_temp_upload

if TYPE_CHECKING:
    from backend.services.skill_version import SkillVersionCoordinator


class SkillStorageCoordinator:
    def __init__(
        self,
        lifecycle: SkillLifecycleCoordinator,
        version_service: "SkillVersionCoordinator",
    ):
        self.lifecycle = lifecycle
        self.version_service = version_service

    async def list_skill_files(self, user: User, skill_id: str) -> list[str]:
        skill = await self.lifecycle.get_skill(user, skill_id)
        self.lifecycle.ensure_active(skill)
        if self.lifecycle.is_reference_skill(skill):
            _, _, _, version_dir = await self.version_service.resolve_version_dir(skill)
            files = []
            for item in version_dir.rglob("*"):
                if item.is_file():
                    files.append(str(item.relative_to(version_dir)).replace("\\", "/"))
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    skill_uuid=skill_id,
                    skill_name=skill.name,
                    file_count=len(files),
                )
            ).debug("Listed reference skill files")
            return files
        files = list_files(self.lifecycle.storage_owner_id(skill), skill.name)
        logger.bind(
            **safe_log_context(
                user_id=str(user.id),
                skill_uuid=skill_id,
                skill_name=skill.name,
                file_count=len(files),
            )
        ).debug("Listed skill files")
        return files

    async def read_skill_file(self, user: User, skill_id: str, file_path: str) -> str:
        skill = await self.lifecycle.get_skill(user, skill_id)
        self.lifecycle.ensure_active(skill)
        safe_path: Path | None
        if self.lifecycle.is_reference_skill(skill):
            _, _, _, version_dir = await self.version_service.resolve_version_dir(skill)
            valid, error = validate_file_path(file_path)
            if not valid:
                logger.bind(
                    **safe_log_context(
                        user_id=str(user.id),
                        skill_uuid=skill_id,
                        file_path=file_path,
                        reason=error,
                    )
                ).debug("Reference skill file read rejected because path is invalid")
                raise SkillError(SkillErrorCode.INVALID_FILE_PATH, error)
            safe_path = (version_dir / file_path).resolve()
            if not safe_path.is_relative_to(version_dir.resolve()):
                logger.bind(
                    **safe_log_context(
                        user_id=str(user.id), skill_uuid=skill_id, file_path=file_path
                    )
                ).debug(
                    "Reference skill file read rejected because path escaped version directory"
                )
                raise SkillError(SkillErrorCode.INVALID_FILE_PATH)
        else:
            base_dir = Path(settings.SKILL_STORAGE_PATH)
            safe_path = get_safe_skill_path(
                base_dir, self.lifecycle.storage_owner_id(skill), skill.name, file_path
            )
        if not safe_path:
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id), skill_uuid=skill_id, file_path=file_path
                )
            ).debug("Skill file read rejected because safe path could not be resolved")
            raise SkillError(SkillErrorCode.INVALID_FILE_PATH)
        if not safe_path.exists() or not safe_path.is_file():
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    skill_uuid=skill_id,
                    file_path=file_path,
                    safe_path=str(safe_path),
                )
            ).debug("Skill file read failed because file was not found")
            raise SkillError(SkillErrorCode.FILE_NOT_FOUND)
        logger.bind(
            **safe_log_context(
                user_id=str(user.id),
                skill_uuid=skill_id,
                file_path=file_path,
                safe_path=str(safe_path),
            )
        ).debug("Reading skill file")
        return safe_path.read_text(encoding="utf-8", errors="replace")

    async def upload_file(
        self, user: User, skill_id: str, filename: str, content: bytes
    ) -> str:
        temp_path = _write_temp_upload(
            content, suffix=Path(filename or "").suffix or ".upload"
        )
        try:
            return await self.upload_file_from_path(
                user, skill_id, filename, temp_path, len(content)
            )
        finally:
            _cleanup_temp_upload(temp_path)

    async def upload_file_from_path(
        self,
        user: User,
        skill_id: str,
        filename: str,
        source_path: Path,
        content_size: int,
    ) -> str:
        skill = await self.lifecycle.get_skill(user, skill_id)
        self.lifecycle.ensure_owner(user, skill)
        self.lifecycle.ensure_not_reference(skill)
        valid, error = validate_filename(filename)
        if not valid:
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    skill_uuid=skill_id,
                    filename=filename,
                    reason=error,
                )
            ).debug("Skill file upload rejected because filename is invalid")
            raise SkillError(SkillErrorCode.INVALID_FILENAME, error)
        if content_size > MAX_FILE_SIZE:
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    skill_uuid=skill_id,
                    filename=filename,
                    content_size=content_size,
                )
            ).debug("Skill file upload rejected because file is too large")
            raise SkillError(SkillErrorCode.FILE_TOO_LARGE)
        existing = list_files(user.id, skill.name)
        if len(existing) >= MAX_FILES_PER_SKILL:
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    skill_uuid=skill_id,
                    existing_file_count=len(existing),
                )
            ).debug("Skill file upload rejected because file count limit was reached")
            raise SkillError(SkillErrorCode.TOO_MANY_FILES)
        skill_dir = get_user_skill_dir(user.id, skill.name)
        total_size = 0
        for rel_path in existing:
            file_path = skill_dir / rel_path
            if file_path.exists() and file_path.is_file():
                total_size += file_path.stat().st_size
        if total_size + content_size > MAX_TOTAL_SIZE:
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    skill_uuid=skill_id,
                    total_size=total_size,
                    content_size=content_size,
                    max_total_size=MAX_TOTAL_SIZE,
                )
            ).debug(
                "Skill file upload rejected because total size limit would be exceeded"
            )
            raise SkillError(SkillErrorCode.TOTAL_SKILL_SIZE_LIMIT_EXCEEDED)
        base_dir = Path(settings.SKILL_STORAGE_PATH)
        safe_path = get_safe_skill_path(base_dir, user.id, skill.name, filename)
        if not safe_path:
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id), skill_uuid=skill_id, filename=filename
                )
            ).debug(
                "Skill file upload rejected because safe path could not be resolved"
            )
            raise SkillError(SkillErrorCode.INVALID_FILE_PATH)
        safe_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_path, safe_path)
        logger.bind(
            **safe_log_context(
                user_id=str(user.id),
                skill_uuid=skill_id,
                filename=filename,
                content_size=content_size,
                safe_path=str(safe_path),
            )
        ).debug("Skill file uploaded")
        return filename
