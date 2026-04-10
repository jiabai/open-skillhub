import pytest
from sso_helpers import sso_login
from sqlalchemy import select
from unittest.mock import MagicMock

from backend.config.settings import settings
from backend.core.security.rbac import is_skill_visible
from backend.core.utils.skill_storage import create_skill_dir
from backend.models.skill import Skill
from backend.models.user import User
from backend.services.skill import SkillService


@pytest.mark.asyncio
async def test_skill_visibility_filters_list(client):
    token_owner = await sso_login(client, email="owner@example.com", username="owner", enterprise_id="ent-1", team_id="team-1", role="member")
    token_peer = await sso_login(client, email="peer@example.com", username="peer", enterprise_id="ent-1", team_id="team-1", role="member")
    token_other = await sso_login(client, email="other@example.com", username="other", enterprise_id="ent-1", team_id="team-2", role="member")

    headers_owner = {"Authorization": f"Bearer {token_owner}"}
    await client.post(
        "/api/v1/skills",
        json={"name": "enterprise-skill", "description": "desc", "visibility": "enterprise"},
        headers=headers_owner,
    )
    await client.post(
        "/api/v1/skills",
        json={"name": "team-skill", "description": "desc", "visibility": "team"},
        headers=headers_owner,
    )
    await client.post(
        "/api/v1/skills",
        json={"name": "private-skill", "description": "desc", "visibility": "private"},
        headers=headers_owner,
    )

    peer_response = await client.get("/api/v1/skills", headers={"Authorization": f"Bearer {token_peer}"})
    assert peer_response.status_code == 200
    peer_names = {item["name"] for item in peer_response.json()["items"]}
    assert "enterprise-skill" in peer_names
    assert "team-skill" in peer_names
    assert "private-skill" not in peer_names

    other_response = await client.get("/api/v1/skills", headers={"Authorization": f"Bearer {token_other}"})
    assert other_response.status_code == 200
    other_names = {item["name"] for item in other_response.json()["items"]}
    assert "enterprise-skill" in other_names
    assert "team-skill" not in other_names
    assert "private-skill" not in other_names


@pytest.mark.asyncio
async def test_team_visible_skill_files_are_readable_by_peer(client):
    token_owner = await sso_login(client, email="files-owner@example.com", username="files-owner", enterprise_id="ent-1", team_id="team-1", role="member")
    token_peer = await sso_login(client, email="files-peer@example.com", username="files-peer", enterprise_id="ent-1", team_id="team-1", role="member")

    headers_owner = {"Authorization": f"Bearer {token_owner}"}
    created = await client.post(
        "/api/v1/skills",
        json={"name": "team-files-skill", "description": "desc", "visibility": "team"},
        headers=headers_owner,
    )
    assert created.status_code == 201
    skill_id = created.json()["id"]

    uploaded = await client.post(
        "/api/v1/skills/upload",
        headers=headers_owner,
        data={"skill_uuid": skill_id},
        files={"file": ("README.md", b"shared content", "text/markdown")},
    )
    assert uploaded.status_code == 201

    headers_peer = {"Authorization": f"Bearer {token_peer}"}
    listed = await client.get(f"/api/v1/skills/{skill_id}/files", headers=headers_peer)
    assert listed.status_code == 200
    assert "README.md" in listed.json()

    content = await client.get(f"/api/v1/skills/{skill_id}/files/README.md", headers=headers_peer)
    assert content.status_code == 200
    assert content.text == "shared content"


@pytest.mark.asyncio
async def test_list_skills_returns_only_owned_skills_when_visibility_disabled(client, async_session, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)

    token_owner = await sso_login(client, email="solo-owner@example.com", username="solo-owner", role="member")
    token_peer = await sso_login(client, email="solo-peer@example.com", username="solo-peer", role="member")

    headers_owner = {"Authorization": f"Bearer {token_owner}"}
    headers_peer = {"Authorization": f"Bearer {token_peer}"}

    owner_created = await client.post(
        "/api/v1/skills",
        json={"name": "owner-private-skill", "description": "desc", "visibility": "private"},
        headers=headers_owner,
    )
    assert owner_created.status_code == 201

    peer_private_created = await client.post(
        "/api/v1/skills",
        json={"name": "peer-private-skill", "description": "desc", "visibility": "private"},
        headers=headers_peer,
    )
    assert peer_private_created.status_code == 201

    peer_user = (
        await async_session.execute(
            select(User).where(User.email == "solo-peer@example.com")
        )
    ).scalar_one()
    async_session.add(
        Skill(
            user_id=peer_user.id,
            name="peer-public-skill",
            description="desc",
            tags=[],
            visibility="public",
            enterprise_id=peer_user.enterprise_id,
            team_id=peer_user.team_id,
            skill_dir=str(create_skill_dir(peer_user.id, "peer-public-skill")),
            is_active=True,
        )
    )
    await async_session.commit()

    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", False)

    owner_list = await client.get("/api/v1/skills", headers=headers_owner)
    assert owner_list.status_code == 200
    payload = owner_list.json()
    names = {item["name"] for item in payload["items"]}

    assert payload["total"] == 1
    assert names == {"owner-private-skill"}


def test_public_skill_visible_when_rbac_disabled(monkeypatch):
    monkeypatch.setattr("backend.core.security.rbac.settings.ENABLE_SKILL_VISIBILITY", True)
    monkeypatch.setattr("backend.core.security.rbac.settings.ENABLE_RBAC", False)
    user = MagicMock(id="user-1", enterprise_id=None, team_id=None)
    skill = MagicMock(user_id="system-user", visibility="public", enterprise_id=None, team_id=None)
    assert is_skill_visible(user, skill) is True


def test_reference_detection_requires_non_empty_string():
    skill = MagicMock()
    skill.source_skill_id = MagicMock()
    assert SkillService.is_reference_skill(skill) is False
    skill.source_skill_id = ""
    assert SkillService.is_reference_skill(skill) is False
    skill.source_skill_id = "source-id"
    assert SkillService.is_reference_skill(skill) is True
