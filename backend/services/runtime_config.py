from backend.config.settings import settings
from backend.schemas.runtime_config import RuntimeCapabilities, RuntimeConfigResponse


class RuntimeConfigService:
    @staticmethod
    def build_capabilities() -> RuntimeCapabilities:
        audit_log = bool(settings.ENABLE_AUDIT_LOG)
        rbac = bool(settings.ENABLE_RBAC)
        skill_visibility = bool(settings.ENABLE_SKILL_VISIBILITY)
        return RuntimeCapabilities(
            skill_visibility=skill_visibility,
            public_skills=skill_visibility and not rbac,
            org_model=bool(settings.ENABLE_ORG_MODEL),
            public_signup=bool(settings.ENABLE_PUBLIC_SIGNUP),
            email_otp_login=bool(settings.ENABLE_EMAIL_OTP_LOGIN),
            sso=bool(settings.ENABLE_SSO),
            ldap=bool(settings.ENABLE_LDAP),
            audit_log=audit_log,
            audit_export=audit_log and bool(settings.ENABLE_AUDIT_EXPORT),
            rbac=rbac,
            no_rbac_mode=not rbac,
            desktop_release_url=settings.DESKTOP_RELEASE_URL,
        )

    @classmethod
    def build_response(cls) -> RuntimeConfigResponse:
        return RuntimeConfigResponse(capabilities=cls.build_capabilities())
