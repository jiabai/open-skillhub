from pydantic import BaseModel


class RuntimeCapabilities(BaseModel):
    skill_visibility: bool
    public_skills: bool
    org_model: bool
    public_signup: bool
    email_otp_login: bool
    sso: bool
    ldap: bool
    audit_log: bool
    audit_export: bool
    rbac: bool
    no_rbac_mode: bool
    desktop_release_url: str


class RuntimeConfigResponse(BaseModel):
    capabilities: RuntimeCapabilities
