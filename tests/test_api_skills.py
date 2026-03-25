import io
import zipfile

import pytest

from backend.config.settings import settings


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
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skillx", "description": "desc"},
        headers=headers,
    )
    assert created.status_code == 201
    skill_id = created.json()["id"]
    listed = await client.get("/api/v1/skills", headers=headers)
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
    versions = await client.get(f"/api/v1/skills/{skill_id}/versions", headers=headers)
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
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skilldown", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    deactivated = await client.post(f"/api/v1/skills/{skill_id}/deactivate", headers=headers)
    assert deactivated.status_code == 200
    assert deactivated.json()["cache_revoked_at"] is not None
    listed = await client.get("/api/v1/skills", headers=headers)
    assert listed.json()["total"] == 0
    listed_all = await client.get("/api/v1/skills?include_inactive=true", headers=headers)
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
        headers=headers,
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
        headers=headers,
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
    versions = await client.get(f"/api/v1/skills/{skill_id}/versions", headers=headers)
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
    listed = await client.get("/api/v1/skills?q=vision", headers=headers)
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
            "---\nname: skillyaml\ndescription: dep\nversion: 2.0.0\ndependency_spec:\n  schema_version: 1\n  python:\n    manager: poetry\n    requirements:\n      - requests==2.31.0\n    files: []\n  system:\n    packages:\n      - git\n    notes: needed\n---\nbody",
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
        headers=headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["ecosystem"] == "python"
    assert payload["commands"] == ["poetry install"]
    assert payload["dependency_spec"]["python"]["manager"] == "poetry"
    assert "git" in payload["dependency_spec"]["system"]["packages"]
