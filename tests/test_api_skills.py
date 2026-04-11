import io
import zipfile
from pathlib import Path

import pytest
from sqlalchemy import select
from sso_helpers import create_api_token

from backend.config.settings import settings
from backend.core.utils.skill_storage import (
    SYSTEM_USER_ID,
    create_skill_dir,
    get_skill_versions_dir,
)
from backend.models.audit_log import AuditLog
from backend.models.skill import Skill
from backend.models.skill_version import SkillVersion
from backend.models.user import User


async def _create_client_headers(client, access_token: str, name: str = "test-client") -> dict[str, str]:
    token = await create_api_token(client, access_token, name=name)
    return {"Authorization": f"Bearer {token}"}


async def _register_and_login(client, email: str, username: str) -> dict[str, str]:
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": email, "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "username": username, "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": email, "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "code": "123456"},
    )
    access = login.json()["access_token"]
    return {"Authorization": f"Bearer {access}"}


async def _create_public_skill(async_session, tmp_path: Path) -> Skill:
    system_user = User(
        id=SYSTEM_USER_ID,
        email="system@example.com",
        username="system",
        hashed_password="!",
        is_active=True,
        is_superuser=True,
        role="admin",
    )
    async_session.add(system_user)
    public_skill = Skill(
        user_id=SYSTEM_USER_ID,
        name="public-skill",
        description="Public skill description",
        tags=["public", "starter"],
        visibility="public",
        skill_dir=str(create_skill_dir(SYSTEM_USER_ID, "public-skill")),
        current_version="1.2.3",
        is_active=True,
    )
    async_session.add(public_skill)
    await async_session.flush()
    version_record = SkillVersion(
        skill_id=public_skill.id,
        version="1.2.3",
        description="Public skill description",
        dependencies=["requests"],
        metadata_json={},
    )
    async_session.add(version_record)
    await async_session.commit()

    version_dir = get_skill_versions_dir(SYSTEM_USER_ID, "public-skill") / "1.2.3"
    version_dir.mkdir(parents=True, exist_ok=True)
    (version_dir / "SKILL.md").write_text(
        "---\nname: public-skill\nversion: 1.2.3\ndescription: Public skill description\n---\nbody",
        encoding="utf-8",
    )
    (version_dir / "reference.md").write_text("public reference", encoding="utf-8")
    return public_skill


@pytest.mark.asyncio
async def test_skill_lifecycle(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "skill@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "skill@example.com", "username": "skilluser", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "skill@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "skill@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    api_headers = await _create_client_headers(client, access, name="skill-list-client")
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skillx", "description": "desc"},
        headers=headers,
    )
    assert created.status_code == 201
    skill_id = created.json()["id"]
    listed = await client.get("/api/v1/skills", headers=api_headers)
    assert listed.status_code == 200
    payload = listed.json()
    assert payload["total"] == 1
    updated = await client.put(
        f"/api/v1/skills/{skill_id}",
        json={"name": "skillx2", "description": "new"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "skillx2"
    deleted = await client.delete(f"/api/v1/skills/{skill_id}", headers=headers)
    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_skill_visible_field_alias(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "visible@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "visible@example.com", "username": "visible", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "visible@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "visible@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    created = await client.post(
        "/api/v1/skills",
        json={"name": "visible-skill", "description": "desc", "visible": "private"},
        headers=headers,
    )
    assert created.status_code == 201
    created_payload = created.json()
    assert created_payload["visible"] == "private"
    assert "visibility" not in created_payload
    skill_id = created_payload["id"]
    updated = await client.put(
        f"/api/v1/skills/{skill_id}",
        json={"visible": "team"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["visible"] == "team"


@pytest.mark.asyncio
async def test_skill_name_max_length(client):
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "longskill@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "longskill@example.com", "username": "longskill", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "longskill@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "longskill@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    long_name = "s" * 101
    response = await client.post(
        "/api/v1/skills",
        json={"name": long_name, "description": "desc"},
        headers=headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_skill_upload_and_list_files(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "upload@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "upload@example.com", "username": "uploaduser", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "upload@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "upload@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skillup", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    files = {"file": ("reference.md", b"hello", "text/markdown")}
    data = {"skill_uuid": skill_id}
    uploaded = await client.post("/api/v1/skills/upload", data=data, files=files, headers=headers)
    assert uploaded.status_code == 201
    listed = await client.get(f"/api/v1/skills/{skill_id}/files", headers=headers)
    assert listed.status_code == 200
    assert "reference.md" in listed.json()
    bad_files = {"file": ("../bad.txt", b"bad", "text/plain")}
    bad = await client.post("/api/v1/skills/upload", data=data, files=bad_files, headers=headers)
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_skill_upload_rejects_oversized_file_before_full_read(client, tmp_path, monkeypatch):
    import backend.api.v1.skills as skills_api

    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(skills_api, "MAX_FILE_SIZE", 5)
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "upload-limit@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "upload-limit@example.com", "username": "uploadlimit", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "upload-limit@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "upload-limit@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skilllimit", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    files = {"file": ("reference.md", b"123456", "text/markdown")}
    response = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files=files,
        headers=headers,
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "File exceeds maximum size limit"


@pytest.mark.asyncio
async def test_skill_zip_upload_creates_version(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "zip@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "zip@example.com", "username": "zipuser", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "zip@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "zip@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    api_headers = await _create_client_headers(client, access, name="zip-versions-client")
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skillzip", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "SKILL.md",
            "---\nname: skillzip\ndescription: zip desc\nversion: 1.0.0\ndependencies: [dep1, dep2]\n---\nbody",
        )
        archive.writestr("reference.md", "hello")
    buffer.seek(0)
    files = {"file": ("skill.zip", buffer.read(), "application/zip")}
    data = {"skill_uuid": skill_id}
    uploaded = await client.post("/api/v1/skills/upload", data=data, files=files, headers=headers)
    assert uploaded.status_code == 201
    payload = uploaded.json()
    assert payload["version"] == "1.0.0"
    assert payload["current_version"] == "1.0.0"
    versions = await client.get(f"/api/v1/skills/{skill_id}/versions", headers=api_headers)
    assert versions.status_code == 200
    items = versions.json()["items"]
    assert items[0]["version"] == "1.0.0"
    assert items[0]["dependencies"] == ["dep1", "dep2"]
    listed = await client.get(f"/api/v1/skills/{skill_id}/files", headers=headers)
    assert "SKILL.md" in listed.json()
    assert "reference.md" in listed.json()


@pytest.mark.asyncio
async def test_skill_version_rollback_restores_files(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "rollback@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "rollback@example.com", "username": "rollback", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "rollback@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "rollback@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skillroll", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    first = io.BytesIO()
    with zipfile.ZipFile(first, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skillroll\nversion: 1.0.0\n---\nfirst")
    first.seek(0)
    await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", first.read(), "application/zip")},
        headers=headers,
    )
    second = io.BytesIO()
    with zipfile.ZipFile(second, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skillroll\nversion: 1.1.0\n---\nsecond")
    second.seek(0)
    await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", second.read(), "application/zip")},
        headers=headers,
    )
    rollback = await client.post(
        f"/api/v1/skills/{skill_id}/versions/1.0.0/rollback",
        headers=headers,
    )
    assert rollback.status_code == 200
    content = await client.get(
        f"/api/v1/skills/{skill_id}/files/SKILL.md",
        headers=headers,
    )
    assert "first" in content.text


@pytest.mark.asyncio
async def test_skill_deactivate_hides_from_list(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "deactivate@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "deactivate@example.com", "username": "deactivate", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "deactivate@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "deactivate@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    api_headers = await _create_client_headers(client, access, name="deactivate-list-client")
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skilldown", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    deactivated = await client.post(f"/api/v1/skills/{skill_id}/deactivate", headers=headers)
    assert deactivated.status_code == 200
    assert deactivated.json()["cache_revoked_at"] is not None
    listed = await client.get("/api/v1/skills", headers=api_headers)
    assert listed.json()["total"] == 0
    listed_all = await client.get("/api/v1/skills?include_inactive=true", headers=api_headers)
    assert listed_all.json()["total"] == 1
    assert listed_all.json()["items"][0]["is_active"] is False


@pytest.mark.asyncio
async def test_skill_deactivate_blocks_file_access(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "blockedfile@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "blockedfile@example.com", "username": "blockedfile", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "blockedfile@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "blockedfile@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skillblock", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skillblock\nversion: 1.0.0\n---\nbody")
    buffer.seek(0)
    await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", buffer.read(), "application/zip")},
        headers=headers,
    )
    await client.post(f"/api/v1/skills/{skill_id}/deactivate", headers=headers)
    blocked = await client.get(f"/api/v1/skills/{skill_id}/files", headers=headers)
    assert blocked.status_code == 410
    payload = blocked.json()
    assert payload["code"] == "SKILL_DEACTIVATED"
    assert payload["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_skill_install_instructions_returns_client_strategy(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "deps@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "deps@example.com", "username": "depsuser", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "deps@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "deps@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    api_headers = await _create_client_headers(client, access, name="deps-install-client")
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skilldeps", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "SKILL.md",
            "---\nname: skilldeps\nversion: 1.0.0\ndependencies: [requests, pydantic]\n---\nbody",
        )
    buffer.seek(0)
    await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", buffer.read(), "application/zip")},
        headers=headers,
    )
    response = await client.get(
        f"/api/v1/skills/{skill_id}/versions/1.0.0/install-instructions",
        headers=api_headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["strategy"] == "client"
    assert payload["dependencies"] == ["requests", "pydantic"]
    assert "pip" in payload["commands"][0]


@pytest.mark.asyncio
async def test_skill_install_instructions_reads_requirements_file(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "reqs@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "reqs@example.com", "username": "reqsuser", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "reqs@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "reqs@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    api_headers = await _create_client_headers(client, access, name="reqs-install-client")
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skillreqs", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skillreqs\nversion: 1.0.0\n---\nbody")
        archive.writestr("requirements.txt", "requests==2.31.0\npydantic\n")
    buffer.seek(0)
    await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", buffer.read(), "application/zip")},
        headers=headers,
    )
    response = await client.get(
        f"/api/v1/skills/{skill_id}/versions/1.0.0/install-instructions",
        headers=api_headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["dependencies"] == ["requests==2.31.0", "pydantic"]
    assert payload["ecosystem"] == "python"
@pytest.mark.asyncio
async def test_skill_versions_diff_returns_modified_files(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "diff@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "diff@example.com", "username": "diffuser", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "diff@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "diff@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skilldiff", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    first = io.BytesIO()
    with zipfile.ZipFile(first, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skilldiff\nversion: 1.0.0\n---\nbody")
        archive.writestr("reference.md", "first")
    first.seek(0)
    await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", first.read(), "application/zip")},
        headers=headers,
    )
    second = io.BytesIO()
    with zipfile.ZipFile(second, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skilldiff\nversion: 1.1.0\n---\nbody")
        archive.writestr("reference.md", "second")
        archive.writestr("new.md", "added")
    second.seek(0)
    await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", second.read(), "application/zip")},
        headers=headers,
    )
    response = await client.get(
        f"/api/v1/skills/{skill_id}/versions/diff?from=1.0.0&to=1.1.0",
        headers=headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert "new.md" in payload["added"]
    modified = {item["path"]: item["diff"] for item in payload["modified"]}
    assert "reference.md" in modified
    assert "-first" in modified["reference.md"]
    assert "+second" in modified["reference.md"]


@pytest.mark.asyncio
async def test_skill_version_auto_increment(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "auto@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "auto@example.com", "username": "auto", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "auto@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "auto@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    api_headers = await _create_client_headers(client, access, name="auto-versions-client")
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skillauto", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    first = io.BytesIO()
    with zipfile.ZipFile(first, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skillauto\ndescription: auto\n---\nfirst")
    first.seek(0)
    uploaded_first = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", first.read(), "application/zip")},
        headers=headers,
    )
    assert uploaded_first.status_code == 201
    assert uploaded_first.json()["version"] == "1.0.0"
    second = io.BytesIO()
    with zipfile.ZipFile(second, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skillauto\ndescription: auto\n---\nsecond")
    second.seek(0)
    uploaded_second = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", second.read(), "application/zip")},
        headers=headers,
    )
    assert uploaded_second.status_code == 201
    assert uploaded_second.json()["version"] == "1.0.1"
    versions = await client.get(f"/api/v1/skills/{skill_id}/versions", headers=api_headers)
    items = versions.json()["items"]
    assert items[0]["version"] == "1.0.1"
    assert items[1]["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_skill_version_auto_increment_with_minor_strategy(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    original_strategy = settings.SKILL_VERSION_BUMP_STRATEGY
    settings.SKILL_VERSION_BUMP_STRATEGY = "minor"
    try:
        await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "auto-minor@example.com", "purpose": "register"},
        )
        await client.post(
            "/api/v1/auth/register",
            json={"email": "auto-minor@example.com", "username": "auto-minor", "code": "123456"},
        )
        await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "auto-minor@example.com", "purpose": "login"},
        )
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "auto-minor@example.com", "code": "123456"},
        )
        access = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {access}"}
        created = await client.post(
            "/api/v1/skills",
            json={"name": "skillautominor", "description": "desc"},
            headers=headers,
        )
        skill_id = created.json()["id"]
        first = io.BytesIO()
        with zipfile.ZipFile(first, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("SKILL.md", "---\nname: skillautominor\ndescription: auto\n---\nfirst")
        first.seek(0)
        uploaded_first = await client.post(
            "/api/v1/skills/upload",
            data={"skill_uuid": skill_id},
            files={"file": ("skill.zip", first.read(), "application/zip")},
            headers=headers,
        )
        assert uploaded_first.status_code == 201
        assert uploaded_first.json()["version"] == "1.0.0"
        second = io.BytesIO()
        with zipfile.ZipFile(second, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("SKILL.md", "---\nname: skillautominor\ndescription: auto\n---\nsecond")
        second.seek(0)
        uploaded_second = await client.post(
            "/api/v1/skills/upload",
            data={"skill_uuid": skill_id},
            files={"file": ("skill.zip", second.read(), "application/zip")},
            headers=headers,
        )
        assert uploaded_second.status_code == 201
        assert uploaded_second.json()["version"] == "1.1.0"
    finally:
        settings.SKILL_VERSION_BUMP_STRATEGY = original_strategy


@pytest.mark.asyncio
async def test_skill_version_conflict_auto_bump_patch_strategy(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "conflict-patch@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "conflict-patch@example.com", "username": "conflict-patch", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "conflict-patch@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "conflict-patch@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skillconflictpatch", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    first = io.BytesIO()
    with zipfile.ZipFile(first, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skillconflictpatch\nversion: 1.0.0\n---\nfirst")
    first.seek(0)
    uploaded_first = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", first.read(), "application/zip")},
        headers=headers,
    )
    assert uploaded_first.status_code == 201
    assert uploaded_first.json()["version"] == "1.0.0"
    second = io.BytesIO()
    with zipfile.ZipFile(second, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skillconflictpatch\nversion: 1.0.0\n---\nsecond")
    second.seek(0)
    uploaded_second = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", second.read(), "application/zip")},
        headers=headers,
    )
    assert uploaded_second.status_code == 201
    assert uploaded_second.json()["version"] == "1.0.1"


@pytest.mark.asyncio
async def test_skill_version_conflict_auto_bump_minor_strategy(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    original_strategy = settings.SKILL_VERSION_BUMP_STRATEGY
    settings.SKILL_VERSION_BUMP_STRATEGY = "minor"
    try:
        await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "conflict-minor@example.com", "purpose": "register"},
        )
        await client.post(
            "/api/v1/auth/register",
            json={"email": "conflict-minor@example.com", "username": "conflict-minor", "code": "123456"},
        )
        await client.post(
            "/api/v1/auth/verification-code",
            json={"email": "conflict-minor@example.com", "purpose": "login"},
        )
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "conflict-minor@example.com", "code": "123456"},
        )
        access = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {access}"}
        created = await client.post(
            "/api/v1/skills",
            json={"name": "skillconflictminor", "description": "desc"},
            headers=headers,
        )
        skill_id = created.json()["id"]
        first = io.BytesIO()
        with zipfile.ZipFile(first, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("SKILL.md", "---\nname: skillconflictminor\nversion: 1.0.0\n---\nfirst")
        first.seek(0)
        uploaded_first = await client.post(
            "/api/v1/skills/upload",
            data={"skill_uuid": skill_id},
            files={"file": ("skill.zip", first.read(), "application/zip")},
            headers=headers,
        )
        assert uploaded_first.status_code == 201
        assert uploaded_first.json()["version"] == "1.0.0"
        second = io.BytesIO()
        with zipfile.ZipFile(second, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("SKILL.md", "---\nname: skillconflictminor\nversion: 1.0.0\n---\nsecond")
        second.seek(0)
        uploaded_second = await client.post(
            "/api/v1/skills/upload",
            data={"skill_uuid": skill_id},
            files={"file": ("skill.zip", second.read(), "application/zip")},
            headers=headers,
        )
        assert uploaded_second.status_code == 201
        assert uploaded_second.json()["version"] == "1.1.0"
    finally:
        settings.SKILL_VERSION_BUMP_STRATEGY = original_strategy


@pytest.mark.asyncio
async def test_skill_search_by_tag(client):
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "tag@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "tag@example.com", "username": "tagger", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "tag@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "tag@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    api_headers = await _create_client_headers(client, access, name="tag-search-client")
    first = await client.post(
        "/api/v1/skills",
        json={"name": "skilltag1", "description": "desc", "tags": ["vision", "nlp"]},
        headers=headers,
    )
    assert first.status_code == 201
    assert "vision" in first.json()["tags"]
    await client.post(
        "/api/v1/skills",
        json={"name": "skilltag2", "description": "desc", "tags": ["audio"]},
        headers=headers,
    )
    listed = await client.get("/api/v1/skills?q=vision", headers=api_headers)
    assert listed.status_code == 200
    payload = listed.json()
    assert payload["total"] == 1
    assert payload["items"][0]["name"] == "skilltag1"
    assert "vision" in payload["items"][0]["tags"]


@pytest.mark.asyncio
async def test_skill_dependency_spec_frontmatter_yaml(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "yaml@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "yaml@example.com", "username": "yamluser", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "yaml@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "yaml@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    api_headers = await _create_client_headers(client, access, name="yaml-install-client")
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skillyaml", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "SKILL.md",
            "---\nname: skillyaml\ndescription: dep\nversion: 2.0.0\ndependency_spec:\n  schema_version: 1\n  python:\n    manager: uv\n    requirements:\n      - requests==2.31.0\n    files: []\n  system:\n    packages:\n      - git\n    notes: needed\n---\nbody",
        )
    buffer.seek(0)
    uploaded = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", buffer.read(), "application/zip")},
        headers=headers,
    )
    assert uploaded.status_code == 201
    response = await client.get(
        f"/api/v1/skills/{skill_id}/versions/2.0.0/install-instructions",
        headers=api_headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["ecosystem"] == "python"
    assert payload["commands"] == ["uv pip install requests==2.31.0"]
    assert payload["dependency_spec"]["python"]["manager"] == "uv"
    assert "git" in payload["dependency_spec"]["system"]["packages"]


@pytest.mark.asyncio
async def test_skill_dependency_spec_frontmatter_rejects_non_uv_manager(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "yaml2@example.com", "purpose": "register"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "yaml2@example.com", "username": "yamluser2", "code": "123456"},
    )
    await client.post(
        "/api/v1/auth/verification-code",
        json={"email": "yaml2@example.com", "purpose": "login"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "yaml2@example.com", "code": "123456"},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skillyaml2", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "SKILL.md",
            "---\nname: skillyaml2\ndescription: dep\nversion: 2.0.0\ndependency_spec:\n  schema_version: 1\n  python:\n    manager: poetry\n    requirements:\n      - requests==2.31.0\n    files: []\n---\nbody",
        )
    buffer.seek(0)
    uploaded = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", buffer.read(), "application/zip")},
        headers=headers,
    )
    assert uploaded.status_code == 400
    payload = uploaded.json()
    assert "manager" in payload["detail"].lower()


@pytest.mark.asyncio
async def test_public_skill_list_and_detail(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    public_skill = await _create_public_skill(async_session, tmp_path)

    listed = await client.get("/api/v1/skills/public")
    assert listed.status_code == 200
    payload = listed.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == public_skill.id
    assert payload["items"][0]["skill_kind"] == "public"
    assert payload["items"][0]["resolved_version"] == "1.2.3"
    assert payload["items"][0]["has_reference"] is False
    assert payload["items"][0]["has_clone"] is False

    detail = await client.get(f"/api/v1/skills/public/{public_skill.id}")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["id"] == public_skill.id
    assert detail_payload["visible"] == "public"
    assert detail_payload["skill_kind"] == "public"
    assert detail_payload["resolved_version"] == "1.2.3"


@pytest.mark.asyncio
async def test_reference_skill_read_only_and_pin_unpin(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    public_skill = await _create_public_skill(async_session, tmp_path)
    headers = await _register_and_login(client, "reference-user@example.com", "reference-user")

    created = await client.post(
        f"/api/v1/skills/{public_skill.id}/reference",
        json={"name": "public-skill-ref"},
        headers=headers,
    )
    assert created.status_code == 201
    created_payload = created.json()
    reference_id = created_payload["id"]
    assert created_payload["skill_kind"] == "reference"
    assert created_payload["is_reference_read_only"] is True
    assert created_payload["resolved_version"] == "1.2.3"
    assert created_payload["pinned_version"] is None
    assert created_payload["source_skill_id"] == public_skill.id

    files = await client.get(f"/api/v1/skills/{reference_id}/files", headers=headers)
    assert files.status_code == 200
    assert "SKILL.md" in files.json()
    content = await client.get(f"/api/v1/skills/{reference_id}/files/reference.md", headers=headers)
    assert content.status_code == 200
    assert content.text == "public reference"

    updated = await client.put(
        f"/api/v1/skills/{reference_id}",
        json={"description": "should fail"},
        headers=headers,
    )
    assert updated.status_code == 409
    assert updated.json()["code"] == "REFERENCE_SKILL_READ_ONLY"

    uploaded = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": reference_id},
        files={"file": ("extra.md", b"nope", "text/markdown")},
        headers=headers,
    )
    assert uploaded.status_code == 409
    assert uploaded.json()["code"] == "REFERENCE_SKILL_READ_ONLY"

    pinned = await client.put(
        f"/api/v1/skills/{reference_id}/pin",
        json={"version": "1.2.3"},
        headers=headers,
    )
    assert pinned.status_code == 200
    assert pinned.json()["pinned_version"] == "1.2.3"

    unpinned = await client.put(f"/api/v1/skills/{reference_id}/unpin", headers=headers)
    assert unpinned.status_code == 200
    assert unpinned.json()["pinned_version"] is None


@pytest.mark.asyncio
async def test_reference_skill_repin_updates_to_new_version(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    public_skill = await _create_public_skill(async_session, tmp_path)
    version_dir = get_skill_versions_dir(SYSTEM_USER_ID, "public-skill")
    second_version_dir = version_dir / "1.2.4"
    second_version_dir.mkdir(parents=True, exist_ok=True)
    (second_version_dir / "SKILL.md").write_text(
        "---\nname: public-skill\nversion: 1.2.4\ndescription: Public skill description\n---\nbody v1.2.4",
        encoding="utf-8",
    )
    async_session.add(
        SkillVersion(
            skill_id=public_skill.id,
            version="1.2.4",
            description="Public skill description",
            dependencies=["requests"],
            metadata_json={},
        )
    )
    public_skill.current_version = "1.2.4"
    await async_session.commit()

    headers = await _register_and_login(client, "repin@example.com", "repin-user")
    created = await client.post(
        f"/api/v1/skills/{public_skill.id}/reference",
        json={"name": "public-repin-reference", "pinned_version": "1.2.3"},
        headers=headers,
    )
    assert created.status_code == 201
    reference_id = created.json()["id"]
    assert created.json()["pinned_version"] == "1.2.3"

    repinned = await client.put(
        f"/api/v1/skills/{reference_id}/pin",
        json={"version": "1.2.4"},
        headers=headers,
    )
    assert repinned.status_code == 200
    assert repinned.json()["pinned_version"] == "1.2.4"
    assert repinned.json()["resolved_version"] == "1.2.4"


@pytest.mark.asyncio
async def test_duplicate_reference_returns_conflict(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    public_skill = await _create_public_skill(async_session, tmp_path)

    headers = await _register_and_login(client, "duplicate-ref@example.com", "duplicate-ref-user")
    first = await client.post(
        f"/api/v1/skills/{public_skill.id}/reference",
        json={"name": "public-reference-one"},
        headers=headers,
    )
    assert first.status_code == 201

    second = await client.post(
        f"/api/v1/skills/{public_skill.id}/reference",
        json={"name": "public-reference-two"},
        headers=headers,
    )
    assert second.status_code == 409
    assert second.json()["code"] == "REFERENCE_ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_public_list_tolerates_historical_duplicate_references(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    public_skill = await _create_public_skill(async_session, tmp_path)

    headers = await _register_and_login(client, "duplicate-history@example.com", "duplicate-history-user")
    user_result = await async_session.execute(select(User).where(User.email == "duplicate-history@example.com"))
    user = user_result.scalar_one()
    async_session.add_all(
        [
            Skill(
                user_id=user.id,
                name="historical-reference-a",
                description="ref",
                visibility="private",
                source_skill_id=public_skill.id,
                pinned_version=None,
                skill_dir="",
                current_version=None,
                is_active=True,
            ),
            Skill(
                user_id=user.id,
                name="historical-reference-b",
                description="ref",
                visibility="private",
                source_skill_id=public_skill.id,
                pinned_version=None,
                skill_dir="",
                current_version=None,
                is_active=True,
            ),
        ]
    )
    await async_session.commit()

    listed = await client.get("/api/v1/skills/public", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["items"][0]["has_reference"] is True


@pytest.mark.asyncio
async def test_clone_public_skill_and_mark_public_list_flags(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    public_skill = await _create_public_skill(async_session, tmp_path)
    headers = await _register_and_login(client, "clone-user@example.com", "clone-user")

    cloned = await client.post(
        f"/api/v1/skills/{public_skill.id}/clone",
        json={"name": "public-skill-clone", "visible": "private"},
        headers=headers,
    )
    assert cloned.status_code == 201
    clone_payload = cloned.json()
    clone_id = clone_payload["id"]
    assert clone_payload["skill_kind"] == "clone"
    assert clone_payload["resolved_version"] == "1.0.0"
    assert clone_payload["is_reference_read_only"] is False

    clone_files = await client.get(f"/api/v1/skills/{clone_id}/files", headers=headers)
    assert clone_files.status_code == 200
    assert "reference.md" in clone_files.json()
    clone_content = await client.get(f"/api/v1/skills/{clone_id}/files/reference.md", headers=headers)
    assert clone_content.status_code == 200
    assert clone_content.text == "public reference"

    referenced = await client.post(
        f"/api/v1/skills/{public_skill.id}/reference",
        json={"name": "public-skill-ref-2"},
        headers=headers,
    )
    assert referenced.status_code == 201

    listed = await client.get("/api/v1/skills/public", headers=headers)
    assert listed.status_code == 200
    item = listed.json()["items"][0]
    assert item["id"] == public_skill.id
    assert item["has_reference"] is True
    assert item["has_clone"] is True


@pytest.mark.asyncio
async def test_clone_remains_clone_after_followup_version_upload(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    public_skill = await _create_public_skill(async_session, tmp_path)
    headers = await _register_and_login(client, "clone-followup@example.com", "clone-followup")
    api_headers = await _create_client_headers(
        client,
        headers["Authorization"].split(" ", 1)[1],
        name="clone-followup-client",
    )

    cloned = await client.post(
        f"/api/v1/skills/{public_skill.id}/clone",
        json={"name": "public-skill-clone-followup", "visible": "private"},
        headers=headers,
    )
    assert cloned.status_code == 201
    clone_id = cloned.json()["id"]

    second = io.BytesIO()
    with zipfile.ZipFile(second, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: public-skill-clone-followup\nversion: 1.1.0\n---\nsecond")
        archive.writestr("reference.md", "second")
    second.seek(0)
    uploaded = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": clone_id},
        files={"file": ("skill.zip", second.read(), "application/zip")},
        headers=headers,
    )
    assert uploaded.status_code == 201

    detail = await client.get(f"/api/v1/skills/{clone_id}", headers=api_headers)
    assert detail.status_code == 200
    assert detail.json()["skill_kind"] == "clone"

    listed = await client.get("/api/v1/skills/public", headers=headers)
    assert listed.status_code == 200
    item = listed.json()["items"][0]
    assert item["id"] == public_skill.id
    assert item["has_clone"] is True


@pytest.mark.asyncio
async def test_clone_audit_log_records_source_version(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    monkeypatch.setattr(settings, "ENABLE_AUDIT_LOG", True)
    public_skill = await _create_public_skill(async_session, tmp_path)
    headers = await _register_and_login(client, "clone-audit@example.com", "clone-audit")

    cloned = await client.post(
        f"/api/v1/skills/{public_skill.id}/clone",
        json={"name": "public-skill-clone-audit", "visible": "private"},
        headers=headers,
    )
    assert cloned.status_code == 201

    result = await async_session.execute(
        select(AuditLog).where(AuditLog.action == "skill.clone").order_by(AuditLog.timestamp.desc())
    )
    audit_log = result.scalars().first()
    assert audit_log is not None
    assert audit_log.details["source_skill_id"] == public_skill.id
    assert audit_log.details["source_version"] == "1.2.3"
    assert audit_log.details["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_upload_zip_create_skill_invalid_visibility_returns_400(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    headers = await _register_and_login(client, "zip-invalid-visible@example.com", "zip-invalid-visible")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skill-invalid-visible\ndescription: desc\nversion: 1.0.0\n---\nbody")
    buffer.seek(0)

    response = await client.post(
        "/api/v1/skills/upload",
        data={"visibility": "invalid"},
        files={"file": ("skill.zip", buffer.read(), "application/zip")},
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid visibility"


@pytest.mark.asyncio
async def test_public_list_marks_clone_beyond_500_owned_skills(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    public_skill = await _create_public_skill(async_session, tmp_path)
    headers = await _register_and_login(client, "clone-cap@example.com", "clone-cap-user")

    owner = await async_session.execute(select(User).where(User.email == "clone-cap@example.com"))
    owner_user = owner.scalar_one()

    filler_skills = [
        Skill(
            user_id=owner_user.id,
            name=f"owned-skill-{index:03d}",
            description="filler",
            tags=[],
            visibility="private",
            skill_dir="",
            current_version=None,
            is_active=True,
        )
        for index in range(501)
    ]
    async_session.add_all(filler_skills)
    await async_session.flush()

    clone_skill = Skill(
        user_id=owner_user.id,
        name="late-clone-skill",
        description="clone",
        tags=[],
        visibility="private",
        skill_dir="",
        current_version="1.0.0",
        is_active=True,
    )
    async_session.add(clone_skill)
    await async_session.flush()
    async_session.add(
        SkillVersion(
            skill_id=clone_skill.id,
            version="1.0.0",
            description="clone",
            dependencies=[],
            metadata_json={"cloned_from_skill_id": public_skill.id, "cloned_from_version": "1.2.3"},
        )
    )
    await async_session.commit()

    listed = await client.get("/api/v1/skills/public", headers=headers)
    assert listed.status_code == 200
    item = listed.json()["items"][0]
    assert item["id"] == public_skill.id
    assert item["has_clone"] is True


@pytest.mark.asyncio
async def test_invalid_version_returns_400_not_404(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    headers = await _register_and_login(client, "invalid-version@example.com", "invalid-version")
    api_headers = await _create_client_headers(client, headers["Authorization"].split(" ", 1)[1], name="invalid-version-client")
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skill-invalid-version", "description": "desc"},
        headers=headers,
    )
    assert created.status_code == 201
    skill_id = created.json()["id"]

    response = await client.get(f"/api/v1/skills/{skill_id}/versions/invalid%20version!", headers=api_headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid version"


@pytest.mark.asyncio
async def test_zip_without_skill_md_returns_400_not_404(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    headers = await _register_and_login(client, "missing-skill-md@example.com", "missing-skill-md")
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skill-missing-md", "description": "desc"},
        headers=headers,
    )
    assert created.status_code == 201
    skill_id = created.json()["id"]

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("reference.md", "missing skill doc")
    buffer.seek(0)

    response = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", buffer.read(), "application/zip")},
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "SKILL.md not found"


@pytest.mark.asyncio
async def test_reference_and_clone_do_not_leak_private_skill_existence(client, async_session, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    headers = await _register_and_login(client, "private-source-user@example.com", "private-source-user")

    owner = await async_session.execute(select(User).where(User.email == "private-source-user@example.com"))
    owner_user = owner.scalar_one()
    private_skill = Skill(
        user_id=owner_user.id,
        name="private-source-skill",
        description="Private source",
        tags=[],
        visibility="private",
        skill_dir="",
        current_version=None,
        is_active=True,
    )
    async_session.add(private_skill)
    await async_session.commit()
    await async_session.refresh(private_skill)

    referenced = await client.post(
        f"/api/v1/skills/{private_skill.id}/reference",
        json={"name": "should-not-work"},
        headers=headers,
    )
    assert referenced.status_code == 404
    assert referenced.json()["code"] == "SKILL_NOT_FOUND"

    cloned = await client.post(
        f"/api/v1/skills/{private_skill.id}/clone",
        json={"name": "should-not-clone", "visible": "private"},
        headers=headers,
    )
    assert cloned.status_code == 404
    assert cloned.json()["code"] == "SKILL_NOT_FOUND"

    missing_reference = await client.post(
        "/api/v1/skills/00000000-0000-0000-0000-000000000099/reference",
        json={"name": "missing-source"},
        headers=headers,
    )
    assert missing_reference.status_code == 404
    assert missing_reference.json()["code"] == "SKILL_NOT_FOUND"
