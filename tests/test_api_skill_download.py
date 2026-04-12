import base64
import hashlib
import io
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sso_helpers import create_api_token, sso_login

from backend.config.settings import settings
from backend.core.security.user_state import UserStatus
from backend.core.utils.skill_storage import SYSTEM_USER_ID, create_skill_dir, get_skill_versions_dir
from backend.models.skill import Skill
from backend.models.skill_version import SkillVersion
from backend.models.user import User


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


async def _create_public_skill(async_session, name: str = "public-download-skill") -> Skill:
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
            ),
            SkillVersion(
                skill_id=public_skill.id,
                version="1.2.4",
                description="Public download skill",
                dependencies=[],
            ),
        ]
    )
    await async_session.commit()
    await async_session.refresh(public_skill)
    return public_skill


def _decode_download_archive(payload: dict) -> dict[str, str]:
    archive_bytes = base64.b64decode(payload["encrypted_code"])
    with zipfile.ZipFile(io.BytesIO(archive_bytes), "r") as archive:
        return {
            name: archive.read(name).decode("utf-8", errors="replace")
            for name in archive.namelist()
        }


async def _login_with_client_token(
    client,
    *,
    email: str,
    username: str,
    enterprise_id: str = "test-ent",
    team_id: str = "test-team",
    role: str = "admin",
) -> tuple[dict[str, str], dict[str, str]]:
    access = await sso_login(
        client,
        email=email,
        username=username,
        enterprise_id=enterprise_id,
        team_id=team_id,
        role=role,
    )
    api_token = await create_api_token(client, access, name=f"{username}-client")
    return (
        {"Authorization": f"Bearer {access}"},
        {"Authorization": f"Bearer {api_token}"},
    )


@pytest.mark.asyncio
async def test_skill_download_returns_encrypted_payload(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    headers, api_headers = await _login_with_client_token(
        client,
        email="download@example.com",
        username="downloader",
    )
    skill_id = await _create_uploaded_skill(
        client,
        headers,
        "skilldl",
        extra_files={"reference.md": "hello"},
    )
    response = await client.post(
        "/api/v1/client/skills/download",
        json={"skill_uuid": skill_id, "version": "1.0.0"},
        headers=api_headers,
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
    headers, api_headers = await _login_with_client_token(
        client,
        email="nodownload@example.com",
        username="nodownloader",
        role="member",
    )
    skill_id = await _create_uploaded_skill(client, headers, "skilldl2")
    response = await client.post(
        "/api/v1/client/skills/download",
        json={"skill_uuid": skill_id, "version": "1.0.0"},
        headers=api_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_skill_download_returns_gone_for_deactivated_skill(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    headers, api_headers = await _login_with_client_token(
        client,
        email="download-deactivated@example.com",
        username="downloaddeactivated",
    )
    skill_id = await _create_uploaded_skill(client, headers, "skilldl3")
    deactivate_response = await client.post(
        f"/api/v1/skills/{skill_id}/deactivate",
        headers=headers,
    )
    assert deactivate_response.status_code == 200

    response = await client.post(
        "/api/v1/client/skills/download",
        json={"skill_uuid": skill_id, "version": "1.0.0"},
        headers=api_headers,
    )

    assert response.status_code == 410
    payload = response.json()
    assert payload["code"] == "SKILL_DEACTIVATED"
    assert payload["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_skill_download_returns_safe_500_for_unexpected_error(client, tmp_path, monkeypatch):
    from backend.services.skill import SkillService

    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    headers, api_headers = await _login_with_client_token(
        client,
        email="download-failure@example.com",
        username="downloadfailure",
    )

    async def broken_download_skill(self, user, skill_uuid, version=None):
        raise RuntimeError("database offline")

    monkeypatch.setattr(SkillService, "download_skill", broken_download_skill)

    response = await client.post(
        "/api/v1/client/skills/download",
        json={"skill_uuid": "00000000-0000-0000-0000-000000000000", "version": "1.0.0"},
        headers=api_headers,
    )

    assert response.status_code == 500
    payload = response.json()
    assert payload["detail"] == "Download failed"
    assert payload["code"] == "HTTP_ERROR"
    assert payload["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_skill_download_rejects_invalid_uuid(client):
    _, api_headers = await _login_with_client_token(
        client,
        email="download-invalid-uuid@example.com",
        username="downloadinvaliduuid",
    )

    response = await client.post(
        "/api/v1/client/skills/download",
        json={"skill_uuid": "not-a-valid-uuid", "version": "1.0.0"},
        headers=api_headers,
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["code"] == "VALIDATION_ERROR"
    assert payload["timestamp"].endswith("Z")


@pytest.mark.asyncio
async def test_skill_download_rejects_oversized_request_body(client):
    from backend.config.settings import settings

    _, api_headers = await _login_with_client_token(
        client,
        email="download-large-request@example.com",
        username="downloadlargerequest",
    )
    original_limit = settings.SKILL_DOWNLOAD_MAX_REQUEST_BYTES
    settings.SKILL_DOWNLOAD_MAX_REQUEST_BYTES = 64
    try:
        response = await client.post(
            "/api/v1/client/skills/download",
            json={"skill_uuid": "00000000-0000-0000-0000-000000000000", "version": "v" * 256},
            headers=api_headers,
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
    headers, api_headers = await _login_with_client_token(
        client,
        email="download-large-archive@example.com",
        username="downloadlargearchive",
    )
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
            "/api/v1/client/skills/download",
            json={"skill_uuid": skill_id, "version": "1.0.0"},
            headers=api_headers,
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
    headers, api_headers = await _login_with_client_token(
        client,
        email="download-rate-limit@example.com",
        username="downloadratelimit",
    )
    skill_id = await _create_uploaded_skill(client, headers, "skilldl5")

    original_requests = settings.SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS
    original_window = settings.SKILL_DOWNLOAD_RATE_LIMIT_WINDOW
    settings.SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS = 1
    settings.SKILL_DOWNLOAD_RATE_LIMIT_WINDOW = 60
    skills_api._download_rate_limit_state.clear()
    try:
        first = await client.post(
            "/api/v1/client/skills/download",
            json={"skill_uuid": skill_id, "version": "1.0.0"},
            headers=api_headers,
        )
        second = await client.post(
            "/api/v1/client/skills/download",
            json={"skill_uuid": skill_id, "version": "1.0.0"},
            headers=api_headers,
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


@pytest.mark.asyncio
async def test_public_skill_download_requires_reference_or_clone_when_rbac_disabled(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    original_encryption = settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION
    settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION = False
    try:
        public_skill = await _create_public_skill(async_session)
        _, api_headers = await _login_with_client_token(
            client,
            email="public-download@example.com",
            username="publicdownloaduser",
            role="member",
        )

        response = await client.post(
            "/api/v1/client/skills/download",
            json={"skill_uuid": public_skill.id},
            headers=api_headers,
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "Permission denied"
    finally:
        settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION = original_encryption


@pytest.mark.asyncio
async def test_reference_skill_download_uses_pinned_public_version_when_owned_and_rbac_disabled(client, async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    original_encryption = settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION
    settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION = False
    try:
        public_skill = await _create_public_skill(async_session, name="public-download-reference-skill")
        headers, api_headers = await _login_with_client_token(
            client,
            email="reference-download@example.com",
            username="referencedownloaduser",
            role="member",
        )

        created = await client.post(
            f"/api/v1/skills/{public_skill.id}/reference",
            json={"name": "public-download-reference", "pinned_version": "1.2.3"},
            headers=headers,
        )
        assert created.status_code == 201
        reference_id = created.json()["id"]

        response = await client.post(
            "/api/v1/client/skills/download",
            json={"skill_uuid": reference_id},
            headers=api_headers,
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["skill_uuid"] == reference_id
        assert payload["version"] == "1.2.3"

        files = _decode_download_archive(payload)
        assert files["reference.md"] == "public reference v123"
        assert "version: 1.2.3" in files["SKILL.md"]
        assert "1.2.4" not in files["SKILL.md"]
    finally:
        settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION = original_encryption


@pytest.mark.asyncio
async def test_owned_private_skill_download_allowed_when_rbac_disabled(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    headers, api_headers = await _login_with_client_token(
        client,
        email="private-download@example.com",
        username="privatedownloaduser",
        role="member",
    )
    skill_id = await _create_uploaded_skill(
        client,
        headers,
        "skilldl-private",
        extra_files={"reference.md": "owned private content"},
    )

    response = await client.post(
        "/api/v1/client/skills/download",
        json={"skill_uuid": skill_id, "version": "1.0.0"},
        headers=api_headers,
    )

    assert response.status_code == 200
