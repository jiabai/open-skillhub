from dataclasses import dataclass
import shutil
from pathlib import Path

from loguru import logger

from backend.core.middleware.logging import safe_log_context
from backend.core.utils.skill_storage import (
    clear_skill_current_dir,
    delete_skill_dir,
    get_skill_versions_dir,
    get_user_skill_dir,
)
from backend.models.skill import Skill
from backend.models.user import User
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository


@dataclass(frozen=True)
class CloneCreationResult:
    skill: Skill
    version: str
    current_version: str
    source_version: str


class SkillCloneService:
    def __init__(
        self, skill_repo: SkillRepository, version_repo: SkillVersionRepository
    ):
        self.skill_repo = skill_repo
        self.version_repo = version_repo

    @staticmethod
    def has_clone_origin(skill: Skill) -> bool:
        clone_source_skill_id = skill.cloned_from_skill_id
        return isinstance(clone_source_skill_id, str) and bool(
            clone_source_skill_id.strip()
        )

    async def get_clone_origin_metadata(self, skill: Skill) -> dict[str, str]:
        if self.has_clone_origin(skill):
            clone_origin = {
                "cloned_from_skill_id": str(skill.cloned_from_skill_id),
            }
            cloned_from_version = skill.cloned_from_version
            if isinstance(cloned_from_version, str) and cloned_from_version.strip():
                clone_origin["cloned_from_version"] = cloned_from_version
            return clone_origin
        return {}

    async def create_clone(
        self,
        user: User,
        source_skill: Skill,
        source_record,
        source_version_dir: Path,
        create_skill,
        visibility: str,
        name: str,
    ) -> CloneCreationResult:
        skill = None
        try:
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    source_skill_id=str(source_skill.id),
                    source_version=getattr(source_record, "version", ""),
                    source_version_dir=str(source_version_dir),
                    visibility=visibility,
                    clone_name=name,
                )
            ).debug("Public skill clone creation started")
            skill = await create_skill(
                user,
                name,
                source_skill.description,
                tags=list(source_skill.tags or []),
                visibility=visibility,
                commit=False,
            )
            version = "1.0.0"
            version_dir = get_skill_versions_dir(skill.user_id, skill.name) / version
            version_dir.mkdir(parents=True, exist_ok=True)
            copied_source_files = 0
            for entry_path in source_version_dir.rglob("*"):
                if not entry_path.is_file():
                    continue
                relative = entry_path.relative_to(source_version_dir)
                target = version_dir / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(entry_path, target)
                copied_source_files += 1

            clear_skill_current_dir(skill.user_id, skill.name)
            root_dir = get_user_skill_dir(skill.user_id, skill.name)
            copied_current_files = 0
            for entry_path in version_dir.rglob("*"):
                if not entry_path.is_file():
                    continue
                relative = entry_path.relative_to(version_dir)
                target = root_dir / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(entry_path, target)
                copied_current_files += 1
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    skill_uuid=str(skill.id),
                    version_dir=str(version_dir),
                    copied_source_files=copied_source_files,
                    copied_current_files=copied_current_files,
                )
            ).debug("Public skill clone files copied")

            resolved_version = source_record.version
            metadata = dict(source_record.metadata_json or {})
            metadata["cloned_from_skill_id"] = source_skill.id
            metadata["cloned_from_version"] = resolved_version
            record = await self.version_repo.create_version(
                skill_id=skill.id,
                version=version,
                description=source_record.description,
                dependencies=list(source_record.dependencies or []),
                dependency_spec=dict(source_record.dependency_spec or {}),
                dependency_spec_version=source_record.dependency_spec_version,
                metadata=metadata,
                commit=False,
            )
            await self.skill_repo.update(
                skill,
                current_version=version,
                description=record.description,
                is_active=True,
                cloned_from_skill_id=source_skill.id,
                cloned_from_version=resolved_version,
                commit=False,
            )
            await self.skill_repo.session.commit()
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    skill_uuid=str(skill.id),
                    source_skill_id=str(source_skill.id),
                    source_version=resolved_version,
                    version=record.version,
                )
            ).debug("Public skill clone creation committed")
            return CloneCreationResult(
                skill=skill,
                version=record.version,
                current_version=version,
                source_version=resolved_version,
            )
        except Exception:
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    skill_uuid=str(skill.id) if skill is not None else "",
                    source_skill_id=str(source_skill.id),
                )
            ).exception("Public skill clone creation failed")
            try:
                await self.skill_repo.session.rollback()
                logger.debug("Public skill clone transaction rolled back")
            except Exception:
                pass
            if skill is not None:
                try:
                    delete_skill_dir(skill.user_id, skill.name)
                except Exception:
                    logger.exception(
                        "Failed to clean up partially created cloned skill directory"
                    )
            raise
