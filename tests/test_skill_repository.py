import pytest

from backend.models.skill_version import SkillVersion
from backend.repositories.skill import SkillRepository
from backend.repositories.user import UserRepository


async def _create_user(async_session, email: str, username: str):
    user_repo = UserRepository(async_session)
    return await user_repo.create(email=email, username=username, password="pass1234")


async def _create_skill(
    async_session,
    user_id: str,
    name: str,
    *,
    cloned_from_skill_id: str | None = None,
):
    skill_repo = SkillRepository(async_session)
    return await skill_repo.create(
        user_id=user_id,
        name=name,
        description="desc",
        tags=[],
        visibility="private",
        skill_dir="",
        current_version="1.0.0",
        is_active=True,
        cloned_from_skill_id=cloned_from_skill_id,
    )


@pytest.mark.asyncio
async def test_list_cloned_source_ids_prefers_direct_field(async_session):
    repo = SkillRepository(async_session)
    user = await _create_user(async_session, "repo-direct@example.com", "repo-direct")
    await _create_skill(
        async_session,
        user.id,
        "direct-clone",
        cloned_from_skill_id="direct-source-id",
    )
    legacy_skill = await _create_skill(async_session, user.id, "legacy-clone")
    async_session.add(
        SkillVersion(
            skill_id=legacy_skill.id,
            version="1.0.0",
            description="legacy",
            dependencies=[],
            metadata_json={"cloned_from_skill_id": "legacy-source-id"},
        )
    )
    await async_session.commit()

    clone_ids = await repo.list_cloned_source_ids(user.id)

    assert clone_ids == {"direct-source-id"}


@pytest.mark.asyncio
async def test_list_cloned_source_ids_uses_legacy_fallback_when_needed(async_session):
    repo = SkillRepository(async_session)
    user = await _create_user(async_session, "repo-legacy@example.com", "repo-legacy")
    legacy_skill = await _create_skill(async_session, user.id, "legacy-only-clone")
    async_session.add_all(
        [
            SkillVersion(
                skill_id=legacy_skill.id,
                version="1.0.0",
                description="legacy",
                dependencies=[],
                metadata_json={"cloned_from_skill_id": "legacy-source-id"},
            ),
            SkillVersion(
                skill_id=legacy_skill.id,
                version="1.0.1",
                description="legacy",
                dependencies=[],
                metadata_json={"cloned_from_skill_id": "   "},
            ),
        ]
    )
    await async_session.commit()

    clone_ids = await repo.list_cloned_source_ids(user.id)

    assert clone_ids == {"legacy-source-id"}
