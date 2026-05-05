import io
import zipfile

import pytest
from sso_helpers import create_api_token, sso_login

from backend.config.settings import settings


def _skill_zip_bytes(name: str, version: str = "1.0.0") -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "SKILL.md",
            f"---\nname: {name}\ndescription: Boundary test skill\nversion: {version}\n---\nbody",
        )
    return buffer.getvalue()


async def _login_with_client_token(client, *, email: str, username: str) -> tuple[str, str]:
    access_token = await sso_login(
        client,
        email=email,
        username=username,
        enterprise_id="boundary-ent",
        team_id="boundary-team",
        role="admin",
    )
    api_token = await create_api_token(client, access_token, name=f"{username}-client")
    return access_token, api_token


async def _create_skill_with_version(client, headers: dict[str, str], name: str) -> str:
    created = await client.post(
        "/api/v1/skills",
        json={"name": name, "description": "Boundary test skill"},
        headers=headers,
    )
    assert created.status_code == 201
    skill_id = created.json()["id"]

    uploaded = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", _skill_zip_bytes(name), "application/zip")},
        headers=headers,
    )
    assert uploaded.status_code == 201
    return skill_id


@pytest.mark.asyncio
async def test_console_skill_routes_accept_jwt_and_reject_api_tokens(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    access_token, api_token = await _login_with_client_token(
        client,
        email="console-boundary@example.com",
        username="consoleboundary",
    )
    jwt_headers = {"Authorization": f"Bearer {access_token}"}
    api_headers = {"Authorization": f"Bearer {api_token}"}
    skill_id = await _create_skill_with_version(client, jwt_headers, "console-boundary-skill")

    console_paths = [
        "/api/v1/skills",
        f"/api/v1/skills/{skill_id}",
        f"/api/v1/skills/{skill_id}/versions",
        f"/api/v1/skills/{skill_id}/versions/1.0.0",
        f"/api/v1/skills/{skill_id}/versions/1.0.0/install-instructions",
        f"/api/v1/skills/{skill_id}/files",
    ]

    for path in console_paths:
        jwt_response = await client.get(path, headers=jwt_headers)
        assert jwt_response.status_code == 200, path

        api_token_response = await client.get(path, headers=api_headers)
        assert api_token_response.status_code == 401, path


@pytest.mark.asyncio
async def test_client_skill_routes_accept_api_tokens_and_reject_jwt(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "SKILL_STORAGE_PATH", str(tmp_path))
    access_token, api_token = await _login_with_client_token(
        client,
        email="client-boundary@example.com",
        username="clientboundary",
    )
    jwt_headers = {"Authorization": f"Bearer {access_token}"}
    api_headers = {"Authorization": f"Bearer {api_token}"}
    skill_id = await _create_skill_with_version(client, jwt_headers, "client-boundary-skill")

    list_with_jwt = await client.get("/api/v1/client/skills", headers=jwt_headers)
    assert list_with_jwt.status_code == 401

    list_with_api_token = await client.get("/api/v1/client/skills", headers=api_headers)
    assert list_with_api_token.status_code == 200

    download_payload = {"skill_uuid": skill_id, "version": "1.0.0"}
    download_with_jwt = await client.post(
        "/api/v1/client/skills/download",
        json=download_payload,
        headers=jwt_headers,
    )
    assert download_with_jwt.status_code == 401

    download_with_api_token = await client.post(
        "/api/v1/client/skills/download",
        json=download_payload,
        headers=api_headers,
    )
    assert download_with_api_token.status_code == 200
