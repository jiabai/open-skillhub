import base64
import io
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from loguru import logger

from backend.config.settings import settings
from backend.core.middleware.logging import safe_log_context
from backend.core.utils.skill_archive import load_archive, save_archive
from backend.services.skill_errors import (
    DownloadTooLargeError,
    SkillError,
    SkillErrorCode,
)


class SkillDownloadService:
    def __init__(
        self,
        encrypt_payload: Callable[[bytes], tuple[str, str]],
        checksum_payload: Callable[[bytes], str],
    ):
        self._encrypt_payload = encrypt_payload
        self._checksum_payload = checksum_payload

    async def build_download_payload(
        self,
        skill_id: str,
        target_version: str,
        version_dir: Path | None,
        source_user_id: str,
        source_skill_name: str,
        archive_bytes: bytes | None = None,
    ) -> dict[str, Any]:
        if archive_bytes is None:
            archive_bytes = await load_archive(
                source_user_id, source_skill_name, target_version
            )
            logger.bind(
                **safe_log_context(
                    skill_uuid=skill_id,
                    source_user_id=source_user_id,
                    source_skill_name=source_skill_name,
                    target_version=target_version,
                    archive_cache_hit=archive_bytes is not None,
                )
            ).debug("Skill download archive lookup completed")
        if archive_bytes is None:
            if version_dir is None or not version_dir.exists():
                logger.bind(
                    **safe_log_context(
                        skill_uuid=skill_id,
                        source_user_id=source_user_id,
                        source_skill_name=source_skill_name,
                        target_version=target_version,
                        version_dir=str(version_dir) if version_dir else "",
                    )
                ).debug("Skill download version files not found")
                raise SkillError(SkillErrorCode.VERSION_FILES_NOT_FOUND)
            buffer = io.BytesIO()
            file_count = 0
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
                for file_path in version_dir.rglob("*"):
                    if not file_path.is_file():
                        continue
                    relative = file_path.relative_to(version_dir)
                    archive.write(file_path, arcname=relative.as_posix())
                    file_count += 1
            archive_bytes = buffer.getvalue()
            logger.bind(
                **safe_log_context(
                    skill_uuid=skill_id,
                    target_version=target_version,
                    version_dir=str(version_dir),
                    file_count=file_count,
                    archive_size_bytes=len(archive_bytes),
                )
            ).debug("Skill download archive rebuilt from version files")
            await save_archive(
                source_user_id, source_skill_name, target_version, archive_bytes
            )

        archive_size_bytes = len(archive_bytes)
        if archive_size_bytes > settings.SKILL_DOWNLOAD_MAX_ARCHIVE_BYTES:
            logger.bind(
                **safe_log_context(
                    skill_uuid=skill_id,
                    target_version=target_version,
                    archive_size_bytes=archive_size_bytes,
                    limit_bytes=settings.SKILL_DOWNLOAD_MAX_ARCHIVE_BYTES,
                )
            ).debug("Skill download archive exceeds configured limit")
            raise DownloadTooLargeError(
                archive_size_bytes, settings.SKILL_DOWNLOAD_MAX_ARCHIVE_BYTES
            )

        if settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION:
            logger.bind(
                **safe_log_context(
                    skill_uuid=skill_id,
                    target_version=target_version,
                    archive_size_bytes=archive_size_bytes,
                )
            ).debug("Encrypting skill download archive")
            encrypted_code, checksum = self._encrypt_payload(archive_bytes)
            checksum_basis = "encrypted_payload"
            warning = None
        else:
            logger.bind(
                **safe_log_context(
                    skill_uuid=skill_id,
                    target_version=target_version,
                    archive_size_bytes=archive_size_bytes,
                )
            ).debug("Encoding unencrypted skill download archive")
            encrypted_code = base64.b64encode(archive_bytes).decode("utf-8")
            checksum = self._checksum_payload(archive_bytes)
            checksum_basis = "plaintext_archive"
            warning = "Download is not encrypted"

        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        encryption_enabled = settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION
        filename_suffix = ".encrypted.json" if encryption_enabled else ".json"
        return {
            "skill_uuid": skill_id,
            "version": target_version,
            "encrypted_code": encrypted_code,
            "checksum": checksum,
            "checksum_basis": checksum_basis,
            "expires_at": expires_at,
            "cache_ttl_seconds": settings.SKILL_CACHE_TTL_SECONDS,
            "archive_size_bytes": archive_size_bytes,
            "encryption_enabled": encryption_enabled,
            "download_filename": f"skill-{skill_id[:8]}-{target_version}{filename_suffix}",
            "decryption_hint": (
                "This download is encrypted and requires the official decryption tool before use."
                if encryption_enabled
                else None
            ),
            "warning": warning,
        }
