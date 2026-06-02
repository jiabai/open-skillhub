import difflib
from pathlib import Path

from loguru import logger

from backend.core.middleware.logging import safe_log_context
from backend.core.utils.skill_archive import load_archive
from backend.core.utils.skill_storage import (
    clear_skill_current_dir,
    get_skill_versions_dir,
    get_user_skill_dir,
    validate_skill_name,
)
from backend.models.skill import Skill
from backend.models.skill_version import SkillVersion
from backend.models.user import User
from backend.repositories.skill_version import SkillVersionRepository
from backend.services.skill_clone import CloneCreationResult, SkillCloneService
from backend.services.skill_download import SkillDownloadService
from backend.services.skill_errors import SkillError, SkillErrorCode
from backend.services.skill_lifecycle import SkillLifecycleCoordinator
from backend.services.skill_support import (
    build_node_commands,
    build_python_commands,
    build_uv_pip_install_command,
    clean_dependency_items,
    validate_version,
)


class SkillVersionCoordinator:
    def __init__(
        self,
        lifecycle: SkillLifecycleCoordinator,
        version_repo: SkillVersionRepository | None = None,
        clone_service: SkillCloneService | None = None,
        download_service: SkillDownloadService | None = None,
    ):
        self.lifecycle = lifecycle
        self.version_repo = version_repo
        self.clone_service = clone_service
        self.download_service = download_service

    def require_version_repo(self) -> SkillVersionRepository:
        if not self.version_repo:
            raise SkillError(SkillErrorCode.VERSION_REPOSITORY_NOT_CONFIGURED)
        return self.version_repo

    async def resolve_version_and_record(
        self,
        skill: Skill,
        requested_version: str | None = None,
    ) -> tuple[Skill, str, SkillVersion]:
        repo = self.require_version_repo()
        source_skill = await self.lifecycle.resolve_source_skill(skill)
        if self.lifecycle.is_reference_skill(skill):
            version = str(
                skill.pinned_version
                or requested_version
                or source_skill.current_version
                or ""
            ).strip()
        else:
            version = str(
                requested_version or source_skill.current_version or ""
            ).strip()
        if not version:
            versions = await repo.list_by_skill(source_skill.id)
            if versions:
                version = versions[0].version
        if not version:
            raise SkillError(SkillErrorCode.VERSION_NOT_FOUND)
        version = validate_version(version)
        record = await repo.get_by_version(source_skill.id, version)
        if not record:
            raise SkillError(SkillErrorCode.VERSION_NOT_FOUND)
        return source_skill, version, record

    async def resolve_version_dir(
        self,
        skill: Skill,
        requested_version: str | None = None,
    ) -> tuple[Skill, str, object, Path]:
        source_skill, version, record = await self.resolve_version_and_record(
            skill, requested_version
        )
        version_dir = (
            get_skill_versions_dir(source_skill.user_id, source_skill.name) / version
        )
        if not version_dir.exists():
            fallback_dir = self._resolve_current_skill_dir_fallback(
                source_skill, version
            )
            if fallback_dir is None:
                raise SkillError(SkillErrorCode.VERSION_FILES_NOT_FOUND)
            return source_skill, version, record, fallback_dir
        return source_skill, version, record, version_dir

    @staticmethod
    def _resolve_current_skill_dir_fallback(
        source_skill: Skill, version: str
    ) -> Path | None:
        current_version = str(source_skill.current_version or "").strip()
        skill_dir = str(source_skill.skill_dir or "").strip()
        if not current_version or current_version != version or not skill_dir:
            return None
        current_dir = Path(skill_dir)
        if not current_dir.exists() or not current_dir.is_dir():
            return None
        return current_dir

    async def create_reference_skill(
        self,
        user: User,
        public_skill_id: str,
        name: str,
        pinned_version: str | None = None,
    ) -> Skill:
        self.lifecycle.assert_public_features_enabled()
        source_skill = await self.lifecycle.get_public_source_skill(public_skill_id)
        valid, error = validate_skill_name(name)
        if not valid:
            raise SkillError(SkillErrorCode.INVALID_SKILL_NAME, error)
        existing_reference = await self.lifecycle.skill_repo.get_reference_by_source(
            user.id, source_skill.id
        )
        if existing_reference:
            raise SkillError(SkillErrorCode.REFERENCE_ALREADY_EXISTS)
        if await self.lifecycle.skill_repo.get_by_name(user.id, name):
            raise SkillError(SkillErrorCode.SKILL_ALREADY_EXISTS)
        pinned_value = None
        if pinned_version:
            _, pinned_value, _ = await self.resolve_version_and_record(
                source_skill, pinned_version
            )
        return await self.lifecycle.skill_repo.create(
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
    ) -> CloneCreationResult:
        self.lifecycle.assert_public_features_enabled()
        if not self.clone_service:
            raise SkillError(SkillErrorCode.VERSION_REPOSITORY_NOT_CONFIGURED)
        source_skill = await self.lifecycle.get_public_source_skill(public_skill_id)
        (
            _,
            _resolved_version,
            source_record,
            source_version_dir,
        ) = await self.resolve_version_dir(source_skill)
        return await self.clone_service.create_clone(
            user=user,
            source_skill=source_skill,
            source_record=source_record,
            source_version_dir=source_version_dir,
            create_skill=self.lifecycle.create_skill,
            visibility=visibility,
            name=name,
        )

    async def pin_reference_version(
        self, user: User, skill_id: str, version: str
    ) -> Skill:
        skill = await self.lifecycle.get_skill(user, skill_id)
        self.lifecycle.ensure_owner(user, skill)
        if not self.lifecycle.is_reference_skill(skill):
            raise SkillError(SkillErrorCode.SKILL_NOT_FOUND)
        normalized = validate_version(version)
        source_skill = await self.lifecycle.resolve_source_skill(skill)
        repo = self.require_version_repo()
        record = await repo.get_by_version(source_skill.id, normalized)
        if not record:
            raise SkillError(SkillErrorCode.VERSION_NOT_FOUND)
        return await self.lifecycle.skill_repo.update(skill, pinned_version=normalized)

    async def unpin_reference_version(self, user: User, skill_id: str) -> Skill:
        skill = await self.lifecycle.get_skill(user, skill_id)
        self.lifecycle.ensure_owner(user, skill)
        if not self.lifecycle.is_reference_skill(skill):
            raise SkillError(SkillErrorCode.SKILL_NOT_FOUND)
        return await self.lifecycle.skill_repo.update(skill, pinned_version=None)

    async def resolved_version_for_skill(self, skill: Skill) -> str | None:
        try:
            _, version, _ = await self.resolve_version_and_record(skill)
            return version
        except SkillError:
            return None

    async def list_versions(self, user: User, skill_id: str):
        repo = self.require_version_repo()
        skill = await self.lifecycle.get_skill(user, skill_id)
        source_skill = await self.lifecycle.resolve_source_skill(skill)
        return await repo.list_by_skill(source_skill.id)

    async def get_version(self, user: User, skill_id: str, version: str):
        repo = self.require_version_repo()
        skill = await self.lifecycle.get_skill(user, skill_id)
        version = validate_version(version)
        source_skill = await self.lifecycle.resolve_source_skill(skill)
        record = await repo.get_by_version(source_skill.id, version)
        if not record:
            raise SkillError(SkillErrorCode.VERSION_NOT_FOUND)
        return record

    async def download_skill(
        self, user: User, skill_id: str, version: str | None = None
    ) -> dict:
        if not self.download_service:
            logger.bind(
                **safe_log_context(user_id=str(user.id), skill_uuid=skill_id)
            ).debug("Skill download requested without download service")
            raise SkillError(SkillErrorCode.VERSION_REPOSITORY_NOT_CONFIGURED)
        skill = await self.lifecycle.get_skill(user, skill_id)
        self.lifecycle.ensure_active(skill)
        if self.lifecycle.is_public_skill(skill):
            logger.bind(
                **safe_log_context(user_id=str(user.id), skill_uuid=skill_id)
            ).debug("Public source skill download rejected")
            raise SkillError(
                SkillErrorCode.PUBLIC_SKILL_DOWNLOAD_REQUIRES_REFERENCE_OR_CLONE
            )
        source_skill, target_version, _record = await self.resolve_version_and_record(
            skill, version
        )
        version_dir = (
            get_skill_versions_dir(source_skill.user_id, source_skill.name)
            / target_version
        )
        archive_bytes = await load_archive(
            source_skill.user_id, source_skill.name, target_version
        )
        logger.bind(
            **safe_log_context(
                user_id=str(user.id),
                skill_uuid=skill_id,
                source_skill_id=str(source_skill.id),
                target_version=target_version,
                requested_version=version or "(current)",
                archive_cache_hit=archive_bytes is not None,
                version_dir=str(version_dir),
            )
        ).debug("Resolved skill download source")
        return await self.download_service.build_download_payload(
            skill_id=skill.id,
            target_version=target_version,
            version_dir=version_dir,
            source_user_id=source_skill.user_id,
            source_skill_name=source_skill.name,
            archive_bytes=archive_bytes,
        )

    async def get_install_instructions(
        self, user: User, skill_id: str, version: str
    ) -> dict:
        skill = await self.lifecycle.get_skill(user, skill_id)
        self.lifecycle.ensure_active(skill)
        _, version, record = await self.resolve_version_and_record(skill, version)
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
                requirements = clean_dependency_items(python_spec.get("requirements"))
                files = clean_dependency_items(python_spec.get("files"))
                manager = str(python_spec.get("manager") or "uv")
                if requirements:
                    dependencies = requirements
                    requirements_text = "\n".join(requirements)
                commands = build_python_commands(manager, dependencies, files)
            elif isinstance(node_spec, dict):
                ecosystem = "node"
                manager = str(node_spec.get("manager") or "npm")
                lockfile = str(node_spec.get("lockfile") or "")
                commands = build_node_commands(manager, bool(lockfile))
                dependencies = []
                requirements_text = ""
        if not commands and dependencies:
            inline_install = build_uv_pip_install_command(dependencies)
            if inline_install:
                commands = [inline_install]
        return {
            "strategy": "client",
            "dependencies": dependencies,
            "requirements_text": requirements_text,
            "commands": commands,
            "ecosystem": ecosystem,
            "manifests": manifests,
            "dependency_spec": dependency_spec or None,
        }

    async def diff_versions(
        self, user: User, skill_id: str, from_version: str, to_version: str
    ) -> dict:
        skill = await self.lifecycle.get_skill(user, skill_id)
        self.lifecycle.ensure_active(skill)
        source_skill = await self.lifecycle.resolve_source_skill(skill)
        base_dir = get_skill_versions_dir(source_skill.user_id, source_skill.name)
        base_resolved = base_dir.resolve()
        from_version = validate_version(from_version)
        to_version = validate_version(to_version)
        from_dir = (base_dir / from_version).resolve()
        to_dir = (base_dir / to_version).resolve()
        if not from_dir.is_relative_to(base_resolved) or not to_dir.is_relative_to(
            base_resolved
        ):
            raise SkillError(SkillErrorCode.INVALID_VERSION)
        if not from_dir.exists() or not to_dir.exists():
            raise SkillError(SkillErrorCode.VERSION_FILES_NOT_FOUND)
        from_files = {
            str(path.relative_to(from_dir)).replace("\\", "/")
            for path in from_dir.rglob("*")
            if path.is_file()
        }
        to_files = {
            str(path.relative_to(to_dir)).replace("\\", "/")
            for path in to_dir.rglob("*")
            if path.is_file()
        }
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
                left_text = left.read_text(
                    encoding="utf-8", errors="replace"
                ).splitlines()
                right_text = right.read_text(
                    encoding="utf-8", errors="replace"
                ).splitlines()
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
        repo = self.require_version_repo()
        skill = await self.lifecycle.get_skill(user, skill_id)
        self.lifecycle.ensure_owner(user, skill)
        self.lifecycle.ensure_not_reference(skill)
        version = validate_version(version)
        record = await repo.get_by_version(skill.id, version)
        if not record:
            raise SkillError(SkillErrorCode.VERSION_NOT_FOUND)
        base_dir = get_skill_versions_dir(user.id, skill.name)
        base_resolved = base_dir.resolve()
        version_dir = (base_dir / version).resolve()
        if not version_dir.is_relative_to(base_resolved):
            raise SkillError(SkillErrorCode.INVALID_VERSION)
        if not version_dir.exists():
            raise SkillError(SkillErrorCode.VERSION_FILES_NOT_FOUND)
        clear_skill_current_dir(user.id, skill.name)
        root_dir = get_user_skill_dir(user.id, skill.name)
        for file_path in version_dir.rglob("*"):
            if not file_path.is_file():
                continue
            relative = file_path.relative_to(version_dir)
            target = root_dir / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(file_path.read_bytes())
        await self.lifecycle.skill_repo.update(
            skill, current_version=version, description=record.description
        )
        return record
