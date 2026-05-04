"""Backfill content hashes for existing skill version records."""

import argparse
import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from sqlalchemy import select

from backend.core.utils.skill_hash import compute_skill_content_hash
from backend.core.utils.skill_storage import SKILL_VERSIONS_DIRNAME, get_skill_versions_dir
from backend.db.session import async_session_maker
from backend.models.skill import Skill
from backend.models.skill_version import SkillVersion


@dataclass(frozen=True)
class BackfillContentHashResult:
    updated_count: int
    skipped_count: int


def _resolve_version_dir(skill: Skill, version: SkillVersion) -> Path | None:
    candidates: list[Path] = []
    if skill.skill_dir:
        candidates.append(Path(skill.skill_dir) / SKILL_VERSIONS_DIRNAME / version.version)
    candidates.append(get_skill_versions_dir(skill.user_id, skill.name) / version.version)

    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        if candidate.exists() and candidate.is_dir():
            return candidate
    return None


async def backfill_content_hashes() -> BackfillContentHashResult:
    updated_count = 0
    skipped_count = 0

    async with async_session_maker() as session:
        result = await session.execute(
            select(SkillVersion, Skill)
            .join(Skill, Skill.id == SkillVersion.skill_id)
            .where(SkillVersion.content_hash == "")
        )

        for version, skill in result.all():
            version_dir = _resolve_version_dir(skill, version)
            if version_dir is None:
                skipped_count += 1
                continue

            version.content_hash = compute_skill_content_hash(version_dir)
            updated_count += 1

        await session.commit()

    return BackfillContentHashResult(updated_count=updated_count, skipped_count=skipped_count)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backfill skill version content hashes.")
    parser.parse_args(argv)

    result = asyncio.run(backfill_content_hashes())
    print(f"Updated {result.updated_count} skill version hash(es); skipped {result.skipped_count}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
