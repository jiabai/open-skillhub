import argparse
import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from backend.config.settings import settings
from backend.core.utils.skill_storage import (
    SYSTEM_STORAGE_OWNER,
    SYSTEM_USER_ID,
    validate_skill_name,
)
from backend.db.session import async_session_maker
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.repositories.user import UserRepository
from backend.services.skill_support import parse_frontmatter, parse_semver


@dataclass(frozen=True)
class SyncPublicSkillsResult:
    mode: str
    system_dir: Path
    synced_skill_names: tuple[str, ...]
    deactivated_skill_names: tuple[str, ...]


def _record_skill_dir(skill_name: str) -> str:
    base_dir = str(settings.SKILL_STORAGE_PATH).rstrip("/\\")
    if "/" in base_dir and "\\" not in base_dir:
        return "/".join([base_dir, SYSTEM_STORAGE_OWNER, skill_name])
    return str(Path(base_dir) / SYSTEM_STORAGE_OWNER / skill_name)


def _resolve_system_dir(storage_root: str | Path | None) -> Path:
    base_dir = Path(storage_root) if storage_root is not None else Path(settings.SKILL_STORAGE_PATH)
    return base_dir / SYSTEM_STORAGE_OWNER


def _validate_target_skill_name(skill_name: str) -> str:
    normalized = str(skill_name or "").strip()
    valid, error = validate_skill_name(normalized)
    if not valid:
        raise ValueError(error)
    if normalized.startswith("_"):
        raise ValueError("Skill name cannot start with '_'")
    return normalized


def _iter_syncable_skill_dirs(system_dir: Path) -> list[Path]:
    if not system_dir.exists():
        return []
    skill_dirs: list[Path] = []
    for skill_dir in sorted(system_dir.iterdir()):
        if not skill_dir.is_dir() or skill_dir.name.startswith("_"):
            continue
        if not (skill_dir / "SKILL.md").exists():
            continue
        skill_dirs.append(skill_dir)
    return skill_dirs


def _resolve_target_skill_dir(system_dir: Path, skill_name: str) -> Path:
    normalized_name = _validate_target_skill_name(skill_name)
    target_dir = system_dir / normalized_name
    if not target_dir.exists() or not target_dir.is_dir():
        raise FileNotFoundError(f"Public skill '{normalized_name}' not found in {system_dir}")
    if not (target_dir / "SKILL.md").exists():
        raise FileNotFoundError(f"SKILL.md not found for public skill '{normalized_name}'")
    return target_dir


async def _sync_skill_dir(
    skill_repo: SkillRepository,
    version_repo: SkillVersionRepository,
    skill_dir: Path,
) -> str:
    skill_md = skill_dir / "SKILL.md"
    content = skill_md.read_text(encoding="utf-8", errors="replace")
    frontmatter = parse_frontmatter(content)
    description = str(frontmatter.get("description") or "").strip()
    stored_skill_dir = _record_skill_dir(skill_dir.name)
    existing = await skill_repo.get_by_name(SYSTEM_USER_ID, skill_dir.name)
    if not existing:
        existing = await skill_repo.create(
            user_id=SYSTEM_USER_ID,
            name=skill_dir.name,
            description=description,
            tags=[],
            visibility="public",
            skill_dir=stored_skill_dir,
            current_version=None,
            is_active=True,
        )
    else:
        existing = await skill_repo.update(
            existing,
            description=description,
            visibility="public",
            skill_dir=stored_skill_dir,
            is_active=True,
        )

    versions_dir = skill_dir / "_versions"
    available_versions: list[str] = []
    if versions_dir.exists():
        for version_dir in sorted(versions_dir.iterdir()):
            if not version_dir.is_dir():
                continue
            available_versions.append(version_dir.name)
            if not await version_repo.get_by_version(existing.id, version_dir.name):
                await version_repo.create_version(
                    skill_id=existing.id,
                    version=version_dir.name,
                    description=description,
                    dependencies=[],
                    dependency_spec={},
                    dependency_spec_version=None,
                    metadata={"name": existing.name, "description": description, "version": version_dir.name},
                )
    else:
        available_versions.append("1.0.0")
        if not await version_repo.get_by_version(existing.id, "1.0.0"):
            await version_repo.create_version(
                skill_id=existing.id,
                version="1.0.0",
                description=description,
                dependencies=[],
                dependency_spec={},
                dependency_spec_version=None,
                metadata={"name": existing.name, "description": description, "version": "1.0.0"},
            )
    current_version = max(available_versions, key=lambda item: parse_semver(item) or ("", 0, 0, 0))
    await skill_repo.update(existing, current_version=current_version, is_active=True, skill_dir=stored_skill_dir)
    return skill_dir.name


async def sync_public_skills(
    skill_name: str | None = None,
    *,
    storage_root: str | Path | None = None,
) -> SyncPublicSkillsResult:
    system_dir = _resolve_system_dir(storage_root)
    async with async_session_maker() as session:
        user_repo = UserRepository(session)
        skill_repo = SkillRepository(session)
        version_repo = SkillVersionRepository(session)
        system_user = await user_repo.get_by_id(SYSTEM_USER_ID)
        if not system_user:
            raise RuntimeError("System user missing. Run database migrations first.")

        if skill_name is not None:
            target_dir = _resolve_target_skill_dir(system_dir, skill_name)
            synced_name = await _sync_skill_dir(skill_repo, version_repo, target_dir)
            return SyncPublicSkillsResult(
                mode="targeted",
                system_dir=system_dir,
                synced_skill_names=(synced_name,),
                deactivated_skill_names=(),
            )

        seen_names: set[str] = set()
        synced_names: list[str] = []
        for skill_dir in _iter_syncable_skill_dirs(system_dir):
            synced_name = await _sync_skill_dir(skill_repo, version_repo, skill_dir)
            seen_names.add(synced_name)
            synced_names.append(synced_name)

        deactivated_names: list[str] = []
        existing_public = await skill_repo.list_by_user(SYSTEM_USER_ID, limit=1000, include_inactive=True)
        for skill in existing_public:
            if skill.name in seen_names:
                continue
            await skill_repo.update(skill, is_active=False)
            deactivated_names.append(skill.name)

        return SyncPublicSkillsResult(
            mode="full",
            system_dir=system_dir,
            synced_skill_names=tuple(synced_names),
            deactivated_skill_names=tuple(deactivated_names),
        )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Sync public skills from the system storage directory.",
    )
    parser.add_argument(
        "skill_name",
        nargs="?",
        help="Optional skill name for targeted import.",
    )
    parser.add_argument(
        "--storage-root",
        help="Override the skill storage root directory. The command will still read from the __system__ subdirectory.",
    )
    args = parser.parse_args(argv)

    try:
        result = asyncio.run(
            sync_public_skills(
                skill_name=args.skill_name,
                storage_root=args.storage_root,
            )
        )
    except (FileNotFoundError, RuntimeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if result.mode == "targeted":
        print(f"Synced public skill: {result.synced_skill_names[0]}")
        return 0

    if result.synced_skill_names:
        print(f"Synced {len(result.synced_skill_names)} public skill(s) from {result.system_dir}")
    else:
        print(f"No public skills found under {result.system_dir}")
    if result.deactivated_skill_names:
        print(f"Deactivated {len(result.deactivated_skill_names)} missing public skill(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
