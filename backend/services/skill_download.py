import base64
import io
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from backend.config.settings import settings
from backend.core.utils.skill_archive import load_archive, save_archive
from backend.services.skill_errors import DownloadTooLargeError


class SkillDownloadService:
    def __init__(self, encrypt_payload, checksum_payload):
        self._encrypt_payload = encrypt_payload
        self._checksum_payload = checksum_payload

    async def build_download_payload(
        self,
        skill_id: str,
        skill_uuid: str,
        target_version: str,
        version_dir: Path | None,
        source_user_id: str,
        source_skill_name: str,
        archive_bytes: bytes | None = None,
    ) -> dict:
        if archive_bytes is None:
            archive_bytes = await load_archive(source_user_id, source_skill_name, target_version)
        if archive_bytes is None:
            if version_dir is None or not version_dir.exists():
                raise ValueError("Version files not found")
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
                for file_path in version_dir.rglob("*"):
                    if not file_path.is_file():
                        continue
                    relative = file_path.relative_to(version_dir)
                    archive.write(file_path, arcname=relative.as_posix())
            archive_bytes = buffer.getvalue()
            await save_archive(source_user_id, source_skill_name, target_version, archive_bytes)

        archive_size_bytes = len(archive_bytes)
        if archive_size_bytes > settings.SKILL_DOWNLOAD_MAX_ARCHIVE_BYTES:
            raise DownloadTooLargeError(archive_size_bytes, settings.SKILL_DOWNLOAD_MAX_ARCHIVE_BYTES)

        if settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION:
            encrypted_code, checksum = self._encrypt_payload(archive_bytes)
        else:
            encrypted_code = base64.b64encode(archive_bytes).decode("utf-8")
            checksum = self._checksum_payload(archive_bytes)

        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        encryption_enabled = settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION
        filename_suffix = ".encrypted.json" if encryption_enabled else ".json"
        return {
            "skill_uuid": skill_uuid or skill_id,
            "version": target_version,
            "encrypted_code": encrypted_code,
            "checksum": checksum,
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
        }
