"""同步系统目录中的公开技能到数据库。

此脚本用于将 __system__ 目录下的公开技能同步到数据库，包括：
- 创建或更新技能记录
- 同步技能版本信息
- 自动停用已删除的技能

用法：
  python backend/scripts/sync_public_skills.py              # 同步所有公开技能
  python backend/scripts/sync_public_skills.py skill_name   # 同步指定技能
  python backend/scripts/sync_public_skills.py --storage-root /path/to/root  # 指定存储根目录
  python backend/scripts/sync_public_skills.py --docker skill_name  # 通过 Docker 容器执行
"""
import argparse
import asyncio
import hashlib
import logging
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from backend.config.settings import settings
from backend.core.utils.skill_hash import compute_skill_content_hash
from backend.core.utils.skill_storage import (
    SYSTEM_STORAGE_OWNER,
    SYSTEM_USER_ID,
    validate_skill_name,
)
from backend.db.session import async_session_maker
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.repositories.user import UserRepository
from backend.services.skill_support import next_version, parse_frontmatter, parse_semver

logger = logging.getLogger(__name__)


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


def _version_sort_key(version: str) -> tuple[int, int, int, int]:
    parsed = parse_semver(version)
    if parsed is None:
        return (0, 0, 0, 0)
    _, major, minor, patch = parsed
    return (1, major, minor, patch)


def _collect_file_hashes(base_dir: Path, *, exclude_dirs: set[str] | None = None) -> tuple[dict[str, str], bool]:
    excluded = exclude_dirs or set()
    hashes: dict[str, str] = {}
    had_error = False
    for item in sorted(base_dir.rglob("*")):
        if not item.is_file():
            continue
        relative_path = item.relative_to(base_dir)
        if any(part in excluded for part in relative_path.parts):
            continue
        normalized_path = relative_path.as_posix()
        try:
            hashes[normalized_path] = hashlib.sha256(item.read_bytes()).hexdigest()
        except OSError as exc:
            logger.warning("Unable to hash %s: %s", item, exc)
            had_error = True
    return hashes, had_error


def _has_snapshot_changes(skill_dir: Path, version_dir: Path | None) -> bool:
    if version_dir is None or not version_dir.exists():
        return True

    root_files, root_error = _collect_file_hashes(skill_dir, exclude_dirs={"_versions"})
    version_files, version_error = _collect_file_hashes(version_dir)
    if root_error or version_error:
        return True
    return root_files != version_files


def _copy_skill_snapshot(skill_dir: Path, version_dir: Path) -> None:
    version_dir.mkdir(parents=True, exist_ok=True)
    for item in skill_dir.iterdir():
        if item.name == "_versions":
            continue
        target = version_dir / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)


async def _ensure_version_record(
    version_repo: SkillVersionRepository,
    *,
    skill_id: str,
    skill_name: str,
    version: str,
    description: str,
    version_dir: Path | None = None,
) -> None:
    content_hash = compute_skill_content_hash(version_dir) if version_dir is not None and version_dir.exists() else ""
    existing = await version_repo.get_by_version(skill_id, version)
    if existing:
        if content_hash and not existing.content_hash:
            existing.content_hash = content_hash
            await version_repo.session.commit()
        return
    await version_repo.create_version(
        skill_id=skill_id,
        version=version,
        description=description,
        dependencies=[],
        dependency_spec={},
        dependency_spec_version=None,
        content_hash=content_hash,
        metadata={"name": skill_name, "description": description, "version": version},
    )


async def _create_snapshot_version(
    version_repo: SkillVersionRepository,
    *,
    skill_dir: Path,
    skill_id: str,
    skill_name: str,
    version: str,
    description: str,
) -> None:
    version_dir = skill_dir / "_versions" / version
    _copy_skill_snapshot(skill_dir, version_dir)
    await _ensure_version_record(
        version_repo,
        skill_id=skill_id,
        skill_name=skill_name,
        version=version,
        description=description,
        version_dir=version_dir,
    )


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
            await _ensure_version_record(
                version_repo,
                skill_id=existing.id,
                skill_name=existing.name,
                version=version_dir.name,
                description=description,
                version_dir=version_dir,
            )
        if available_versions:
            latest_version = max(available_versions, key=_version_sort_key)
            latest_version_dir = versions_dir / latest_version
            if _has_snapshot_changes(skill_dir, latest_version_dir):
                new_version = await next_version(existing, version_repo, strategy="patch")
                await _create_snapshot_version(
                    version_repo,
                    skill_dir=skill_dir,
                    skill_id=existing.id,
                    skill_name=existing.name,
                    version=new_version,
                    description=description,
                )
                available_versions.append(new_version)
        else:
            db_versions = await version_repo.list_by_skill(existing.id)
            new_version = await next_version(existing, version_repo, strategy="patch") if db_versions else "1.0.0"
            await _create_snapshot_version(
                version_repo,
                skill_dir=skill_dir,
                skill_id=existing.id,
                skill_name=existing.name,
                version=new_version,
                description=description,
            )
            available_versions.append(new_version)
    else:
        db_versions = await version_repo.list_by_skill(existing.id)
        new_version = await next_version(existing, version_repo, strategy="patch") if db_versions else "1.0.0"
        await _create_snapshot_version(
            version_repo,
            skill_dir=skill_dir,
            skill_id=existing.id,
            skill_name=existing.name,
            version=new_version,
            description=description,
        )
        available_versions.append(new_version)
    current_version = max(available_versions, key=_version_sort_key)
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

def _is_inside_docker() -> bool:
    return Path("/.dockerenv").exists()


def _exec_via_docker(
    skill_name: str | None,
    *,
    docker_service: str,
    storage_root: str | None,
) -> int:
    cmd = [
        "docker", "compose", "exec", docker_service,
        "python", "backend/scripts/sync_public_skills.py",
    ]
    if skill_name is not None:
        cmd.append(skill_name)
    if storage_root is not None:
        cmd.extend(["--storage-root", storage_root])
    try:
        result = subprocess.run(cmd, check=False)
        return result.returncode
    except FileNotFoundError:
        print("Error: 'docker' command not found. Is Docker installed and in PATH?", file=sys.stderr)
        return 1


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
    parser.add_argument(
        "--docker",
        action="store_true",
        help="Execute inside the Docker container via 'docker compose exec'. "
        "Useful when the backend runs in Docker with named volumes inaccessible from the host.",
    )
    parser.add_argument(
        "--docker-service",
        default="api",
        help="Docker Compose service name to exec into (default: api).",
    )
    args = parser.parse_args(argv)

    if args.docker and not _is_inside_docker():
        return _exec_via_docker(
            args.skill_name,
            docker_service=args.docker_service,
            storage_root=args.storage_root,
        )

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
        print(f"Deactivated {len(result.deactivated_skill_names)} missing public skill(s): {', '.join(result.deactivated_skill_names)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
