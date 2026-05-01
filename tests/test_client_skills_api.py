import io
import json
import zipfile

import pytest
from sso_helpers import create_api_token, sso_login
from sqlalchemy import select

from backend.config.settings import settings

from backend.core.security.user_state import UserStatus
from backend.core.utils.skill_storage import SYSTEM_USER_ID, create_skill_dir, get_skill_versions_dir
from backend.models.audit_log import AuditLog
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


def _skill_zip_bytes(
    name: str,
    version: str = "1.0.0",
    *,
    description: str = "desc",
    body: str = "body",
    extra_files: dict[str, bytes | str] | None = None,
) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "SKILL.md",
            f"---\nname: {name}\ndescription: {description}\nversion: {version}\n---\n{body}",
        )
        for path, content in (extra_files or {}).items():
            archive.writestr(path, content)
    return buffer.getvalue()


async def _post_client_skill_upload(
    client,
    api_token: str,
    *,
    file_content: bytes,
    filename: str = "skill.zip",
    data: dict[str, str] | None = None,
):
    return await client.post(
        "/api/v1/client/skills/upload",
        data=data or {},
        files={"file": (filename, file_content, "application/zip")},
        headers={"Authorization": f"Bearer {api_token}"},
    )


async def _audit_events(async_session, action: str) -> list[AuditLog]:
    result = await async_session.execute(select(AuditLog).where(AuditLog.action == action))
    return list(result.scalars().all())


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
    assert payload["total"] == 1
    assert len(payload["items"]) == 1
    assert all(entry["id"] != public_skill.id for entry in payload["items"])
    item = next(entry for entry in payload["items"] if entry["id"] == reference_skill_id)
    assert item["id"] == reference_skill_id
    assert item["skill_kind"] == "reference"
    assert item["resolved_version"] == "1.2.3"
    assert item["is_downloadable"] is True
    assert item["latest_version"]["version"] == "1.2.3"
    assert item["latest_version"]["metadata_json"]["name"] == "catalog-public-skill"
    assert item["latest_version"]["metadata_json"]["version"] == "1.2.3"


@pytest.mark.asyncio
async def test_client_skill_summary_hides_unowned_public_skills_when_limit_is_one(
    client,
    async_session,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)

    await _create_public_skill(async_session, name="catalog-public-only")
    _, api_token = await _create_client_token(
        client,
        email="public-only@example.com",
        username="publiconly",
        role="member",
    )

    response = await client.get(
        "/api/v1/client/skills?limit=1",
        headers={"Authorization": f"Bearer {api_token}"},
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["total"] == 0
    assert payload["items"] == []


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


@pytest.mark.asyncio
async def test_client_skill_upload_creates_new_skill_and_audit_event(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    _, api_token = await _create_client_token(
        client,
        email="client-upload-create@example.com",
        username="clientuploadcreate",
        role="member",
    )

    response = await _post_client_skill_upload(
        client,
        api_token,
        file_content=_skill_zip_bytes(
            "client-created-skill",
            "1.0.0",
            description="Created through Client API",
            extra_files={"references/guide.md": "guide"},
        ),
        data={"visibility": "team"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["name"] == "client-created-skill"
    assert payload["description"] == "Created through Client API"
    assert payload["version"] == "1.0.0"
    assert payload["current_version"] == "1.0.0"
    assert payload["dependencies"] == []

    listed = await client.get(
        "/api/v1/client/skills",
        headers={"Authorization": f"Bearer {api_token}"},
    )
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert [item["name"] for item in items] == ["client-created-skill"]
    assert items[0]["visible"] == "team"

    create_events = await _audit_events(async_session, "skill.create")
    upload_event = next(item for item in create_events if item.target == payload["id"])
    assert upload_event.details["filename"] == "skill.zip"
    assert upload_event.details["name"] == "client-created-skill"
    assert upload_event.details["version"] == "1.0.0"
    assert upload_event.details["client_api"] is True


@pytest.mark.asyncio
async def test_client_skill_upload_appends_version_with_metadata_and_audit_event(
    client,
    async_session,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    access_token, api_token = await _create_client_token(
        client,
        email="client-upload-version@example.com",
        username="clientuploadversion",
        role="member",
    )
    headers = {"Authorization": f"Bearer {access_token}"}
    created = await client.post(
        "/api/v1/skills",
        json={"name": "client-versioned-skill", "description": "Initial"},
        headers=headers,
    )
    assert created.status_code == 201
    skill_id = created.json()["id"]

    response = await _post_client_skill_upload(
        client,
        api_token,
        file_content=_skill_zip_bytes("client-versioned-skill", "1.0.0", description="From archive"),
        data={
            "skill_uuid": skill_id,
            "metadata": json.dumps({"version": "2.0.0", "description": "From metadata"}),
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["version"] == "2.0.0"
    assert payload["current_version"] == "2.0.0"

    detail = await client.get(f"/api/v1/skills/{skill_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["current_version"] == "2.0.0"
    assert detail.json()["description"] == "From metadata"

    upload_events = await _audit_events(async_session, "skill.upload")
    upload_event = next(item for item in upload_events if item.target == skill_id)
    assert upload_event.details["filename"] == "skill.zip"
    assert upload_event.details["archive"] is True
    assert upload_event.details["version"] == "2.0.0"
    assert upload_event.details["client_api"] is True


@pytest.mark.asyncio
async def test_client_skill_upload_requires_api_token_with_upload_permission(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    access_token, _ = await _create_client_token(
        client,
        email="client-upload-auth@example.com",
        username="clientuploadauth",
        role="member",
    )
    _, viewer_api_token = await _create_client_token(
        client,
        email="client-upload-viewer@example.com",
        username="clientuploadviewer",
        role="viewer",
    )
    zip_content = _skill_zip_bytes("client-auth-skill")

    missing = await client.post(
        "/api/v1/client/skills/upload",
        files={"file": ("skill.zip", zip_content, "application/zip")},
    )
    assert missing.status_code == 401
    assert missing.json()["code"] == "UNAUTHORIZED"

    jwt_response = await client.post(
        "/api/v1/client/skills/upload",
        files={"file": ("skill.zip", zip_content, "application/zip")},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert jwt_response.status_code == 401
    assert jwt_response.json()["code"] == "UNAUTHORIZED"

    forbidden = await _post_client_skill_upload(
        client,
        viewer_api_token,
        file_content=zip_content,
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_client_skill_upload_rejects_invalid_archives_and_create_metadata(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    access_token, api_token = await _create_client_token(
        client,
        email="client-upload-invalid@example.com",
        username="clientuploadinvalid",
        role="member",
    )
    headers = {"Authorization": f"Bearer {access_token}"}
    created = await client.post(
        "/api/v1/skills",
        json={"name": "client-invalid-existing", "description": "Initial"},
        headers=headers,
    )
    assert created.status_code == 201
    skill_id = created.json()["id"]

    non_zip = await _post_client_skill_upload(
        client,
        api_token,
        file_content=b"plain text",
        filename="skill.txt",
    )
    assert non_zip.status_code == 400
    assert non_zip.json()["code"] == "INVALID_ZIP_FILE"

    missing_skill_md_buffer = io.BytesIO()
    with zipfile.ZipFile(missing_skill_md_buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("README.md", "missing skill md")
    missing_skill_md = missing_skill_md_buffer.getvalue()

    create_missing = await _post_client_skill_upload(
        client,
        api_token,
        file_content=missing_skill_md,
    )
    assert create_missing.status_code == 400
    assert create_missing.json()["code"] == "SKILL_MD_NOT_FOUND_IN_ZIP"

    update_missing = await _post_client_skill_upload(
        client,
        api_token,
        file_content=missing_skill_md,
        data={"skill_uuid": skill_id},
    )
    assert update_missing.status_code == 400
    assert update_missing.json()["code"] == "SKILL_MD_NOT_FOUND"

    create_with_metadata = await _post_client_skill_upload(
        client,
        api_token,
        file_content=_skill_zip_bytes("client-create-metadata"),
        data={"metadata": json.dumps({"version": "9.9.9"})},
    )
    assert create_with_metadata.status_code == 400
    assert create_with_metadata.json()["code"] == "INVALID_METADATA"


@pytest.mark.asyncio
async def test_client_skill_upload_rejects_duplicate_create_and_reference_update(
    client,
    async_session,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    access_token, api_token = await _create_client_token(
        client,
        email="client-upload-conflict@example.com",
        username="clientuploadconflict",
        role="member",
    )
    headers = {"Authorization": f"Bearer {access_token}"}

    first = await _post_client_skill_upload(
        client,
        api_token,
        file_content=_skill_zip_bytes("client-duplicate-skill"),
    )
    assert first.status_code == 201
    duplicate = await _post_client_skill_upload(
        client,
        api_token,
        file_content=_skill_zip_bytes("client-duplicate-skill", "1.0.1"),
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "SKILL_ALREADY_EXISTS"

    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    public_skill = await _create_public_skill(async_session, name="client-reference-source")
    reference = await client.post(
        f"/api/v1/skills/{public_skill.id}/reference",
        json={"name": "client-reference-target"},
        headers=headers,
    )
    assert reference.status_code == 201
    reference_id = reference.json()["id"]

    rejected = await _post_client_skill_upload(
        client,
        api_token,
        file_content=_skill_zip_bytes("client-reference-target", "1.0.0"),
        data={"skill_uuid": reference_id},
    )
    assert rejected.status_code == 409
    assert rejected.json()["code"] == "REFERENCE_SKILL_READ_ONLY"
