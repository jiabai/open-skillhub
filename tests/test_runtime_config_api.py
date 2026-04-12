import pytest

from backend.config.settings import settings


@pytest.mark.asyncio
async def test_runtime_config_api_reflects_derived_capabilities(client, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_RBAC", True)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)
    monkeypatch.setattr(settings, "ENABLE_ORG_MODEL", True)
    monkeypatch.setattr(settings, "ENABLE_PUBLIC_SIGNUP", False)
    monkeypatch.setattr(settings, "ENABLE_EMAIL_OTP_LOGIN", True)
    monkeypatch.setattr(settings, "ENABLE_SSO", True)
    monkeypatch.setattr(settings, "ENABLE_LDAP", False)
    monkeypatch.setattr(settings, "ENABLE_AUDIT_LOG", True)
    monkeypatch.setattr(settings, "ENABLE_AUDIT_EXPORT", True)

    response = await client.get("/api/v1/runtime-config")

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "capabilities": {
            "skill_visibility": True,
            "public_skills": False,
            "org_model": True,
            "public_signup": False,
            "email_otp_login": True,
            "sso": True,
            "ldap": False,
            "audit_log": True,
            "audit_export": True,
            "rbac": True,
            "no_rbac_mode": False,
        }
    }


@pytest.mark.asyncio
async def test_runtime_config_api_disables_public_skills_in_rbac_mode(client, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_RBAC", True)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)

    response = await client.get("/api/v1/runtime-config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["capabilities"]["skill_visibility"] is True
    assert payload["capabilities"]["public_skills"] is False


@pytest.mark.asyncio
async def test_runtime_config_api_enables_public_skills_only_without_rbac(client, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_RBAC", False)
    monkeypatch.setattr(settings, "ENABLE_SKILL_VISIBILITY", True)

    response = await client.get("/api/v1/runtime-config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["capabilities"]["skill_visibility"] is True
    assert payload["capabilities"]["public_skills"] is True
    assert payload["capabilities"]["rbac"] is False
    assert payload["capabilities"]["no_rbac_mode"] is True


@pytest.mark.asyncio
async def test_runtime_config_api_disables_audit_export_without_audit_log(client, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_AUDIT_LOG", False)
    monkeypatch.setattr(settings, "ENABLE_AUDIT_EXPORT", True)

    response = await client.get("/api/v1/runtime-config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["capabilities"]["audit_log"] is False
    assert payload["capabilities"]["audit_export"] is False
