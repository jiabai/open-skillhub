import asyncio
from pathlib import Path

from backend.config.settings import settings
from backend.core.utils.skill_storage import SYSTEM_STORAGE_OWNER, SYSTEM_USER_ID
from backend.db.session import async_session_maker
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.repositories.user import UserRepository
from backend.services.skill import SkillService


async def sync_public_skills() -> None:
    system_dir = Path(settings.SKILL_STORAGE_PATH) / SYSTEM_STORAGE_OWNER
    async with async_session_maker() as session:
        user_repo = UserRepository(session)
        skill_repo = SkillRepository(session)
        version_repo = SkillVersionRepository(session)
        system_user = await user_repo.get_by_id(SYSTEM_USER_ID)
        if not system_user:
            raise RuntimeError("System user missing. Run database migrations first.")
        if not system_dir.exists():
            return

        seen_names: set[str] = set()
        for skill_dir in sorted(system_dir.iterdir()):
            if not skill_dir.is_dir() or skill_dir.name.startswith("_"):
                continue
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue
            seen_names.add(skill_dir.name)
            content = skill_md.read_text(encoding="utf-8", errors="replace")
            frontmatter = SkillService._parse_frontmatter(content)
            description = str(frontmatter.get("description") or "").strip()
            existing = await skill_repo.get_by_name(SYSTEM_USER_ID, skill_dir.name)
            if not existing:
                existing = await skill_repo.create(
                    user_id=SYSTEM_USER_ID,
                    name=skill_dir.name,
                    description=description,
                    tags=[],
                    visibility="public",
                    skill_dir=str(skill_dir),
                    current_version=None,
                    is_active=True,
                )
            else:
                existing = await skill_repo.update(
                    existing,
                    description=description,
                    visibility="public",
                    skill_dir=str(skill_dir),
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
            current_version = max(available_versions, key=lambda item: SkillService._parse_semver(item) or ("", 0, 0, 0))
            await skill_repo.update(existing, current_version=current_version, is_active=True)

        existing_public = await skill_repo.list_by_user(SYSTEM_USER_ID, limit=1000, include_inactive=True)
        for skill in existing_public:
            if skill.name not in seen_names:
                await skill_repo.update(skill, is_active=False)


if __name__ == "__main__":
    asyncio.run(sync_public_skills())
