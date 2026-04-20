import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from backend.config.settings import settings
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.services.skill_clone import SkillCloneService
from backend.services.skill_download import SkillDownloadService
from backend.services.skill_errors import DownloadTooLargeError, SkillError, SkillErrorCode  # noqa: F401
from backend.services.skill_lifecycle import SkillLifecycleCoordinator
from backend.services.skill_storage import SkillStorageCoordinator
from backend.services.skill_upload import SkillUploadCoordinator
from backend.services.skill_version import SkillVersionCoordinator


class SkillService:
    _DOWNLOAD_ENCRYPTION_PURPOSE = "skill-download-encryption"

    def __init__(self, skill_repo: SkillRepository, version_repo: SkillVersionRepository | None = None):
        self.skill_repo = skill_repo
        self.version_repo = version_repo
        self.clone_service = SkillCloneService(skill_repo, version_repo) if version_repo else None
        self.download_service = SkillDownloadService(self._encrypt_payload, self._checksum_payload)
        self.lifecycle = SkillLifecycleCoordinator(skill_repo, version_repo, self.clone_service)
        self.versioning = SkillVersionCoordinator(
            self.lifecycle,
            version_repo,
            self.clone_service,
            self.download_service,
        )
        self.storage = SkillStorageCoordinator(self.lifecycle, self.versioning)
        self.uploads = SkillUploadCoordinator(self.lifecycle, version_repo)

    async def list_skills(
        self,
        user,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
        include_inactive: bool = False,
    ):
        return await self.lifecycle.list_skills(
            user,
            skip=skip,
            limit=limit,
            query=query,
            include_inactive=include_inactive,
        )

    async def get_skill(self, user, skill_id: str):
        return await self.lifecycle.get_skill(user, skill_id)

    @staticmethod
    def public_features_enabled() -> bool:
        return SkillLifecycleCoordinator.public_features_enabled()

    @staticmethod
    def is_public_skill(skill) -> bool:
        return SkillLifecycleCoordinator.is_public_skill(skill)

    @staticmethod
    def is_reference_skill(skill) -> bool:
        return SkillLifecycleCoordinator.is_reference_skill(skill)

    async def is_clone_skill(self, skill) -> bool:
        return await self.lifecycle.is_clone_skill(skill)

    async def skill_kind(self, skill) -> str:
        return await self.lifecycle.skill_kind(skill)

    async def _get_clone_origin_metadata(self, skill) -> dict[str, str]:
        return await self.lifecycle.get_clone_origin_metadata(skill)

    async def _next_version(self, skill, repo) -> str:
        return await self.uploads.next_version(skill, repo)

    async def resolve_version_dir(self, skill, requested_version: str | None = None):
        return await self.versioning.resolve_version_dir(skill, requested_version)

    async def create_skill(
        self,
        user,
        name: str,
        description: str,
        tags: list[str] | None = None,
        visibility: str | None = None,
        commit: bool = True,
    ):
        return await self.lifecycle.create_skill(
            user,
            name,
            description,
            tags=tags,
            visibility=visibility,
            commit=commit,
        )

    async def update_skill(self, user, skill_id: str, **fields):
        return await self.lifecycle.update_skill(user, skill_id, **fields)

    async def deactivate_skill(self, user, skill_id: str):
        return await self.lifecycle.deactivate_skill(user, skill_id)

    async def activate_skill(self, user, skill_id: str):
        return await self.lifecycle.activate_skill(user, skill_id)

    async def delete_skill(self, user, skill_id: str, delete_archives: bool = False) -> bool:
        return await self.lifecycle.delete_skill(user, skill_id, delete_archives=delete_archives)

    async def list_skill_files(self, user, skill_id: str) -> list[str]:
        return await self.storage.list_skill_files(user, skill_id)

    async def read_skill_file(self, user, skill_id: str, file_path: str) -> str:
        return await self.storage.read_skill_file(user, skill_id, file_path)

    async def upload_file(self, user, skill_id: str, filename: str, content: bytes) -> str:
        return await self.storage.upload_file(user, skill_id, filename, content)

    async def upload_file_from_path(self, user, skill_id: str, filename: str, source_path, content_size: int) -> str:
        return await self.storage.upload_file_from_path(user, skill_id, filename, source_path, content_size)

    async def list_public_skills(self, skip: int = 0, limit: int = 100, query: str | None = None):
        return await self.lifecycle.list_public_skills(skip=skip, limit=limit, query=query)

    async def count_public_skills(self, query: str | None = None) -> int:
        return await self.lifecycle.count_public_skills(query=query)

    async def get_public_skill(self, skill_id: str):
        return await self.lifecycle.get_public_skill(skill_id)

    async def create_reference_skill(self, user, public_skill_id: str, name: str, pinned_version: str | None = None):
        return await self.versioning.create_reference_skill(user, public_skill_id, name, pinned_version=pinned_version)

    async def clone_public_skill(self, user, public_skill_id: str, name: str, visibility: str = "private"):
        return await self.versioning.clone_public_skill(user, public_skill_id, name, visibility=visibility)

    async def pin_reference_version(self, user, skill_id: str, version: str):
        return await self.versioning.pin_reference_version(user, skill_id, version)

    async def unpin_reference_version(self, user, skill_id: str):
        return await self.versioning.unpin_reference_version(user, skill_id)

    async def resolved_version_for_skill(self, skill) -> str | None:
        return await self.versioning.resolved_version_for_skill(skill)

    async def list_versions(self, user, skill_id: str):
        return await self.versioning.list_versions(user, skill_id)

    async def get_version(self, user, skill_id: str, version: str):
        return await self.versioning.get_version(user, skill_id, version)

    async def download_skill(self, user, skill_id: str, version: str | None = None) -> dict:
        return await self.versioning.download_skill(user, skill_id, version=version)

    async def get_install_instructions(self, user, skill_id: str, version: str) -> dict:
        return await self.versioning.get_install_instructions(user, skill_id, version)

    async def diff_versions(self, user, skill_id: str, from_version: str, to_version: str) -> dict:
        return await self.versioning.diff_versions(user, skill_id, from_version, to_version)

    async def rollback_version(self, user, skill_id: str, version: str):
        return await self.versioning.rollback_version(user, skill_id, version)

    async def upload_zip(
        self,
        user,
        skill_id: str,
        filename: str,
        content: bytes,
        metadata_text: str | None = None,
    ) -> dict:
        return await self.uploads.upload_zip(user, skill_id, filename, content, metadata_text=metadata_text)

    async def upload_zip_from_path(
        self,
        user,
        skill_id: str,
        filename: str,
        archive_path,
        metadata_text: str | None = None,
    ) -> dict:
        return await self.uploads.upload_zip_from_path(
            user,
            skill_id,
            filename,
            archive_path,
            metadata_text=metadata_text,
        )

    async def upload_zip_create_skill(
        self,
        user,
        filename: str,
        content: bytes,
        visibility: str = "private",
    ) -> dict:
        return await self.uploads.upload_zip_create_skill(user, filename, content, visibility=visibility)

    async def upload_zip_create_skill_from_path(
        self,
        user,
        filename: str,
        archive_path,
        visibility: str = "private",
    ) -> dict:
        return await self.uploads.upload_zip_create_skill_from_path(
            user,
            filename,
            archive_path,
            visibility=visibility,
        )

    @staticmethod
    def _build_encryption_key(value: str, purpose: str = "skill-download-encryption") -> bytes:
        from backend.services.skill_support import build_encryption_key

        return build_encryption_key(value, purpose)

    @staticmethod
    def _encrypt_payload(payload: bytes) -> tuple[str, str]:
        key = SkillService._build_encryption_key(
            settings.SECRET_KEY,
            SkillService._DOWNLOAD_ENCRYPTION_PURPOSE,
        )
        nonce = os.urandom(12)
        encrypted = nonce + AESGCM(key).encrypt(nonce, payload, None)
        encoded = base64.b64encode(encrypted).decode("utf-8")
        checksum = hashlib.sha256(encrypted).hexdigest()
        return encoded, f"sha256:{checksum}"

    @staticmethod
    def _checksum_payload(payload: bytes) -> str:
        checksum = hashlib.sha256(payload).hexdigest()
        return f"sha256:{checksum}"
