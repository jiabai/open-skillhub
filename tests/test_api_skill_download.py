import base64
import hashlib
import io
import zipfile
from datetime import datetime, timezone

import pytest
from sso_helpers import sso_login


async def _create_uploaded_skill(client, headers, name: str, version: str = "1.0.0", extra_files: dict[str, bytes | str] | None = None):
    created = await client.post(
        "/api/v1/skills",
        json={"name": name, "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", f"---\nname: {name}\nversion: {version}\n---\nbody")
        for file_name, content in (extra_files or {}).items():
            archive.writestr(file_name, content)
    buffer.seek(0)
    upload = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", buffer.read(), "application/zip")},
        headers=headers,
    )
    assert upload.status_code == 201
    return skill_id


@pytest.mark.asyncio
async def test_skill_download_returns_encrypted_payload(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    access = await sso_login(
        client,
        email="download@example.com",
        username="downloader",
        enterprise_id="test-ent",
        team_id="test-team",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {access}"}
    skill_id = await _create_uploaded_skill(
        client,
        headers,
        "skilldl",
        extra_files={"reference.md": "hello"},
    )
    response = await client.post(
        "/api/v1/skills/download",
        json={"skill_uuid": skill_id, "version": "1.0.0"},
        headers=headers,
    )
    assert response.status_code == 200
    payload = response.json()
    encrypted = base64.b64decode(payload["encrypted_code"])
    digest = hashlib.sha256(encrypted).hexdigest()
    assert payload["checksum"] == f"sha256:{digest}"
    assert payload["skill_uuid"] == skill_id
    assert payload["version"] == "1.0.0"
    assert payload["archive_size_bytes"] > 0
    assert payload["encryption_enabled"] is True
    assert payload["download_filename"] == f"skill-{skill_id[:8]}-1.0.0.encrypted.json"
    assert "decryption" in payload["decryption_hint"].lower()
    expires_at = datetime.fromisoformat(payload["expires_at"].replace("Z", "+00:00"))
    assert expires_at > datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_skill_download_denied_without_permission(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    access = await sso_login(
        client,
        email="nodownload@example.com",
        username="nodownloader",
        enterprise_id="test-ent",
        team_id="test-team",
        role="member",
    )
    headers = {"Authorization": f"Bearer {access}"}
    skill_id = await _create_uploaded_skill(client, headers, "skilldl2")
    response = await client.post(
        "/api/v1/skills/download",
        json={"skill_uuid": skill_id, "version": "1.0.0"},
        headers=headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_skill_download_returns_gone_for_deactivated_skill(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    access = await sso_login(
        client,
        email="download-deactivated@example.com",
        username="downloaddeactivated",
        enterprise_id="test-ent",
        team_id="test-team",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {access}"}
    skill_id = await _create_uploaded_skill(client, headers, "skilldl3")
    deactivate_response = await client.post(
        f"/api/v1/skills/{skill_id}/deactivate",
        headers=headers,
    )
    assert deactivate_response.status_code == 200

    response = await client.post(
        "/api/v1/skills/download",
        json={"skill_uuid": skill_id, "version": "1.0.0"},
        headers=headers,
    )

    assert response.status_code == 410
    payload = response.json()
    assert payload["code"] == "SKILL_DEACTIVATED"
    assert payload["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_skill_download_returns_safe_500_for_unexpected_error(client, tmp_path, monkeypatch):
    from backend.api.v1 import skills as skills_api

    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    access = await sso_login(
        client,
        email="download-failure@example.com",
        username="downloadfailure",
        enterprise_id="test-ent",
        team_id="test-team",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {access}"}

    async def broken_download_skill(self, user, skill_uuid, version=None):
        raise RuntimeError("database offline")

    monkeypatch.setattr(skills_api.SkillService, "download_skill", broken_download_skill)

    response = await client.post(
        "/api/v1/skills/download",
        json={"skill_uuid": "00000000-0000-0000-0000-000000000000", "version": "1.0.0"},
        headers=headers,
    )

    assert response.status_code == 500
    payload = response.json()
    assert payload["detail"] == "Download failed"
    assert payload["code"] == "HTTP_ERROR"
    assert payload["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_skill_download_rejects_invalid_uuid(client):
    access = await sso_login(
        client,
        email="download-invalid-uuid@example.com",
        username="downloadinvaliduuid",
        enterprise_id="test-ent",
        team_id="test-team",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {access}"}

    response = await client.post(
        "/api/v1/skills/download",
        json={"skill_uuid": "not-a-valid-uuid", "version": "1.0.0"},
        headers=headers,
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["code"] == "VALIDATION_ERROR"
    assert payload["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_skill_download_rejects_oversized_request_body(client):
    from backend.config.settings import settings

    access = await sso_login(
        client,
        email="download-large-request@example.com",
        username="downloadlargerequest",
        enterprise_id="test-ent",
        team_id="test-team",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {access}"}
    original_limit = settings.SKILL_DOWNLOAD_MAX_REQUEST_BYTES
    settings.SKILL_DOWNLOAD_MAX_REQUEST_BYTES = 64
    try:
        response = await client.post(
            "/api/v1/skills/download",
            json={"skill_uuid": "00000000-0000-0000-0000-000000000000", "version": "v" * 256},
            headers=headers,
        )
    finally:
        settings.SKILL_DOWNLOAD_MAX_REQUEST_BYTES = original_limit

    assert response.status_code == 413
    payload = response.json()
    assert payload["detail"] == "Request too large"
    assert payload["code"] == "REQUEST_TOO_LARGE"


@pytest.mark.asyncio
async def test_skill_download_returns_413_for_large_archives(client, tmp_path, monkeypatch):
    from backend.config.settings import settings

    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    access = await sso_login(
        client,
        email="download-large-archive@example.com",
        username="downloadlargearchive",
        enterprise_id="test-ent",
        team_id="test-team",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {access}"}
    skill_id = await _create_uploaded_skill(
        client,
        headers,
        "skilldl4",
        extra_files={"data.txt": bytes(range(256)) * 16},
    )
    original_limit = settings.SKILL_DOWNLOAD_MAX_ARCHIVE_BYTES
    settings.SKILL_DOWNLOAD_MAX_ARCHIVE_BYTES = 128
    try:
        response = await client.post(
            "/api/v1/skills/download",
            json={"skill_uuid": skill_id, "version": "1.0.0"},
            headers=headers,
        )
    finally:
        settings.SKILL_DOWNLOAD_MAX_ARCHIVE_BYTES = original_limit

    assert response.status_code == 413
    payload = response.json()
    assert payload["detail"].startswith("Download too large")
    assert payload["code"] == "HTTP_ERROR"


@pytest.mark.asyncio
async def test_skill_download_applies_download_specific_rate_limit(client, tmp_path, monkeypatch):
    from backend.api.v1 import skills as skills_api
    from backend.config.settings import settings

    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    access = await sso_login(
        client,
        email="download-rate-limit@example.com",
        username="downloadratelimit",
        enterprise_id="test-ent",
        team_id="test-team",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {access}"}
    skill_id = await _create_uploaded_skill(client, headers, "skilldl5")

    original_requests = settings.SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS
    original_window = settings.SKILL_DOWNLOAD_RATE_LIMIT_WINDOW
    settings.SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS = 1
    settings.SKILL_DOWNLOAD_RATE_LIMIT_WINDOW = 60
    skills_api._download_rate_limit_state.clear()
    try:
        first = await client.post(
            "/api/v1/skills/download",
            json={"skill_uuid": skill_id, "version": "1.0.0"},
            headers=headers,
        )
        second = await client.post(
            "/api/v1/skills/download",
            json={"skill_uuid": skill_id, "version": "1.0.0"},
            headers=headers,
        )
    finally:
        settings.SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS = original_requests
        settings.SKILL_DOWNLOAD_RATE_LIMIT_WINDOW = original_window
        skills_api._download_rate_limit_state.clear()

    assert first.status_code == 200
    assert second.status_code == 429
    payload = second.json()
    assert payload["code"] == "RATE_LIMIT_EXCEEDED"
    assert payload["detail"] == "Too many download requests. Please try again later."
