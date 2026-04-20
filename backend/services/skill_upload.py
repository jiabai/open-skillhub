from pathlib import Path
import tempfile

from loguru import logger

from backend.config.settings import settings
from backend.core.utils.skill_archive import bump_patch_version, list_archive_versions, save_archive, save_archive_from_path
from backend.core.utils.skill_storage import clear_skill_current_dir, get_skill_versions_dir, get_user_skill_dir, validate_skill_name
from backend.models.user import User
from backend.repositories.skill_version import SkillVersionRepository
from backend.services.skill_errors import SkillError, SkillErrorCode
from backend.services.skill_lifecycle import SkillLifecycleCoordinator
from backend.services.skill_support import (
    build_dependency_spec_from_archive,
    next_version,
    normalize_dependencies,
    normalize_dependency_spec,
    parse_metadata_text,
    read_skill_frontmatter,
    validate_version,
    validate_zip_archive,
)


def _write_temp_upload(content: bytes, suffix: str) -> Path:
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(content)
        return Path(temp_file.name)


def _cleanup_temp_upload(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning(f"[UPLOAD CLEANUP] Failed to remove temp file: {path}")


class SkillUploadCoordinator:
    def __init__(
        self,
        lifecycle: SkillLifecycleCoordinator,
        version_repo: SkillVersionRepository | None = None,
    ):
        self.lifecycle = lifecycle
        self.version_repo = version_repo

    def require_version_repo(self) -> SkillVersionRepository:
        if not self.version_repo:
            raise SkillError(SkillErrorCode.VERSION_REPOSITORY_NOT_CONFIGURED)
        return self.version_repo

    async def upload_zip(
        self,
        user: User,
        skill_id: str,
        filename: str,
        content: bytes,
        metadata_text: str | None = None,
    ) -> dict:
        temp_path = _write_temp_upload(content, suffix=".zip")
        try:
            return await self.upload_zip_from_path(
                user,
                skill_id,
                filename,
                temp_path,
                metadata_text=metadata_text,
                archive_bytes=content,
            )
        finally:
            _cleanup_temp_upload(temp_path)

    async def upload_zip_from_path(
        self,
        user: User,
        skill_id: str,
        filename: str,
        archive_path: Path,
        metadata_text: str | None = None,
        archive_bytes: bytes | None = None,
    ) -> dict:
        repo = self.require_version_repo()
        archive_size = archive_path.stat().st_size if archive_path.exists() else 0
        logger.debug(f"[UPLOAD_ZIP] user_id={user.id}, skill_id={skill_id}, filename={filename}, content_size={archive_size} bytes")
        skill = await self.lifecycle.get_skill(user, skill_id)
        self.lifecycle.ensure_owner(user, skill)
        self.lifecycle.ensure_not_reference(skill)
        logger.debug(f"[UPLOAD_ZIP] Found skill: name={skill.name}")
        archive_bundle = validate_zip_archive(filename, archive_path, SkillErrorCode.SKILL_MD_NOT_FOUND)
        with archive_bundle.archive as archive:
            entries = archive_bundle.entries
            entry_names = archive_bundle.entry_names
            logger.debug(f"[UPLOAD_ZIP] Found {len(entries)} files in zip")
            logger.debug(f"[UPLOAD_ZIP] Total file size: {sum(info.file_size for info in entries)} bytes")
            logger.debug("[UPLOAD_ZIP] Found SKILL.md")
            frontmatter = read_skill_frontmatter(archive)
            metadata = parse_metadata_text(metadata_text)
            version = str(metadata.get("version") or frontmatter.get("version") or "").strip()
            logger.debug(f"[UPLOAD_ZIP] Parsed version: {version}")
            if not version:
                version = await self.next_version(skill, repo)
                logger.debug(f"[UPLOAD_ZIP] Auto-generated version: {version}")
            version = validate_version(version)
            existing = await repo.get_by_version(skill.id, version)
            if existing:
                version = await self.next_version(skill, repo)
                logger.debug(f"[UPLOAD_ZIP] Version already exists, auto-incremented: {version}")
            description = str(metadata.get("description") or frontmatter.get("description") or skill.description)
            dependencies = normalize_dependencies(metadata.get("dependencies") or frontmatter.get("dependencies"))
            explicit_dependency_spec = normalize_dependency_spec(
                metadata.get("dependency_spec") or frontmatter.get("dependency_spec")
            )
            dependencies, dependency_spec, dependency_spec_version = build_dependency_spec_from_archive(
                archive,
                entry_names,
                dependencies,
                explicit_dependency_spec,
            )
            version_dir = self.prepare_version_dir(user.id, skill.name, version)
            logger.debug(f"[UPLOAD_ZIP] Creating version directory: {version_dir}")
            logger.debug(f"[UPLOAD_ZIP] Extracting {len(entries)} files to version directory")
            self.extract_archive_to_dir(archive, entries, version_dir)
            logger.debug(f"[UPLOAD_ZIP] Copying files to current directory: {get_user_skill_dir(user.id, skill.name)}")
            self.sync_version_dir_to_current(user.id, skill.name, version_dir)
            logger.debug(f"[UPLOAD_ZIP] Creating version record, version={version}")
            version_metadata = {
                "name": metadata.get("name") or frontmatter.get("name") or skill.name,
                "description": description,
                "version": version,
                "dependencies": dependencies,
                "dependency_spec": dependency_spec,
            }
            version_metadata.update(await self.lifecycle.get_clone_origin_metadata(skill))
            record = await repo.create_version(
                skill_id=skill.id,
                version=version,
                description=description,
                dependencies=dependencies,
                dependency_spec=dependency_spec,
                dependency_spec_version=dependency_spec_version,
                metadata=version_metadata,
            )
            await self.lifecycle.skill_repo.update(skill, current_version=version, description=description, is_active=True)
            logger.debug(f"[UPLOAD_ZIP] Saving archive, version={version}")
            await self.persist_archive(user.id, skill.name, version, archive_path, archive_bytes)
            logger.debug(f"[UPLOAD_ZIP] Success, skill_id={skill_id}, version={version}")
            return {
                "version": record.version,
                "current_version": version,
                "dependencies": record.dependencies,
            }

    async def upload_zip_create_skill(
        self,
        user: User,
        filename: str,
        content: bytes,
        visibility: str = "private",
    ) -> dict:
        temp_path = _write_temp_upload(content, suffix=".zip")
        try:
            return await self.upload_zip_create_skill_from_path(
                user,
                filename,
                temp_path,
                visibility,
                archive_bytes=content,
            )
        finally:
            _cleanup_temp_upload(temp_path)

    async def upload_zip_create_skill_from_path(
        self,
        user: User,
        filename: str,
        archive_path: Path,
        visibility: str = "private",
        archive_bytes: bytes | None = None,
    ) -> dict:
        repo = self.require_version_repo()
        archive_size = archive_path.stat().st_size if archive_path.exists() else 0
        logger.debug(f"[UPLOAD_ZIP_CREATE] user_id={user.id}, filename={filename}, content_size={archive_size} bytes")
        archive_bundle = validate_zip_archive(filename, archive_path, SkillErrorCode.SKILL_MD_NOT_FOUND_IN_ZIP)
        with archive_bundle.archive as archive:
            entries = archive_bundle.entries
            entry_names = archive_bundle.entry_names
            logger.debug(f"[UPLOAD_ZIP_CREATE] Found {len(entries)} files in zip")
            logger.debug(f"[UPLOAD_ZIP_CREATE] Total file size: {sum(info.file_size for info in entries)} bytes")
            logger.debug("[UPLOAD_ZIP_CREATE] Found SKILL.md")
            frontmatter = read_skill_frontmatter(archive)
            name = str(frontmatter.get("name") or "").strip()
            logger.debug(f"[UPLOAD_ZIP_CREATE] Parsed skill name: {name}")
            if not name:
                raise SkillError(SkillErrorCode.SKILL_MD_NAME_MISSING)
            valid, error = validate_skill_name(name)
            if not valid:
                raise SkillError(SkillErrorCode.INVALID_SKILL_NAME, error)
            if await self.lifecycle.skill_repo.get_by_name(user.id, name):
                raise SkillError(SkillErrorCode.SKILL_ALREADY_EXISTS, f"Skill '{name}' already exists")
            orphan_versions = list_archive_versions(user.id, name)
            logger.debug(f"[UPLOAD_ZIP_CREATE] Found orphan versions: {orphan_versions}")
            if orphan_versions:
                latest_orphan = max(
                    orphan_versions,
                    key=lambda item: tuple(map(int, item.split("."))) if all(part.isdigit() for part in item.split(".")) else (0, 0, 0),
                )
                version = str(frontmatter.get("version") or "").strip()
                logger.debug(f"[UPLOAD_ZIP_CREATE] Frontmatter version: {version}")
                if not version:
                    version = bump_patch_version(latest_orphan)
                    logger.debug(f"[UPLOAD_ZIP_CREATE] Auto-generated version from orphan: {version}")
                else:
                    version = validate_version(version)
                    try:
                        new_parts = tuple(map(int, version.split(".")))
                        latest_parts = tuple(map(int, latest_orphan.split(".")))
                        if new_parts <= latest_parts:
                            version = bump_patch_version(latest_orphan)
                            logger.debug(f"[UPLOAD_ZIP_CREATE] Bumped version: {version}")
                    except (ValueError, SkillError):
                        version = bump_patch_version(latest_orphan)
                        logger.debug(f"[UPLOAD_ZIP_CREATE] Bumped version (invalid original): {version}")
            else:
                version = str(frontmatter.get("version") or "").strip()
                logger.debug(f"[UPLOAD_ZIP_CREATE] Frontmatter version: {version}")
                if not version:
                    version = "1.0.0"
                    logger.debug(f"[UPLOAD_ZIP_CREATE] Auto-generated version: {version}")
                version = validate_version(version)
            description = str(frontmatter.get("description") or "").strip()
            visibility_value = (visibility or "private").strip().lower()
            if visibility_value not in {"private", "team", "enterprise"}:
                raise SkillError(SkillErrorCode.INVALID_VISIBILITY)
            skill = await self.lifecycle.create_skill(user, name, description, visibility=visibility_value)
            existing = await repo.get_by_version(skill.id, version)
            if existing:
                version = await self.next_version(skill, repo)
            dependencies = normalize_dependencies(frontmatter.get("dependencies"))
            explicit_dependency_spec = normalize_dependency_spec(frontmatter.get("dependency_spec"))
            dependencies, dependency_spec, dependency_spec_version = build_dependency_spec_from_archive(
                archive,
                entry_names,
                dependencies,
                explicit_dependency_spec,
            )
            logger.debug(f"[UPLOAD_ZIP_CREATE] Creating skill record, name={name}")
            version_dir = self.prepare_version_dir(user.id, skill.name, version)
            logger.debug(f"[UPLOAD_ZIP_CREATE] Creating version directory: {version_dir}")
            logger.debug(f"[UPLOAD_ZIP_CREATE] Extracting {len(entries)} files to version directory")
            self.extract_archive_to_dir(archive, entries, version_dir)
            logger.debug(f"[UPLOAD_ZIP_CREATE] Copying files to current directory: {get_user_skill_dir(user.id, skill.name)}")
            self.sync_version_dir_to_current(user.id, skill.name, version_dir)
            logger.debug(f"[UPLOAD_ZIP_CREATE] Creating version record, version={version}")
            record = await repo.create_version(
                skill_id=skill.id,
                version=version,
                description=description,
                dependencies=dependencies,
                dependency_spec=dependency_spec,
                dependency_spec_version=dependency_spec_version,
                metadata={
                    "name": name,
                    "description": description,
                    "version": version,
                    "dependencies": dependencies,
                    "dependency_spec": dependency_spec,
                },
            )
            await self.lifecycle.skill_repo.update(skill, current_version=version, description=description, is_active=True)
            logger.debug(f"[UPLOAD_ZIP_CREATE] Saving archive, version={version}")
            await self.persist_archive(user.id, skill.name, version, archive_path, archive_bytes)
            logger.info(f"[UPLOAD_ZIP_CREATE] Success, skill_id={skill.id}, version={version}")
            return {
                "id": skill.id,
                "name": skill.name,
                "description": skill.description,
                "version": record.version,
                "current_version": version,
                "dependencies": record.dependencies,
            }

    @staticmethod
    async def next_version(skill, repo: SkillVersionRepository) -> str:
        return await next_version(skill, repo, settings.SKILL_VERSION_BUMP_STRATEGY or "patch")

    @staticmethod
    def prepare_version_dir(user_id: str, skill_name: str, version: str) -> Path:
        base_dir = get_skill_versions_dir(user_id, skill_name)
        base_resolved = base_dir.resolve()
        version_dir = (base_dir / version).resolve()
        if not version_dir.is_relative_to(base_resolved):
            raise SkillError(SkillErrorCode.INVALID_VERSION)
        if version_dir.exists():
            raise SkillError(SkillErrorCode.VERSION_ALREADY_EXISTS)
        version_dir.mkdir(parents=True, exist_ok=True)
        return version_dir

    @staticmethod
    def extract_archive_to_dir(archive, entries: list[object], version_dir: Path) -> None:
        for info in entries:
            file_path = info.filename.replace("\\", "/").lstrip("/")
            target = version_dir / file_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(info))

    @staticmethod
    def sync_version_dir_to_current(user_id: str, skill_name: str, version_dir: Path) -> None:
        clear_skill_current_dir(user_id, skill_name)
        root_dir = get_user_skill_dir(user_id, skill_name)
        for entry_path in version_dir.rglob("*"):
            if not entry_path.is_file():
                continue
            relative = entry_path.relative_to(version_dir)
            target = root_dir / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(entry_path.read_bytes())

    @staticmethod
    async def persist_archive(
        user_id: str,
        skill_name: str,
        version: str,
        archive_path: Path,
        archive_bytes: bytes | None,
    ) -> None:
        if archive_bytes is not None:
            await save_archive(user_id, skill_name, version, archive_bytes)
            return
        await save_archive_from_path(user_id, skill_name, version, archive_path)
