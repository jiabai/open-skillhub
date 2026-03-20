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
import zipfile

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import yaml

from skillhub.config.settings import settings
from skillhub.core.security.rbac import is_skill_visible
from skillhub.core.utils.skill_storage import (
    MAX_FILES_PER_SKILL,
    MAX_FILE_SIZE,
    MAX_TOTAL_SIZE,
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
from skillhub.core.utils.skill_archive import load_archive, save_archive
from skillhub.models.skill import Skill
from skillhub.models.user import User
from skillhub.repositories.skill import SkillRepository
from skillhub.repositories.skill_version import SkillVersionRepository


class SkillService:
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
        now = datetime.now(timezone.utc).replace(microsecond=0)
        return await self.skill_repo.update(skill, is_active=False, cache_revoked_at=now)

    async def activate_skill(self, user: User, skill_id: str) -> Skill:
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        return await self.skill_repo.update(skill, is_active=True)

    async def delete_skill(self, user: User, skill_id: str) -> bool:
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        await self.skill_repo.delete(skill)
        delete_skill_dir(user.id, skill.name)
        return True

    async def list_skill_files(self, user: User, skill_id: str) -> list[str]:
        skill = await self.get_skill(user, skill_id)
        self._ensure_active(skill)
        return list_files(user.id, skill.name)

    async def read_skill_file(self, user: User, skill_id: str, file_path: str) -> str:
        skill = await self.get_skill(user, skill_id)
        self._ensure_active(skill)
        base_dir = Path(settings.SKILL_STORAGE_PATH)
        safe_path = get_safe_skill_path(base_dir, user.id, skill.name, file_path)
        if not safe_path:
            raise ValueError("Invalid file path")
        if not safe_path.exists() or not safe_path.is_file():
            raise ValueError("File not found")
        return safe_path.read_text(encoding="utf-8", errors="replace")

    async def upload_file(self, user: User, skill_id: str, filename: str, content: bytes) -> str:
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        valid, error = validate_filename(filename)
        if not valid:
            raise ValueError(error)
        if len(content) > MAX_FILE_SIZE:
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
        if total_size + len(content) > MAX_TOTAL_SIZE:
            raise ValueError("Total skill size limit exceeded")
        base_dir = Path(settings.SKILL_STORAGE_PATH)
        safe_path = get_safe_skill_path(base_dir, user.id, skill.name, filename)
        if not safe_path:
            raise ValueError("Invalid file path")
        safe_path.parent.mkdir(parents=True, exist_ok=True)
        safe_path.write_bytes(content)
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
    def _build_encryption_key(value: str) -> bytes:
        return hashlib.sha256(value.encode("utf-8")).digest()

    @staticmethod
    def _encrypt_payload(payload: bytes) -> tuple[str, str]:
        key = SkillService._build_encryption_key(settings.SECRET_KEY)
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
    def _build_python_commands(manager: str, requirements: list[str], files: list[str]) -> list[str]:
        commands: list[str] = []
        if manager == "pip":
            if "requirements.txt" in files:
                commands.append("pip install -r requirements.txt")
            if requirements:
                commands.append("pip install " + " ".join(requirements))
        elif manager == "poetry":
            commands.append("poetry install")
        elif manager == "uv":
            commands.append("uv pip install -r requirements.txt" if "requirements.txt" in files else "uv pip install")
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

    async def list_versions(self, user: User, skill_id: str):
        repo = self._require_version_repo()
        skill = await self.get_skill(user, skill_id)
        return await repo.list_by_skill(skill.id)

    async def download_skill(self, user: User, skill_id: str, version: str | None = None) -> dict:
        repo = self._require_version_repo()
        skill = await self.get_skill(user, skill_id)
        self._ensure_active(skill)
        target_version = version or skill.current_version or ""
        if not target_version:
            latest = await repo.list_by_skill(skill.id)
            if latest:
                target_version = latest[0].version
        if not target_version:
            raise ValueError("Version not found")
        target_version = self._validate_version(target_version)
        record = await repo.get_by_version(skill.id, target_version)
        if not record:
            raise ValueError("Version not found")
        archive_bytes = await load_archive(user.id, skill.name, target_version)
        if archive_bytes is None:
            base_dir = get_skill_versions_dir(user.id, skill.name)
            version_dir = (base_dir / target_version).resolve()
            if not version_dir.exists():
                raise ValueError("Version files not found")
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
                for file_path in version_dir.rglob("*"):
                    if not file_path.is_file():
                        continue
                    relative = file_path.relative_to(version_dir)
                    archive.write(file_path, arcname=relative.as_posix())
            archive_bytes = buffer.getvalue()
            await save_archive(user.id, skill.name, target_version, archive_bytes)
        if settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION:
            encrypted_code, checksum = self._encrypt_payload(archive_bytes)
        else:
            encrypted_code = base64.b64encode(archive_bytes).decode("utf-8")
            checksum = self._checksum_payload(archive_bytes)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        return {
            "skill_uuid": skill.id,
            "version": target_version,
            "encrypted_code": encrypted_code,
            "checksum": checksum,
            "expires_at": expires_at,
            "cache_ttl_seconds": settings.SKILL_CACHE_TTL_SECONDS,
        }

    async def get_install_instructions(self, user: User, skill_id: str, version: str) -> dict:
        repo = self._require_version_repo()
        skill = await self.get_skill(user, skill_id)
        self._ensure_active(skill)
        version = self._validate_version(version)
        record = await repo.get_by_version(skill.id, version)
        if not record:
            raise ValueError("Version not found")
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
                "pip install " + " ".join(dependencies),
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
        base_dir = get_skill_versions_dir(user.id, skill.name)
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
        repo = self._require_version_repo()
        skill = await self.get_skill(user, skill_id)
        self._ensure_owner(user, skill)
        if not filename.lower().endswith(".zip"):
            raise ValueError("Invalid zip file")
        try:
            archive = zipfile.ZipFile(io.BytesIO(content))
        except zipfile.BadZipFile as exc:
            raise ValueError("Invalid zip file") from exc
        with archive:
            entries = [info for info in archive.infolist() if not info.is_dir()]
            if not entries:
                raise ValueError("Zip is empty")
            if len(entries) > MAX_FILES_PER_SKILL:
                raise ValueError("Too many files in skill")
            total_size = sum(info.file_size for info in entries)
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
                raise ValueError("SKILL.md not found")
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
            if not version:
                version = await self._next_version(skill, repo)
            version = self._validate_version(version)
            existing = await repo.get_by_version(skill.id, version)
            if existing:
                version = await self._next_version(skill, repo)
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
                python_spec: dict[str, object] = {}
                node_spec: dict[str, object] = {}
                requirements: list[str] = []
                if "requirements.txt" in entry_names:
                    requirements_text = archive.read("requirements.txt").decode("utf-8", errors="replace")
                    requirements = self._parse_requirements_text(requirements_text)
                    if requirements:
                        dependencies = requirements
                    python_spec = {
                        "manager": "pip",
                        "requirements": requirements,
                        "files": ["requirements.txt"],
                    }
                if "environment.yml" in entry_names:
                    python_spec = {
                        "manager": "conda",
                        "requirements": requirements,
                        "files": ["environment.yml"],
                    }
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
                if not python_spec and dependencies:
                    python_spec = {
                        "manager": "pip",
                        "requirements": dependencies,
                        "files": [],
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
            version_dir.mkdir(parents=True, exist_ok=True)
            for info in entries:
                file_path = info.filename.replace("\\", "/").lstrip("/")
                target = version_dir / file_path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(info))
            clear_skill_current_dir(user.id, skill.name)
            root_dir = get_user_skill_dir(user.id, skill.name)
            for entry_path in version_dir.rglob("*"):
                if not entry_path.is_file():
                    continue
                relative = entry_path.relative_to(version_dir)
                target = root_dir / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(entry_path, target)
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
            await save_archive(user.id, skill.name, version, content)
            return {
                "version": record.version,
                "current_version": version,
                "dependencies": record.dependencies,
            }
