import io
import zipfile

import pytest
from sso_helpers import create_api_token, sso_login

from backend.config.settings import settings

from backend.core.security.user_state import UserStatus
from backend.core.utils.skill_storage import SYSTEM_USER_ID, create_skill_dir, get_skill_versions_dir
from backend.models.skill import Skill
from backend.models.skill_version import SkillVersion
from backend.models.user import User


async def _create_client_token(client, *, email: str, username: str, role: str = "admin"):
    access = await sso_login(
        client,
        email=email,
        username=username,
        enterprise_id="test-ent",
        team_id="test-team",
        role=role,
    )
    api_token = await create_api_token(client, access, name=f"{username}-client")
    return access, api_token


async def _upload_skill_version(client, headers, skill_id: str, name: str, version: str, body: str = "body"):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", f"---\nname: {name}\nversion: {version}\n---\n{body}")
    buffer.seek(0)
    response = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", buffer.read(), "application/zip")},
        headers=headers,
    )
    assert response.status_code == 201


async def _create_public_skill(async_session, name: str = "public-catalog-skill") -> Skill:
    system_user = await async_session.get(User, SYSTEM_USER_ID)
    if system_user is None:
        system_user = User(
            id=SYSTEM_USER_ID,
            email="system@local.invalid",
            username="__system__",
            hashed_password="!",
            is_active=False,
            is_superuser=True,
            role="admin",
            status=UserStatus.INACTIVE,
        )
        async_session.add(system_user)
        await async_session.flush()

    public_skill = Skill(
        user_id=SYSTEM_USER_ID,
        name=name,
        description="Public download skill",
        tags=["public"],
        visibility="public",
        skill_dir=str(create_skill_dir(SYSTEM_USER_ID, name)),
        current_version="1.2.4",
        is_active=True,
    )
    async_session.add(public_skill)
    await async_session.flush()

    version_123_dir = get_skill_versions_dir(SYSTEM_USER_ID, name) / "1.2.3"
    version_123_dir.mkdir(parents=True, exist_ok=True)
    (version_123_dir / "SKILL.md").write_text(
        f"---\nname: {name}\nversion: 1.2.3\n---\npublic body v123",
        encoding="utf-8",
    )
    (version_123_dir / "reference.md").write_text("public reference v123", encoding="utf-8")

    version_124_dir = get_skill_versions_dir(SYSTEM_USER_ID, name) / "1.2.4"
    version_124_dir.mkdir(parents=True, exist_ok=True)
    (version_124_dir / "SKILL.md").write_text(
        f"---\nname: {name}\nversion: 1.2.4\n---\npublic body v124",
        encoding="utf-8",
    )
    (version_124_dir / "reference.md").write_text("public reference v124", encoding="utf-8")

    async_session.add_all(
        [
            SkillVersion(
                skill_id=public_skill.id,
                version="1.2.3",
                description="Public download skill",
                dependencies=[],
                metadata_json={"name": name, "version": "1.2.3"},
            ),
            SkillVersion(
                skill_id=public_skill.id,
                version="1.2.4",
                description="Public download skill",
                dependencies=[],
                metadata_json={"name": name, "version": "1.2.4"},
            ),
        ]
    )
    await async_session.commit()
    await async_session.refresh(public_skill)
    return public_skill


@pytest.mark.asyncio
async def test_client_skill_summary_returns_latest_version_metadata(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    access_token, api_token = await _create_client_token(
        client,
        email="catalog@example.com",
        username="cataloguser",
    )
    headers = {"Authorization": f"Bearer {access_token}"}
    api_headers = {"Authorization": f"Bearer {api_token}"}

    created = await client.post(
        "/api/v1/skills",
        json={"name": "catalog-skill", "description": "Initial description"},
        headers=headers,
    )
    assert created.status_code == 201
    skill_id = created.json()["id"]

    await _upload_skill_version(client, headers, skill_id, "catalog-skill", "1.0.0", body="first")
    await _upload_skill_version(client, headers, skill_id, "catalog-skill", "1.1.0", body="second")

    response = await client.get("/api/v1/client/skills", headers=api_headers)
    assert response.status_code == 200

    payload = response.json()
    assert payload["total"] == 1
    assert len(payload["items"]) == 1

    item = payload["items"][0]
    assert item["id"] == skill_id
    assert item["resolved_version"] == "1.1.0"
    assert item["is_downloadable"] is True
    assert item["latest_version"]["version"] == "1.1.0"
    assert item["latest_version"]["metadata_json"]["version"] == "1.1.0"
    assert item["latest_version"]["metadata_json"]["name"] == "catalog-skill"


@pytest.mark.asyncio
async def test_client_skill_summary_requires_api_token(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    access_token, api_token = await _create_client_token(
        client,
        email="auth-check@example.com",
        username="authcheck",
    )

    no_auth = await client.get("/api/v1/client/skills")
    assert no_auth.status_code == 401

    jwt_auth = await client.get(
        "/api/v1/client/skills",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert jwt_auth.status_code == 401

    api_auth = await client.get(
        "/api/v1/client/skills",
        headers={"Authorization": f"Bearer {api_token}"},
    )
    assert api_auth.status_code == 200


@pytest.mark.asyncio
async def test_client_skill_summary_returns_latest_version_metadata_for_reference_skill(
    client,
    async_session,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)

    public_skill = await _create_public_skill(async_session, name="catalog-public-skill")
    access_token, api_token = await _create_client_token(
        client,
        email="reference-summary@example.com",
        username="referencesummary",
        role="member",
    )
    headers = {"Authorization": f"Bearer {access_token}"}

    created = await client.post(
        f"/api/v1/skills/{public_skill.id}/reference",
        json={"name": "catalog-public-reference", "pinned_version": "1.2.3"},
        headers=headers,
    )
    assert created.status_code == 201
    reference_skill_id = created.json()["id"]

    response = await client.get(
        "/api/v1/client/skills",
        headers={"Authorization": f"Bearer {api_token}"},
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["total"] == 2
    item = next(entry for entry in payload["items"] if entry["id"] == reference_skill_id)
    assert item["id"] == reference_skill_id
    assert item["skill_kind"] == "reference"
    assert item["resolved_version"] == "1.2.3"
    assert item["is_downloadable"] is True
    assert item["latest_version"]["version"] == "1.2.3"
    assert item["latest_version"]["metadata_json"]["name"] == "catalog-public-skill"
    assert item["latest_version"]["metadata_json"]["version"] == "1.2.3"


@pytest.mark.asyncio
async def test_client_skill_summary_allows_member_api_token_and_marks_owned_skill_non_downloadable(
    client,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))

    access_token, api_token = await _create_client_token(
        client,
        email="member-summary@example.com",
        username="membersummary",
        role="member",
    )
    headers = {"Authorization": f"Bearer {access_token}"}

    created = await client.post(
        "/api/v1/skills",
        json={"name": "member-owned-skill", "description": "Owned by member"},
        headers=headers,
    )
    assert created.status_code == 201
    skill_id = created.json()["id"]

    await _upload_skill_version(client, headers, skill_id, "member-owned-skill", "1.0.0")

    response = await client.get(
        "/api/v1/client/skills",
        headers={"Authorization": f"Bearer {api_token}"},
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["total"] == 1
    item = payload["items"][0]
    assert item["id"] == skill_id
    assert item["resolved_version"] == "1.0.0"
    assert item["is_downloadable"] is False
