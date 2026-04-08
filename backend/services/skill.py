from datetime import datetime, timedelta, timezone
import base64
import difflib
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import zipfile

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from loguru import logger
import yaml

from backend.config.settings import settings
from backend.core.security.rbac import is_skill_visible
from backend.core.utils.key_derivation import derive_aes256_key
from backend.core.utils.process_exec import quote_shell_arg
from backend.core.utils.skill_storage import (
    MAX_FILES_PER_SKILL,
    MAX_FILE_SIZE,
    MAX_TOTAL_SIZE,
    SYSTEM_USER_ID,
    clear_skill_current_dir,
    create_skill_dir,
    delete_skill_dir,
    get_safe_skill_path,
    get_skill_versions_dir,
    get_user_skill_dir,
    list_files,
    validate_file_path,
    validate_skill_name,
    validate_filename,
)
from backend.core.utils.skill_archive import (
    bump_patch_version,
    delete_archives_for_skill,
    list_archive_versions,
    load_archive,
    save_archive,
    save_archive_from_path,
)
from backend.models.skill import Skill
from backend.models.user import User
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository


class DownloadTooLargeError(ValueError):
    def __init__(self, size_bytes: int, limit_bytes: int):
        super().__init__("DOWNLOAD_TOO_LARGE")
        self.size_bytes = size_bytes
        self.limit_bytes = limit_bytes


class SkillService:
    _DOWNLOAD_ENCRYPTION_PURPOSE = "skill-download-encryption"

    def __init__(self, skill_repo: SkillRepository, version_repo: SkillVersionRepository | None = None):
        self.skill_repo = skill_repo
        self.version_repo = version_repo

    async def list_skills(
        self,
        user: User,
        skip: int = 0,
        limit: int = 100,
        query: str | None = None,
        include_inactive: bool = False,
    ) -> list[Skill]:
        return await self.skill_repo.list_visible(
            user.id,
            user.enterprise_id,
            user.team_id,
            skip=skip,
            limit=limit,
            query=query,
            include_inactive=include_inactive,
        )

    async def get_skill(self, user: User, skill_id: str) -> Skill:
        skill = await self.skill_repo.get_by_id(skill_id)
        if not skill:
            raise ValueError("Skill not found")
        if not is_skill_visible(user, skill):
            raise ValueError("Skill not found")
        return skill

    @staticmethod
    def public_features_enabled() -> bool:
        return bool(settings.ENABLE_SKILL_VISIBILITY) and not bool(settings.ENABLE_RBAC)

    @staticmethod
    def is_public_skill(skill: Skill) -> bool:
        return (skill.visibility or "").strip().lower() == "public"

    @staticmethod
    def is_reference_skill(skill: Skill) -> bool:
        source_skill_id = getattr(skill, "source_skill_id", None)
        return isinstance(source_skill_id, str) and bool(source_skill_id.strip())

    async def is_clone_skill(self, skill: Skill) -> bool:
        if self.is_reference_skill(skill) or self.is_public_skill(skill):
            return False
        if not skill.current_version or not self.version_repo:
            return False
        record = await self.version_repo.get_by_version(skill.id, skill.current_version)
        if not record:
            return False
        return bool((record.metadata_json or {}).get("cloned_from_skill_id"))

    async def skill_kind(self, skill: Skill) -> str:
        if self.is_reference_skill(skill):
            return "reference"
        if self.is_public_skill(skill):
            return "public"
        if await self.is_clone_skill(skill):
            return "clone"
        return "regular"

    @staticmethod
    def _assert_public_features_enabled() -> None:
        if not SkillService.public_features_enabled():
            raise ValueError("PUBLIC_SKILLS_DISABLED")

    @staticmethod
    def _ensure_not_reference(skill: Skill) -> None:
        if SkillService.is_reference_skill(skill):
            raise ValueError("REFERENCE_SKILL_READ_ONLY")

    async def _resolve_source_skill(self, skill: Skill) -> Skill:
        if not skill.source_skill_id:
            return skill
        source_skill = await self.skill_repo.get_by_id(skill.source_skill_id)
        if not source_skill or not self.is_public_skill(source_skill) or not source_skill.is_active:
            raise ValueError("SOURCE_SKILL_UNAVAILABLE")
        return source_skill

    async def _resolve_version_and_record(
        self,
        skill: Skill,
        requested_version: str | None = None,
    ) -> tuple[Skill, str, object]:
        repo = self._require_version_repo()
        source_skill = await self._resolve_source_skill(skill)
        version = ""
        if self.is_reference_skill(skill):
            version = str(skill.pinned_version or requested_version or source_skill.current_version or "").strip()
        else:
            version = str(requested_version or source_skill.current_version or "").strip()
        if not version:
            versions = await repo.list_by_skill(source_skill.id)
            if versions:
                version = versions[0].version
        if not version:
            raise ValueError("Version not found")
        version = self._validate_version(version)
        record = await repo.get_by_version(source_skill.id, version)
        if not record:
            raise ValueError("Version not found")
        return source_skill, version, record

    async def resolve_version_dir(
        self,
        skill: Skill,
        requested_version: str | None = None,
    ) -> tuple[Skill, str, object, Path]:
        source_skill, version, record = await self._resolve_version_and_record(skill, requested_version)
        version_dir = get_skill_versions_dir(source_skill.user_id, source_skill.name) / version
        if not version_dir.exists():
            raise ValueError("Version files not found")
        return source_skill, version, record, version_dir

    async def create_skill(
        self,
        user: User,
        name: str,
        description: str,
        tags: list[str] | None = None,
        visibility: str | None = None,
    ) -> Skill:
        valid, error = validate_skill_name(name)
        if not valid:
            raise ValueError(error)
        if await self.skill_repo.get_by_name(user.id, name):
            raise ValueError("Skill already exists")
        tags = tags or []
        visibility_value = (visibility or settings.DEFAULT_SKILL_VISIBILITY or "private").strip().lower()
        if visibility_value not in {"private", "team", "enterprise"}:
            raise ValueError("Invalid visibility")
        path = create_skill_dir(user.id, name)
        return await self.skill_repo.create(
            user_id=user.id,
            name=name,
            description=description,
            tags=tags,
            visibility=visibility_value,
            enterprise_id=user.enterprise_id,
            team_id=user.team_id,
            skill_dir=str(path),
        )

    async def update_skill(self, user: User, skill_id: str, **fields) -> Skill:
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        if self.is_reference_skill(skill):
            disallowed = {"description", "tags", "visibility"}
            if any(key in fields for key in disallowed):
                raise ValueError("REFERENCE_SKILL_READ_ONLY")
        visibility = fields.get("visibility")
        if visibility is not None:
            normalized = str(visibility).strip().lower()
            if normalized not in {"private", "team", "enterprise"}:
                raise ValueError("Invalid visibility")
            fields["visibility"] = normalized
        new_name = fields.get("name")
        if new_name is None:
            fields.pop("name", None)
        elif new_name != skill.name:
            valid, error = validate_skill_name(new_name)
            if not valid:
                raise ValueError(error)
            existing = await self.skill_repo.get_by_name(user.id, new_name)
            if existing and existing.id != skill.id:
                raise ValueError("Skill already exists")
            if not self.is_reference_skill(skill):
                old_dir = get_user_skill_dir(user.id, skill.name)
                new_dir = get_user_skill_dir(user.id, new_name)
                if old_dir.exists():
                    new_dir.parent.mkdir(parents=True, exist_ok=True)
                    old_dir.rename(new_dir)
                else:
                    new_dir.mkdir(parents=True, exist_ok=True)
                fields["skill_dir"] = str(new_dir)
        return await self.skill_repo.update(skill, **fields)

    async def deactivate_skill(self, user: User, skill_id: str) -> Skill:
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        self._ensure_not_reference(skill)
        now = datetime.now(timezone.utc).replace(microsecond=0)
        return await self.skill_repo.update(skill, is_active=False, cache_revoked_at=now)

    async def activate_skill(self, user: User, skill_id: str) -> Skill:
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        self._ensure_not_reference(skill)
        return await self.skill_repo.update(skill, is_active=True, cache_revoked_at=None)

    async def delete_skill(self, user: User, skill_id: str, delete_archives: bool = False) -> bool:
        logger.info(f"[DELETE_SKILL] user_id={user.id}, skill_id={skill_id}, delete_archives={delete_archives}")
        skill = await self.get_skill(user, skill_id)
        logger.debug(f"[DELETE_SKILL] Found skill: name={skill.name}, id={skill.id}")
        self._ensure_owner(user, skill)
        if self.is_reference_skill(skill):
            await self.skill_repo.delete(skill)
            logger.info(f"[DELETE_SKILL] Deleted reference skill, skill_name={skill.name}")
            return True
        await self.skill_repo.delete(skill)
        delete_skill_dir(user.id, skill.name)
        if delete_archives:
            delete_archives_for_skill(user.id, skill.name)
        logger.info(f"[DELETE_SKILL] Success, skill_name={skill.name}")
        return True

    async def list_skill_files(self, user: User, skill_id: str) -> list[str]:
        skill = await self.get_skill(user, skill_id)
        self._ensure_active(skill)
        if self.is_reference_skill(skill):
            _, _, _, version_dir = await self.resolve_version_dir(skill)
            files = []
            for item in version_dir.rglob("*"):
                if item.is_file():
                    files.append(str(item.relative_to(version_dir)).replace("\\", "/"))
            return files
        return list_files(user.id, skill.name)

    async def read_skill_file(self, user: User, skill_id: str, file_path: str) -> str:
        skill = await self.get_skill(user, skill_id)
        self._ensure_active(skill)
        if self.is_reference_skill(skill):
            _, _, _, version_dir = await self.resolve_version_dir(skill)
            valid, error = validate_file_path(file_path)
            if not valid:
                raise ValueError(error)
            safe_path = (version_dir / file_path).resolve()
            if not safe_path.is_relative_to(version_dir.resolve()):
                raise ValueError("Invalid file path")
        else:
            base_dir = Path(settings.SKILL_STORAGE_PATH)
            safe_path = get_safe_skill_path(base_dir, user.id, skill.name, file_path)
        if not safe_path:
            raise ValueError("Invalid file path")
        if not safe_path.exists() or not safe_path.is_file():
            raise ValueError("File not found")
        return safe_path.read_text(encoding="utf-8", errors="replace")

    async def upload_file(self, user: User, skill_id: str, filename: str, content: bytes) -> str:
        temp_path = self._write_temp_upload(content, suffix=Path(filename or "").suffix or ".upload")
        try:
            return await self.upload_file_from_path(user, skill_id, filename, temp_path, len(content))
        finally:
            self._cleanup_temp_path(temp_path)

    async def upload_file_from_path(
        self,
        user: User,
        skill_id: str,
        filename: str,
        source_path: Path,
        content_size: int,
    ) -> str:
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        self._ensure_not_reference(skill)
        valid, error = validate_filename(filename)
        if not valid:
            raise ValueError(error)
        if content_size > MAX_FILE_SIZE:
            raise ValueError("File too large")
        existing = list_files(user.id, skill.name)
        if len(existing) >= MAX_FILES_PER_SKILL:
            raise ValueError("Too many files in skill")
        skill_dir = get_user_skill_dir(user.id, skill.name)
        total_size = 0
        for rel_path in existing:
            file_path = skill_dir / rel_path
            if file_path.exists() and file_path.is_file():
                total_size += file_path.stat().st_size
        if total_size + content_size > MAX_TOTAL_SIZE:
            raise ValueError("Total skill size limit exceeded")
        base_dir = Path(settings.SKILL_STORAGE_PATH)
        safe_path = get_safe_skill_path(base_dir, user.id, skill.name, filename)
        if not safe_path:
            raise ValueError("Invalid file path")
        safe_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_path, safe_path)
        return filename

    def _require_version_repo(self) -> SkillVersionRepository:
        if not self.version_repo:
            raise ValueError("Version repository not configured")
        return self.version_repo

    @staticmethod
    def _ensure_active(skill: Skill) -> None:
        if not skill.is_active:
            raise ValueError("SKILL_DEACTIVATED")

    @staticmethod
    def _ensure_owner(user: User, skill: Skill) -> None:
        if skill.user_id != user.id:
            raise ValueError("Skill not found")

    @staticmethod
    def _parse_frontmatter(content: str) -> dict:
        stripped = content.lstrip()
        if not stripped.startswith("---"):
            return {}
        parts = stripped.split("---", 2)
        if len(parts) < 3:
            return {}
        frontmatter_text = parts[1].strip()
        if not frontmatter_text:
            return {}
        try:
            parsed = yaml.safe_load(frontmatter_text)
        except yaml.YAMLError:
            return {}
        if isinstance(parsed, dict):
            return parsed
        return {}

    @staticmethod
    def _validate_version(version: str) -> str:
        normalized = str(version or "").strip()
        if not normalized:
            raise ValueError("Invalid version")
        if len(normalized) > 100:
            raise ValueError("Invalid version")
        if normalized.startswith("."):
            raise ValueError("Invalid version")
        if "/" in normalized or "\\" in normalized:
            raise ValueError("Invalid version")
        if ".." in normalized or normalized in {".", ".."}:
            raise ValueError("Invalid version")
        if not re.fullmatch(r"[a-zA-Z0-9_\-\.]+", normalized):
            raise ValueError("Invalid version")
        return normalized

    @staticmethod
    def _normalize_dependencies(value: object) -> list[str]:
        if isinstance(value, list):
            return [str(item) for item in value]
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return []

    @staticmethod
    def _parse_requirements_text(text: str) -> list[str]:
        items: list[str] = []
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            items.append(stripped)
        return items

    @staticmethod
    def _build_encryption_key(value: str, purpose: str = "skill-download-encryption") -> bytes:
        return derive_aes256_key(value, purpose)

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

    @staticmethod
    def _normalize_dependency_spec(value: object) -> dict | None:
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except Exception:
                return None
            if isinstance(parsed, dict):
                return parsed
        return None

    @staticmethod
    def _parse_semver(version: str) -> tuple[str, int, int, int] | None:
        match = re.fullmatch(r"(v)?(\d+)\.(\d+)\.(\d+)", version)
        if not match:
            return None
        prefix = "v" if match.group(1) else ""
        return prefix, int(match.group(2)), int(match.group(3)), int(match.group(4))

    async def _next_version(self, skill: Skill, repo: SkillVersionRepository) -> str:
        candidates: list[str] = []
        if skill.current_version:
            candidates.append(skill.current_version)
        versions = await repo.list_by_skill(skill.id)
        candidates.extend([record.version for record in versions if record.version])
        parsed_versions = [self._parse_semver(item) for item in candidates]
        semvers = [item for item in parsed_versions if item is not None]
        if not semvers:
            return "1.0.0"
        prefix, major, minor, patch = max(semvers, key=lambda item: (item[1], item[2], item[3]))
        strategy = (settings.SKILL_VERSION_BUMP_STRATEGY or "patch").strip().lower()
        if strategy == "minor":
            next_major = major
            next_minor = minor + 1
            next_patch = 0
            next_version = f"{prefix}{next_major}.{next_minor}.{next_patch}"
            while await repo.get_by_version(skill.id, next_version):
                next_minor += 1
                next_version = f"{prefix}{next_major}.{next_minor}.{next_patch}"
            return next_version
        next_patch = patch + 1
        next_version = f"{prefix}{major}.{minor}.{next_patch}"
        while await repo.get_by_version(skill.id, next_version):
            next_patch += 1
            next_version = f"{prefix}{major}.{minor}.{next_patch}"
        return next_version

    @staticmethod
    def _detect_python_dependency_spec(
        entry_names: set[str],
        archive,
        requirements: list[str],
    ) -> tuple[dict[str, object], list[str]]:
        python_spec: dict[str, object] = {}
        deps = list(requirements)
        if "pyproject.toml" in entry_names:
            has_uv_lock = "uv.lock" in entry_names
            python_spec = {
                "manager": "uv",
                "requirements": deps,
                "files": ["pyproject.toml"],
                "lockfile": "uv.lock" if has_uv_lock else None,
            }
        elif "requirements.txt" in entry_names:
            try:
                requirements_text = archive.read("requirements.txt").decode("utf-8", errors="replace")
            except Exception:
                requirements_text = ""
            parsed = SkillService._parse_requirements_text(requirements_text)
            if parsed:
                deps = parsed
            python_spec = {
                "manager": "pip",
                "requirements": deps,
                "files": ["requirements.txt"],
            }
        elif "environment.yml" in entry_names:
            python_spec = {
                "manager": "conda",
                "requirements": deps,
                "files": ["environment.yml"],
            }
        if not python_spec and deps:
            python_spec = {
                "manager": "pip",
                "requirements": deps,
                "files": [],
            }
        return python_spec, deps

    @staticmethod
    def _build_python_commands(manager: str, requirements: list[str], files: list[str]) -> list[str]:
        commands: list[str] = []
        quoted_requirements = [quote_shell_arg(str(item)) for item in requirements if str(item).strip()]
        if manager == "pip":
            if "requirements.txt" in files:
                commands.append("pip install -r requirements.txt")
            if quoted_requirements:
                commands.append("pip install " + " ".join(quoted_requirements))
        elif manager == "poetry":
            commands.append("poetry install")
        elif manager == "uv":
            if "pyproject.toml" in files:
                commands.append("uv sync")
            elif "requirements.txt" in files:
                commands.append("uv pip install -r requirements.txt")
            if quoted_requirements:
                commands.append("uv pip install " + " ".join(quoted_requirements))
        elif manager == "conda":
            if "environment.yml" in files:
                commands.append("conda env create -f environment.yml")
        return commands

    @staticmethod
    def _build_node_commands(manager: str, has_lockfile: bool) -> list[str]:
        if manager == "pnpm":
            return ["pnpm install"]
        if manager == "yarn":
            return ["yarn install"]
        return ["npm ci" if has_lockfile else "npm install"]

    async def list_public_skills(self, skip: int = 0, limit: int = 100, query: str | None = None) -> list[Skill]:
        self._assert_public_features_enabled()
        return await self.skill_repo.list_public(skip=skip, limit=limit, query=query)

    async def count_public_skills(self, query: str | None = None) -> int:
        self._assert_public_features_enabled()
        return await self.skill_repo.count_public(query=query)

    async def get_public_skill(self, skill_id: str) -> Skill:
        self._assert_public_features_enabled()
        skill = await self.skill_repo.get_public_by_id(skill_id)
        if not skill or not skill.is_active:
            raise ValueError("SKILL_NOT_FOUND")
        return skill

    async def _get_public_source_skill(self, skill_id: str) -> Skill:
        self._assert_public_features_enabled()
        skill = await self.skill_repo.get_public_by_id(skill_id)
        if not skill or not skill.is_active:
            raise ValueError("SKILL_NOT_FOUND")
        return skill

    async def create_reference_skill(
        self,
        user: User,
        public_skill_id: str,
        name: str,
        pinned_version: str | None = None,
    ) -> Skill:
        self._assert_public_features_enabled()
        source_skill = await self._get_public_source_skill(public_skill_id)
        valid, error = validate_skill_name(name)
        if not valid:
            raise ValueError(error)
        existing_reference = await self.skill_repo.get_reference_by_source(user.id, source_skill.id)
        if existing_reference:
            raise ValueError("REFERENCE_ALREADY_EXISTS")
        if await self.skill_repo.get_by_name(user.id, name):
            raise ValueError("Skill already exists")
        pinned_value = None
        if pinned_version:
            _, pinned_value, _ = await self._resolve_version_and_record(source_skill, pinned_version)
        return await self.skill_repo.create(
            user_id=user.id,
            name=name,
            description=source_skill.description,
            tags=list(source_skill.tags or []),
            visibility="private",
            enterprise_id=user.enterprise_id,
            team_id=user.team_id,
            source_skill_id=source_skill.id,
            pinned_version=pinned_value,
            skill_dir="",
            current_version=None,
            is_active=True,
        )

    async def clone_public_skill(
        self,
        user: User,
        public_skill_id: str,
        name: str,
        visibility: str = "private",
    ) -> dict:
        self._assert_public_features_enabled()
        repo = self._require_version_repo()
        source_skill = await self._get_public_source_skill(public_skill_id)
        _, resolved_version, source_record, source_version_dir = await self.resolve_version_dir(source_skill)
        skill = None
        try:
            skill = await self.create_skill(
                user,
                name,
                source_skill.description,
                tags=list(source_skill.tags or []),
                visibility=visibility,
            )
            version = "1.0.0"
            version_dir = get_skill_versions_dir(skill.user_id, skill.name) / version
            version_dir.mkdir(parents=True, exist_ok=True)
            for entry_path in source_version_dir.rglob("*"):
                if not entry_path.is_file():
                    continue
                relative = entry_path.relative_to(source_version_dir)
                target = version_dir / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(entry_path, target)
            clear_skill_current_dir(skill.user_id, skill.name)
            root_dir = get_user_skill_dir(skill.user_id, skill.name)
            for entry_path in version_dir.rglob("*"):
                if not entry_path.is_file():
                    continue
                relative = entry_path.relative_to(version_dir)
                target = root_dir / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(entry_path, target)
            metadata = dict(source_record.metadata_json or {})
            metadata["cloned_from_skill_id"] = source_skill.id
            metadata["cloned_from_version"] = resolved_version
            record = await repo.create_version(
                skill_id=skill.id,
                version=version,
                description=source_record.description,
                dependencies=list(source_record.dependencies or []),
                dependency_spec=dict(source_record.dependency_spec or {}),
                dependency_spec_version=source_record.dependency_spec_version,
                metadata=metadata,
            )
            await self.skill_repo.update(skill, current_version=version, description=record.description, is_active=True)
            return {
                "skill": skill,
                "version": record.version,
                "current_version": version,
            }
        except Exception:
            if skill is not None:
                try:
                    await self.skill_repo.session.rollback()
                except Exception:
                    pass
                try:
                    persisted_skill = await self.skill_repo.get_by_id(skill.id)
                    if persisted_skill:
                        await self.skill_repo.delete(persisted_skill)
                except Exception:
                    logger.exception("Failed to delete partially created cloned skill")
                try:
                    delete_skill_dir(skill.user_id, skill.name)
                except Exception:
                    logger.exception("Failed to clean up partially created cloned skill directory")
            raise

    async def pin_reference_version(self, user: User, skill_id: str, version: str) -> Skill:
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        if not self.is_reference_skill(skill):
            raise ValueError("Skill not found")
        normalized = self._validate_version(version)
        source_skill = await self._resolve_source_skill(skill)
        repo = self._require_version_repo()
        record = await repo.get_by_version(source_skill.id, normalized)
        if not record:
            raise ValueError("Version not found")
        return await self.skill_repo.update(skill, pinned_version=normalized)

    async def unpin_reference_version(self, user: User, skill_id: str) -> Skill:
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        if not self.is_reference_skill(skill):
            raise ValueError("Skill not found")
        return await self.skill_repo.update(skill, pinned_version=None)

    async def resolved_version_for_skill(self, skill: Skill) -> str | None:
        try:
            _, version, _ = await self._resolve_version_and_record(skill)
            return version
        except ValueError:
            return None

    async def list_versions(self, user: User, skill_id: str):
        repo = self._require_version_repo()
        skill = await self.get_skill(user, skill_id)
        source_skill = await self._resolve_source_skill(skill)
        return await repo.list_by_skill(source_skill.id)

    async def get_version(self, user: User, skill_id: str, version: str):
        repo = self._require_version_repo()
        skill = await self.get_skill(user, skill_id)
        version = self._validate_version(version)
        source_skill = await self._resolve_source_skill(skill)
        record = await repo.get_by_version(source_skill.id, version)
        if not record:
            raise ValueError("Version not found")
        return record

    async def download_skill(self, user: User, skill_id: str, version: str | None = None) -> dict:
        skill = await self.get_skill(user, skill_id)
        self._ensure_active(skill)
        source_skill, target_version, _record, version_dir = await self.resolve_version_dir(skill, version)
        archive_bytes = await load_archive(source_skill.user_id, source_skill.name, target_version)
        if archive_bytes is None:
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
                for file_path in version_dir.rglob("*"):
                    if not file_path.is_file():
                        continue
                    relative = file_path.relative_to(version_dir)
                    archive.write(file_path, arcname=relative.as_posix())
            archive_bytes = buffer.getvalue()
            await save_archive(source_skill.user_id, source_skill.name, target_version, archive_bytes)
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
            "skill_uuid": skill.id,
            "version": target_version,
            "encrypted_code": encrypted_code,
            "checksum": checksum,
            "expires_at": expires_at,
            "cache_ttl_seconds": settings.SKILL_CACHE_TTL_SECONDS,
            "archive_size_bytes": archive_size_bytes,
            "encryption_enabled": encryption_enabled,
            "download_filename": f"skill-{skill.id[:8]}-{target_version}{filename_suffix}",
            "decryption_hint": (
                "This download is encrypted and requires the official decryption tool before use."
                if encryption_enabled
                else None
            ),
        }

    async def get_install_instructions(self, user: User, skill_id: str, version: str) -> dict:
        skill = await self.get_skill(user, skill_id)
        self._ensure_active(skill)
        _, version, record = await self._resolve_version_and_record(skill, version)
        dependency_spec = dict(record.dependency_spec or {})
        dependencies = list(record.dependencies or [])
        requirements_text = "\n".join(dependencies)
        commands: list[str] = []
        ecosystem = None
        manifests: dict | None = None
        if dependency_spec:
            manifests = {"dependency_spec": dependency_spec}
            python_spec = dependency_spec.get("python")
            node_spec = dependency_spec.get("node")
            if isinstance(python_spec, dict):
                ecosystem = "python"
                requirements = [str(item) for item in python_spec.get("requirements", []) if str(item).strip()]
                files = [str(item) for item in python_spec.get("files", []) if str(item).strip()]
                manager = str(python_spec.get("manager") or "pip")
                if requirements:
                    dependencies = requirements
                    requirements_text = "\n".join(requirements)
                commands = self._build_python_commands(manager, dependencies, files)
            elif isinstance(node_spec, dict):
                ecosystem = "node"
                manager = str(node_spec.get("manager") or "npm")
                lockfile = str(node_spec.get("lockfile") or "")
                commands = self._build_node_commands(manager, bool(lockfile))
                dependencies = []
                requirements_text = ""
        if not commands and dependencies:
            commands = [
                "pip install " + " ".join(quote_shell_arg(str(item)) for item in dependencies if str(item).strip()),
                "pip install -r requirements.txt",
            ]
        return {
            "strategy": "client",
            "dependencies": dependencies,
            "requirements_text": requirements_text,
            "commands": commands,
            "ecosystem": ecosystem,
            "manifests": manifests,
            "dependency_spec": dependency_spec or None,
        }

    async def diff_versions(self, user: User, skill_id: str, from_version: str, to_version: str) -> dict:
        skill = await self.get_skill(user, skill_id)
        self._ensure_active(skill)
        source_skill = await self._resolve_source_skill(skill)
        base_dir = get_skill_versions_dir(source_skill.user_id, source_skill.name)
        base_resolved = base_dir.resolve()
        from_version = self._validate_version(from_version)
        to_version = self._validate_version(to_version)
        from_dir = (base_dir / from_version).resolve()
        to_dir = (base_dir / to_version).resolve()
        if not from_dir.is_relative_to(base_resolved) or not to_dir.is_relative_to(base_resolved):
            raise ValueError("Invalid version")
        if not from_dir.exists() or not to_dir.exists():
            raise ValueError("Version files not found")
        from_files = {
            str(path.relative_to(from_dir)).replace("\\", "/")
            for path in from_dir.rglob("*")
            if path.is_file()
        }
        to_files = {str(path.relative_to(to_dir)).replace("\\", "/") for path in to_dir.rglob("*") if path.is_file()}
        added = sorted(to_files - from_files)
        removed = sorted(from_files - to_files)
        modified: list[dict] = []
        for relative in sorted(from_files & to_files):
            left = from_dir / relative
            right = to_dir / relative
            if left.read_bytes() == right.read_bytes():
                continue
            diff_text = ""
            if left.stat().st_size <= 100_000 and right.stat().st_size <= 100_000:
                left_text = left.read_text(encoding="utf-8", errors="replace").splitlines()
                right_text = right.read_text(encoding="utf-8", errors="replace").splitlines()
                diff_lines = difflib.unified_diff(
                    left_text,
                    right_text,
                    fromfile=f"{from_version}/{relative}",
                    tofile=f"{to_version}/{relative}",
                    lineterm="",
                )
                diff_text = "\n".join(diff_lines)
            modified.append({"path": relative, "diff": diff_text})
        return {
            "from_version": from_version,
            "to_version": to_version,
            "added": added,
            "removed": removed,
            "modified": modified,
        }

    async def rollback_version(self, user: User, skill_id: str, version: str):
        repo = self._require_version_repo()
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        self._ensure_not_reference(skill)
        version = self._validate_version(version)
        record = await repo.get_by_version(skill.id, version)
        if not record:
            raise ValueError("Version not found")
        base_dir = get_skill_versions_dir(user.id, skill.name)
        base_resolved = base_dir.resolve()
        version_dir = (base_dir / version).resolve()
        if not version_dir.is_relative_to(base_resolved):
            raise ValueError("Invalid version")
        if not version_dir.exists():
            raise ValueError("Version files not found")
        clear_skill_current_dir(user.id, skill.name)
        root_dir = get_user_skill_dir(user.id, skill.name)
        for file_path in version_dir.rglob("*"):
            if not file_path.is_file():
                continue
            relative = file_path.relative_to(version_dir)
            target = root_dir / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file_path, target)
        await self.skill_repo.update(skill, current_version=version, description=record.description)
        return record

    async def upload_zip(
        self,
        user: User,
        skill_id: str,
        filename: str,
        content: bytes,
        metadata_text: str | None = None,
    ) -> dict:
        temp_path = self._write_temp_upload(content, suffix=".zip")
        try:
            return await self.upload_zip_from_path(user, skill_id, filename, temp_path, metadata_text)
        finally:
            self._cleanup_temp_path(temp_path)

    async def upload_zip_from_path(
        self,
        user: User,
        skill_id: str,
        filename: str,
        archive_path: Path,
        metadata_text: str | None = None,
    ) -> dict:
        repo = self._require_version_repo()
        archive_size = archive_path.stat().st_size if archive_path.exists() else 0
        logger.debug(f"[UPLOAD_ZIP] user_id={user.id}, skill_id={skill_id}, filename={filename}, content_size={archive_size} bytes")
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        self._ensure_not_reference(skill)
        logger.debug(f"[UPLOAD_ZIP] Found skill: name={skill.name}")
        if not filename.lower().endswith(".zip"):
            raise ValueError("Invalid zip file")
        try:
            archive = zipfile.ZipFile(archive_path)
        except zipfile.BadZipFile as exc:
            logger.error(f"[UPLOAD_ZIP] Invalid zip file: {str(exc)}")
            raise ValueError("Invalid zip file") from exc
        with archive:
            entries = [info for info in archive.infolist() if not info.is_dir()]
            logger.debug(f"[UPLOAD_ZIP] Found {len(entries)} files in zip")
            if not entries:
                raise ValueError("Zip is empty")
            if len(entries) > MAX_FILES_PER_SKILL:
                raise ValueError("Too many files in skill")
            total_size = sum(info.file_size for info in entries)
            logger.debug(f"[UPLOAD_ZIP] Total file size: {total_size} bytes")
            if total_size > MAX_TOTAL_SIZE:
                raise ValueError("Total skill size limit exceeded")
            for info in entries:
                if info.file_size > MAX_FILE_SIZE:
                    raise ValueError("File too large")
                file_path = info.filename.replace("\\", "/").lstrip("/")
                valid, error = validate_file_path(file_path)
                if not valid:
                    raise ValueError(error)
            skill_md = next(
                (info for info in entries if info.filename.replace("\\", "/").lstrip("/") == "SKILL.md"),
                None,
            )
            if not skill_md:
                logger.error(f"[UPLOAD_ZIP] SKILL.md not found in zip")
                raise ValueError("SKILL.md not found")
            logger.debug(f"[UPLOAD_ZIP] Found SKILL.md")
            skill_md_content = archive.read(skill_md).decode("utf-8", errors="replace")
            frontmatter = self._parse_frontmatter(skill_md_content)
            metadata: dict = {}
            if metadata_text:
                try:
                    parsed = json.loads(metadata_text)
                except json.JSONDecodeError as exc:
                    raise ValueError("Invalid metadata") from exc
                if isinstance(parsed, dict):
                    metadata = parsed
            version = str(metadata.get("version") or frontmatter.get("version") or "").strip()
            logger.debug(f"[UPLOAD_ZIP] Parsed version: {version}")
            if not version:
                version = await self._next_version(skill, repo)
                logger.debug(f"[UPLOAD_ZIP] Auto-generated version: {version}")
            version = self._validate_version(version)
            existing = await repo.get_by_version(skill.id, version)
            if existing:
                version = await self._next_version(skill, repo)
                logger.debug(f"[UPLOAD_ZIP] Version already exists, auto-incremented: {version}")
            description = str(metadata.get("description") or frontmatter.get("description") or skill.description)
            dependencies = self._normalize_dependencies(metadata.get("dependencies") or frontmatter.get("dependencies"))
            explicit_dependency_spec = self._normalize_dependency_spec(
                metadata.get("dependency_spec") or frontmatter.get("dependency_spec")
            )
            dependency_spec: dict
            dependency_spec_version: str | None
            if explicit_dependency_spec is not None:
                dependency_spec = explicit_dependency_spec
                dependency_spec_version = str(dependency_spec.get("schema_version") or "1")
            else:
                dependency_spec = {"schema_version": 1}
                dependency_spec_version = "1"
                entry_names = {info.filename.replace("\\", "/").lstrip("/") for info in entries}
                node_spec: dict[str, object] = {}
                python_spec, deps = self._detect_python_dependency_spec(entry_names, archive, [])
                if deps:
                    dependencies = deps
                if "package.json" in entry_names:
                    try:
                        package_json = json.loads(archive.read("package.json").decode("utf-8", errors="replace"))
                    except json.JSONDecodeError:
                        package_json = {}
                    lockfile = ""
                    if "package-lock.json" in entry_names:
                        lockfile = "package-lock.json"
                    node_spec = {
                        "manager": "npm",
                        "package_json": package_json,
                        "lockfile": lockfile or None,
                    }
                if python_spec:
                    dependency_spec["python"] = python_spec
                if node_spec:
                    dependency_spec["node"] = node_spec
            base_dir = get_skill_versions_dir(user.id, skill.name)
            base_resolved = base_dir.resolve()
            version_dir = (base_dir / version).resolve()
            if not version_dir.is_relative_to(base_resolved):
                raise ValueError("Invalid version")
            if version_dir.exists():
                raise ValueError("Version already exists")
            logger.debug(f"[UPLOAD_ZIP] Creating version directory: {version_dir}")
            version_dir.mkdir(parents=True, exist_ok=True)
            logger.debug(f"[UPLOAD_ZIP] Extracting {len(entries)} files to version directory")
            for info in entries:
                file_path = info.filename.replace("\\", "/").lstrip("/")
                target = version_dir / file_path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(info))
            clear_skill_current_dir(user.id, skill.name)
            root_dir = get_user_skill_dir(user.id, skill.name)
            logger.debug(f"[UPLOAD_ZIP] Copying files to current directory: {root_dir}")
            for entry_path in version_dir.rglob("*"):
                if not entry_path.is_file():
                    continue
                relative = entry_path.relative_to(version_dir)
                target = root_dir / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(entry_path, target)
            logger.debug(f"[UPLOAD_ZIP] Creating version record, version={version}")
            record = await repo.create_version(
                skill_id=skill.id,
                version=version,
                description=description,
                dependencies=dependencies,
                dependency_spec=dependency_spec,
                dependency_spec_version=dependency_spec_version,
                metadata={
                    "name": metadata.get("name") or frontmatter.get("name") or skill.name,
                    "description": description,
                    "version": version,
                    "dependencies": dependencies,
                    "dependency_spec": dependency_spec,
                },
            )
            await self.skill_repo.update(skill, current_version=version, description=description, is_active=True)
            logger.debug(f"[UPLOAD_ZIP] Saving archive, version={version}")
            await save_archive_from_path(user.id, skill.name, version, archive_path)
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
        temp_path = self._write_temp_upload(content, suffix=".zip")
        try:
            return await self.upload_zip_create_skill_from_path(user, filename, temp_path, visibility)
        finally:
            self._cleanup_temp_path(temp_path)

    async def upload_zip_create_skill_from_path(
        self,
        user: User,
        filename: str,
        archive_path: Path,
        visibility: str = "private",
    ) -> dict:
        repo = self._require_version_repo()
        archive_size = archive_path.stat().st_size if archive_path.exists() else 0
        logger.debug(f"[UPLOAD_ZIP_CREATE] user_id={user.id}, filename={filename}, content_size={archive_size} bytes")
        if not filename.lower().endswith(".zip"):
            raise ValueError("Invalid zip file")
        try:
            archive = zipfile.ZipFile(archive_path)
        except zipfile.BadZipFile as exc:
            logger.error(f"[UPLOAD_ZIP_CREATE] Invalid zip file: {str(exc)}")
            raise ValueError("Invalid zip file") from exc
        with archive:
            entries = [info for info in archive.infolist() if not info.is_dir()]
            logger.debug(f"[UPLOAD_ZIP_CREATE] Found {len(entries)} files in zip")
            if not entries:
                raise ValueError("Zip is empty")
            if len(entries) > MAX_FILES_PER_SKILL:
                raise ValueError("Too many files in skill")
            total_size = sum(info.file_size for info in entries)
            logger.debug(f"[UPLOAD_ZIP_CREATE] Total file size: {total_size} bytes")
            if total_size > MAX_TOTAL_SIZE:
                raise ValueError("Total skill size limit exceeded")
            for info in entries:
                if info.file_size > MAX_FILE_SIZE:
                    raise ValueError("File too large")
                file_path = info.filename.replace("\\", "/").lstrip("/")
                valid, error = validate_file_path(file_path)
                if not valid:
                    raise ValueError(error)
            skill_md = next(
                (info for info in entries if info.filename.replace("\\", "/").lstrip("/") == "SKILL.md"),
                None,
            )
            if not skill_md:
                logger.error(f"[UPLOAD_ZIP_CREATE] SKILL.md not found in zip")
                raise ValueError("SKILL.md not found in zip")
            logger.debug(f"[UPLOAD_ZIP_CREATE] Found SKILL.md")
            skill_md_content = archive.read(skill_md).decode("utf-8", errors="replace")
            frontmatter = self._parse_frontmatter(skill_md_content)
            name = str(frontmatter.get("name") or "").strip()
            logger.debug(f"[UPLOAD_ZIP_CREATE] Parsed skill name: {name}")
            if not name:
                raise ValueError("Skill name not found in SKILL.md frontmatter")
            valid, error = validate_skill_name(name)
            if not valid:
                raise ValueError(error)
            if await self.skill_repo.get_by_name(user.id, name):
                raise ValueError(f"Skill '{name}' already exists")
            orphan_versions = list_archive_versions(user.id, name)
            logger.debug(f"[UPLOAD_ZIP_CREATE] Found orphan versions: {orphan_versions}")
            if orphan_versions:
                latest_orphan = max(orphan_versions, key=lambda v: tuple(map(int, v.split("."))) if all(p.isdigit() for p in v.split(".")) else (0, 0, 0))
                version = str(frontmatter.get("version") or "").strip()
                logger.debug(f"[UPLOAD_ZIP_CREATE] Frontmatter version: {version}")
                if not version:
                    version = bump_patch_version(latest_orphan)
                    logger.debug(f"[UPLOAD_ZIP_CREATE] Auto-generated version from orphan: {version}")
                else:
                    version = self._validate_version(version)
                    try:
                        new_parts = tuple(map(int, version.split(".")))
                        latest_parts = tuple(map(int, latest_orphan.split(".")))
                        if new_parts <= latest_parts:
                            version = bump_patch_version(latest_orphan)
                            logger.debug(f"[UPLOAD_ZIP_CREATE] Bumped version: {version}")
                    except ValueError:
                        version = bump_patch_version(latest_orphan)
                        logger.debug(f"[UPLOAD_ZIP_CREATE] Bumped version (invalid original): {version}")
            else:
                version = str(frontmatter.get("version") or "").strip()
                logger.debug(f"[UPLOAD_ZIP_CREATE] Frontmatter version: {version}")
                if not version:
                    version = "1.0.0"
                    logger.debug(f"[UPLOAD_ZIP_CREATE] Auto-generated version: {version}")
                version = self._validate_version(version)
            description = str(frontmatter.get("description") or "").strip()
            visibility_value = (visibility or "private").strip().lower()
            if visibility_value not in {"private", "team", "enterprise"}:
                visibility_value = "private"
            skill = await self.create_skill(user, name, description, visibility=visibility_value)
            existing = await repo.get_by_version(skill.id, version)
            if existing:
                version = await self._next_version(skill, repo)
            dependencies = self._normalize_dependencies(frontmatter.get("dependencies"))
            explicit_dependency_spec = self._normalize_dependency_spec(frontmatter.get("dependency_spec"))
            dependency_spec: dict
            dependency_spec_version: str | None
            if explicit_dependency_spec is not None:
                dependency_spec = explicit_dependency_spec
                dependency_spec_version = str(dependency_spec.get("schema_version") or "1")
            else:
                dependency_spec = {"schema_version": 1}
                dependency_spec_version = "1"
                entry_names = {info.filename.replace("\\", "/").lstrip("/") for info in entries}
                node_spec: dict[str, object] = {}
                python_spec, deps = self._detect_python_dependency_spec(entry_names, archive, [])
                if deps:
                    dependencies = deps
                if "package.json" in entry_names:
                    try:
                        package_json = json.loads(archive.read("package.json").decode("utf-8", errors="replace"))
                    except json.JSONDecodeError:
                        package_json = {}
                    lockfile = ""
                    if "package-lock.json" in entry_names:
                        lockfile = "package-lock.json"
                    node_spec = {
                        "manager": "npm",
                        "package_json": package_json,
                        "lockfile": lockfile or None,
                    }
                if python_spec:
                    dependency_spec["python"] = python_spec
                if node_spec:
                    dependency_spec["node"] = node_spec
            logger.debug(f"[UPLOAD_ZIP_CREATE] Creating skill record, name={name}")
            base_dir = get_skill_versions_dir(user.id, skill.name)
            base_resolved = base_dir.resolve()
            version_dir = (base_dir / version).resolve()
            if not version_dir.is_relative_to(base_resolved):
                raise ValueError("Invalid version")
            if version_dir.exists():
                raise ValueError("Version already exists")
            logger.debug(f"[UPLOAD_ZIP_CREATE] Creating version directory: {version_dir}")
            version_dir.mkdir(parents=True, exist_ok=True)
            logger.debug(f"[UPLOAD_ZIP_CREATE] Extracting {len(entries)} files to version directory")
            for info in entries:
                file_path = info.filename.replace("\\", "/").lstrip("/")
                target = version_dir / file_path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(info))
            clear_skill_current_dir(user.id, skill.name)
            root_dir = get_user_skill_dir(user.id, skill.name)
            logger.debug(f"[UPLOAD_ZIP_CREATE] Copying files to current directory: {root_dir}")
            for entry_path in version_dir.rglob("*"):
                if not entry_path.is_file():
                    continue
                relative = entry_path.relative_to(version_dir)
                target = root_dir / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(entry_path, target)
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
            await self.skill_repo.update(skill, current_version=version, description=description, is_active=True)
            logger.debug(f"[UPLOAD_ZIP_CREATE] Saving archive, version={version}")
            await save_archive_from_path(user.id, skill.name, version, archive_path)
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
    def _write_temp_upload(content: bytes, suffix: str) -> Path:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            return Path(temp_file.name)

    @staticmethod
    def _cleanup_temp_path(path: Path) -> None:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logger.warning(f"[UPLOAD CLEANUP] Failed to remove temp file: {path}")
