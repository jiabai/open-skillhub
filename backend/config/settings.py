from pathlib import Path
from typing import Any, List, cast
import json

from backend.domain.user_status import DEFAULT_USER_STATUS
from pydantic import ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


def _strip_str(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    return value.strip()


def _parse_json_collection(raw: str) -> Any | None:
    try:
        return json.loads(raw)
    except Exception:
        return None


def _parse_string_list(value: Any) -> list[str] | Any:
    raw = _strip_str(value)
    if raw is None:
        return value
    if raw.startswith("[") and raw.endswith("]"):
        parsed = _parse_json_collection(raw)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    return [item.strip() for item in raw.split(",") if item.strip()]


def _parse_int_list(value: Any, default: list[int]) -> list[int]:
    raw = _strip_str(value)
    if raw is not None:
        if raw.startswith("[") and raw.endswith("]"):
            parsed = _parse_json_collection(raw)
            if isinstance(parsed, list):
                return [int(item) for item in parsed]
        return [int(item.strip()) for item in raw.split(",") if item.strip()]
    if isinstance(value, list):
        return [int(item) for item in value]
    return default


def _parse_json_dict(value: Any, default: dict | None = None) -> dict:
    raw = _strip_str(value)
    if raw is not None and raw:
        parsed = _parse_json_collection(raw)
        if isinstance(parsed, dict):
            return parsed
    if isinstance(value, dict):
        return value
    return {} if default is None else default


def _parse_string_set(value: Any) -> set[str]:
    raw = _strip_str(value)
    if raw is not None:
        if raw.startswith("[") and raw.endswith("]"):
            parsed = _parse_json_collection(raw)
            return set(parsed) if isinstance(parsed, list) else set()
        return {item.strip() for item in raw.split(",") if item.strip()}
    return set(value) if isinstance(value, (list, set)) else set()


class Settings(BaseSettings):
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_POOL_RECYCLE: int = 1800

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DEBUG: bool = False
    CORS_ORIGINS: List[str] = []

    TIMEZONE: str = "UTC"

    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_FILE: str = ""

    SKILL_STORAGE_PATH: str = "/data/skills"
    SKILL_ARCHIVE_BACKEND: str = "local"
    SKILL_ARCHIVE_S3_BUCKET: str = ""
    SKILL_ARCHIVE_S3_REGION: str = ""
    SKILL_ARCHIVE_S3_ENDPOINT: str = ""
    SKILL_ARCHIVE_S3_ACCESS_KEY_ID: str = ""
    SKILL_ARCHIVE_S3_SECRET_ACCESS_KEY: str = ""
    SKILL_ARCHIVE_S3_FORCE_PATH_STYLE: bool = True
    SKILL_DOWNLOAD_TTL_SECONDS: int = 3600
    SKILL_CACHE_TTL_SECONDS: int = 604800
    SKILL_DOWNLOAD_MAX_REQUEST_BYTES: int = 16 * 1024
    SKILL_DOWNLOAD_MAX_ARCHIVE_BYTES: int = 50 * 1024 * 1024
    SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS: int = 10
    SKILL_DOWNLOAD_RATE_LIMIT_WINDOW: int = 60
    SKILL_VERSION_BUMP_STRATEGY: str = "patch"
    SKILL_EXECUTION_TIMEOUT_SECONDS: int = 300
    SKILL_MAX_CONCURRENT_EXECUTIONS_PER_USER: int = 4
    SKILL_MAX_CONCURRENT_EXECUTIONS_PER_TEAM: int = 16
    SKILL_MAX_WORKDIR_BYTES: int = 1073741824
    SKILL_MAX_OUTPUT_BYTES: int = 1048576

    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60

    METRICS_RETENTION_DAYS: int = 90

    FLOW_LLM_API_KEY: str = ""
    FLOW_LLM_BASE_URL: str = ""

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    ALIYUN_DM_ACCESS_KEY_ID: str = ""
    ALIYUN_DM_ACCESS_KEY_SECRET: str = ""
    ALIYUN_DM_ACCOUNT_NAME: str = ""
    ALIYUN_DM_FROM_ALIAS: str = ""
    ALIYUN_DM_REPLY_TO_ADDRESS: bool = True
    ALIYUN_DM_ENDPOINT: str = "https://dm.aliyuncs.com/"
    ENABLE_PUBLIC_SIGNUP: bool = True
    ENABLE_EMAIL_OTP_LOGIN: bool = True
    ENABLE_SSO: bool = False
    ENABLE_LDAP: bool = False
    ENABLE_ORG_MODEL: bool = False
    ENABLE_RBAC: bool = False
    ENABLE_SKILL_VISIBILITY: bool = False
    ENABLE_AUDIT_LOG: bool = False
    ENABLE_AUDIT_EXPORT: bool = False
    ENABLE_SKILL_DOWNLOAD_ENCRYPTION: bool = True
    ENABLE_LOCAL_CACHE_ENCRYPTION: bool = True
    ENABLE_CACHE_OFFLINE_FALLBACK: bool = True
    ENABLE_SANDBOX_EXECUTION: bool = False
    ENABLE_RESOURCE_QUOTA: bool = False
    ENABLE_NETWORK_EGRESS_CONTROL: bool = True
    ENABLE_RATE_LIMIT: bool = True
    ENABLE_METRICS: bool = True
    ENABLE_DEPRECATION_HEADERS: bool = True
    ENABLE_DEPRECATION_NOTIFIER_ON_STARTUP: bool = False

    DESKTOP_RELEASE_URL: str = "https://github.com/jiabai/skilldrive/releases"
    DESKTOP_RELEASE_VERSION: str = ""

    DEPRECATED_ENDPOINTS: dict = {}
    DEPRECATED_VERSIONS: set = set()
    DEPRECATED_VERSION_SUNSET_DATE: str = ""
    DEPRECATION_NOTIFY_OFFSETS_DAYS: List[int] = [90, 30, 7]

    DEFAULT_SKILL_VISIBILITY: str = "private"
    DEFAULT_ROLE: str = "member"
    DEFAULT_USER_STATUS: str = DEFAULT_USER_STATUS
    RBAC_ROLE_PERMISSIONS: dict = {}
    SSO_ISSUER: str = ""
    SSO_CLIENT_ID: str = ""
    SSO_CLIENT_SECRET: str = ""
    SSO_AUTHORIZATION_ENDPOINT: str = ""
    SSO_TOKEN_ENDPOINT: str = ""
    SSO_JWKS_URI: str = ""
    SSO_REDIRECT_URI: str = ""
    SSO_FRONTEND_CALLBACK_URL: str = ""
    SSO_SCOPES: List[str] = ["openid", "email", "profile"]
    SSO_HTTP_TIMEOUT_SECONDS: int = 10
    SSO_JWT_SECRET: str = ""
    SSO_JWT_ISSUER: str = ""
    SSO_JWT_AUDIENCE: str = ""
    SSO_JWT_ALGORITHM: str = "HS256"
    SSO_NONCE_EXPIRE_SECONDS: int = 300
    SSO_IAT_FUTURE_SKEW_SECONDS: int = 60
    SSO_EMAIL_CLAIM: str = "email"
    SSO_USERNAME_CLAIM: str = "username"
    SSO_ENTERPRISE_CLAIM: str = "enterprise_id"
    SSO_TEAM_CLAIM: str = "team_id"
    SSO_ROLE_CLAIM: str = "role"
    SSO_STATUS_CLAIM: str = "status"
    LDAP_URL: str = ""
    LDAP_USER_DN_TEMPLATE: str = ""
    LDAP_SEARCH_BASE: str = ""
    LDAP_SEARCH_FILTER: str = "(uid={username})"
    LDAP_EMAIL_ATTR: str = "mail"
    LDAP_USERNAME_ATTR: str = "uid"
    LDAP_ENTERPRISE_ATTR: str = "enterprise_id"
    LDAP_TEAM_ATTR: str = "team_id"
    LDAP_ROLE_ATTR: str = "role"
    LDAP_STATUS_ATTR: str = "status"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        return _parse_string_list(v)

    @field_validator("SSO_SCOPES", mode="before")
    @classmethod
    def parse_sso_scopes(cls, v):
        return _parse_string_list(v)

    @model_validator(mode="after")
    def validate_cors_origins(self):
        if not self.DEBUG and (not self.CORS_ORIGINS or "*" in self.CORS_ORIGINS):
            raise ValueError("CORS_ORIGINS must be explicitly configured and cannot contain '*' in production")
        return self

    @field_validator("RBAC_ROLE_PERMISSIONS", mode="before")
    @classmethod
    def parse_role_permissions(cls, v):
        return _parse_json_dict(v, default=v if isinstance(v, dict) else {})

    @field_validator("DEPRECATED_ENDPOINTS", mode="before")
    @classmethod
    def parse_deprecated_endpoints(cls, v):
        return _parse_json_dict(v)

    @field_validator("DEPRECATED_VERSIONS", mode="before")
    @classmethod
    def parse_deprecated_versions(cls, v):
        return _parse_string_set(v)

    @field_validator("DEPRECATION_NOTIFY_OFFSETS_DAYS", mode="before")
    @classmethod
    def parse_deprecation_notify_offsets_days(cls, v):
        return _parse_int_list(v, [90, 30, 7])

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v):
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v

    @field_validator("DATABASE_POOL_SIZE", "DATABASE_MAX_OVERFLOW")
    @classmethod
    def validate_pool_settings(cls, v, info: ValidationInfo):
        field_name = info.field_name
        if v < 1:
            raise ValueError(f"{field_name} must be at least 1")
        if v > 100:
            raise ValueError(f"{field_name} cannot be greater than 100")
        return v

    @field_validator("DATABASE_POOL_TIMEOUT", "DATABASE_POOL_RECYCLE")
    @classmethod
    def validate_timeout_settings(cls, v, info: ValidationInfo):
        field_name = info.field_name
        if v < 1:
            raise ValueError(f"{field_name} must be at least 1 second")
        if v > 3600:
            raise ValueError(f"{field_name} cannot be greater than 3600 seconds")
        return v

    @field_validator("METRICS_RETENTION_DAYS")
    @classmethod
    def validate_metrics_retention_days(cls, v):
        if v < 1:
            raise ValueError("METRICS_RETENTION_DAYS must be at least 1 day")
        if v > 3650:
            raise ValueError("METRICS_RETENTION_DAYS cannot be greater than 3650 days")
        return v

    @field_validator("SKILL_VERSION_BUMP_STRATEGY")
    @classmethod
    def validate_skill_version_bump_strategy(cls, v):
        value = str(v).strip().lower()
        if value not in {"patch", "minor"}:
            raise ValueError("SKILL_VERSION_BUMP_STRATEGY must be either 'patch' or 'minor'")
        return value

    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), case_sensitive=True)


settings = cast(Any, Settings)()
