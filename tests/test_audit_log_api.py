import os
import io
import zipfile

import pytest
from sso_helpers import sso_login


@pytest.mark.asyncio
async def test_audit_log_query_and_export(client):
    token = await sso_login(
        client,
        email="audit@example.com",
        username="auditor",
        enterprise_id="ent-audit",
        team_id="team-audit",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {token}"}
    create_response = await client.post(
        "/api/v1/skills",
        json={"name": "audit-skill", "description": "desc", "visibility": "private"},
        headers=headers,
    )
    assert create_response.status_code == 201
    skill_id = create_response.json()["id"]
    first = io.BytesIO()
    with zipfile.ZipFile(first, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: audit-skill\ndescription: desc\nversion: 1.0.0\n---\nfirst")
    first.seek(0)
    upload_first = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", first.read(), "application/zip")},
        headers=headers,
    )
    assert upload_first.status_code == 201
    second = io.BytesIO()
    with zipfile.ZipFile(second, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("SKILL.md", "---\nname: audit-skill\ndescription: desc\nversion: 1.1.0\n---\nsecond")
    second.seek(0)
    upload_second = await client.post(
        "/api/v1/skills/upload",
        data={"skill_uuid": skill_id},
        files={"file": ("skill.zip", second.read(), "application/zip")},
        headers=headers,
    )
    assert upload_second.status_code == 201
    rollback = await client.post(f"/api/v1/skills/{skill_id}/versions/1.0.0/rollback", headers=headers)
    assert rollback.status_code == 200
    download = await client.post(
        "/api/v1/skills/download",
        json={"skill_uuid": skill_id, "version": "1.0.0"},
        headers=headers,
    )
    assert download.status_code == 200

    logs_response = await client.get("/api/v1/audit/logs", headers=headers)
    assert logs_response.status_code == 200
    items = logs_response.json()["items"]
    assert any(item["action"] == "auth.sso.login" for item in items)
    assert any(item["action"] == "skill.create" for item in items)
    assert any(item["action"] == "skill.upload" for item in items)
    assert any(item["action"] == "skill.rollback" for item in items)
    assert any(item["action"] == "skill.download" for item in items)

    export_response = await client.post(
        "/api/v1/audit/logs/export",
        json={"format": "json", "filters": {}},
        headers=headers,
    )
    assert export_response.status_code == 200
    payload = export_response.json()
    assert payload["format"] == "json"
    assert "content" in payload
    logs_after_export = await client.get("/api/v1/audit/logs", headers=headers)
    assert logs_after_export.status_code == 200
    assert any(item["action"] == "audit.export" for item in logs_after_export.json()["items"])


@pytest.mark.asyncio
async def test_audit_log_query_rejects_invalid_start_time(client):
    token = await sso_login(
        client,
        email="audit-invalid-query@example.com",
        username="audit-invalid-query",
        enterprise_id="ent-audit-invalid-query",
        team_id="team-audit-invalid-query",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get(
        "/api/v1/audit/logs",
        params={"start": "2024-13-45T99:99:99"},
        headers=headers,
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["detail"] == "Invalid time format for 'start'"
    assert payload["code"] == "BAD_REQUEST"


@pytest.mark.asyncio
async def test_audit_log_export_rejects_invalid_end_time(client):
    token = await sso_login(
        client,
        email="audit-invalid-export@example.com",
        username="audit-invalid-export",
        enterprise_id="ent-audit-invalid-export",
        team_id="team-audit-invalid-export",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post(
        "/api/v1/audit/logs/export",
        json={"format": "json", "filters": {"end": "2024-13-45T99:99:99"}},
        headers=headers,
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["detail"] == "Invalid time format for 'end'"
    assert payload["code"] == "BAD_REQUEST"
