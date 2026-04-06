import base64
import hashlib
import io
import zipfile
from datetime import datetime, timezone

import pytest
from sso_helpers import sso_login


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
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skilldl", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skilldl\nversion: 1.0.0\n---\nbody")
        archive.writestr("reference.md", "hello")
    buffer.seek(0)
    await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", buffer.read(), "application/zip")},
        headers=headers,
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
    created = await client.post(
        "/api/v1/skills",
        json={"name": "skilldl2", "description": "desc"},
        headers=headers,
    )
    skill_id = created.json()["id"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: skilldl2\nversion: 1.0.0\n---\nbody")
    buffer.seek(0)
    await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", buffer.read(), "application/zip")},
        headers=headers,
    )
    response = await client.post(
        "/api/v1/skills/download",
        json={"skill_uuid": skill_id, "version": "1.0.0"},
        headers=headers,
    )
    assert response.status_code == 403
