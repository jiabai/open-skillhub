import pytest

from backend.config.settings import settings


RUNTIME_FLAG_NAMES = (
    "ENABLE_RBAC",
    "ENABLE_SKILL_VISIBILITY",
    "ENABLE_ORG_MODEL",
    "ENABLE_PUBLIC_SIGNUP",
    "ENABLE_EMAIL_OTP_LOGIN",
    "ENABLE_SSO",
    "ENABLE_LDAP",
    "ENABLE_AUDIT_LOG",
    "ENABLE_AUDIT_EXPORT",
)


def set_runtime_flags(monkeypatch, **enabled_flags):
    for flag_name in RUNTIME_FLAG_NAMES:
        monkeypatch.setattr(settings, flag_name, bool(enabled_flags.get(flag_name, False)))


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
            "desktop_release_url": settings.DESKTOP_RELEASE_URL,
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


@pytest.mark.asyncio
async def test_runtime_config_api_keeps_no_rbac_mode_when_feature_flags_disabled(client, monkeypatch):
    set_runtime_flags(monkeypatch)

    response = await client.get("/api/v1/runtime-config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["capabilities"] == {
        "skill_visibility": False,
        "public_skills": False,
        "org_model": False,
        "public_signup": False,
        "email_otp_login": False,
        "sso": False,
        "ldap": False,
        "audit_log": False,
        "audit_export": False,
        "rbac": False,
        "no_rbac_mode": True,
        "desktop_release_url": settings.DESKTOP_RELEASE_URL,
    }


@pytest.mark.asyncio
async def test_runtime_config_api_public_skills_requires_visibility_without_rbac(client, monkeypatch):
    set_runtime_flags(monkeypatch, ENABLE_RBAC=False, ENABLE_SKILL_VISIBILITY=False)

    response = await client.get("/api/v1/runtime-config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["capabilities"]["skill_visibility"] is False
    assert payload["capabilities"]["public_skills"] is False
    assert payload["capabilities"]["no_rbac_mode"] is True


@pytest.mark.asyncio
async def test_runtime_config_api_disables_audit_export_when_export_flag_disabled(client, monkeypatch):
    set_runtime_flags(monkeypatch, ENABLE_AUDIT_LOG=True, ENABLE_AUDIT_EXPORT=False)

    response = await client.get("/api/v1/runtime-config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["capabilities"]["audit_log"] is True
    assert payload["capabilities"]["audit_export"] is False


@pytest.mark.parametrize(
    ("setting_name", "capability_name"),
    [
        ("ENABLE_SKILL_VISIBILITY", "skill_visibility"),
        ("ENABLE_ORG_MODEL", "org_model"),
        ("ENABLE_PUBLIC_SIGNUP", "public_signup"),
        ("ENABLE_EMAIL_OTP_LOGIN", "email_otp_login"),
        ("ENABLE_SSO", "sso"),
        ("ENABLE_LDAP", "ldap"),
        ("ENABLE_AUDIT_LOG", "audit_log"),
        ("ENABLE_RBAC", "rbac"),
    ],
)
@pytest.mark.asyncio
async def test_runtime_config_api_reflects_direct_feature_flags(client, monkeypatch, setting_name, capability_name):
    set_runtime_flags(monkeypatch, **{setting_name: True})

    response = await client.get("/api/v1/runtime-config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["capabilities"][capability_name] is True
