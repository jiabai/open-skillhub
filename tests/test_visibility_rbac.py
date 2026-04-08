import pytest
from sso_helpers import sso_login
from unittest.mock import MagicMock

from backend.core.security.rbac import is_skill_visible
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
