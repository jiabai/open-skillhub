from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import secrets

import jwt

from backend.config.settings import settings
from backend.core.security.jwt_utils import create_access_token, create_refresh_token, decode_token
from backend.models.user import User
from backend.repositories.user import UserRepository
from backend.services.sso_replay_guard import SSOReplayGuardService


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str


class _NoopSSOReplayGuard:
    async def consume_nonce(self, _nonce: str) -> None:
        return None

    async def mark_token_used(self, _replay_key: str, _expires_at: datetime) -> None:
        return None


class AuthService:
    def __init__(
        self,
        user_repo: UserRepository,
        sso_replay_guard: SSOReplayGuardService | None = None,
    ):
        self.user_repo = user_repo
        self.sso_replay_guard = sso_replay_guard or _NoopSSOReplayGuard()

    @staticmethod
    def _get_token_version(user: User) -> int:
        return user.jwt_token_version

    async def register(self, email: str, username: str, password: str | None) -> User:
        if await self.user_repo.get_by_email(email):
            raise ValueError("Email already registered")
        if await self.user_repo.get_by_username(username):
            raise ValueError("Username already registered")
        raw_password = password or secrets.token_urlsafe(24)
        return await self.user_repo.create(email=email, username=username, password=raw_password)

    async def login_sso(self, id_token: str, nonce: str | None = None) -> TokenPair:
        payload = jwt.decode(
            id_token,
            settings.SSO_JWT_SECRET,
            algorithms=[settings.SSO_JWT_ALGORITHM],
            audience=settings.SSO_JWT_AUDIENCE or None,
            issuer=settings.SSO_JWT_ISSUER or None,
            options={"require": ["exp", "iat"]},
        )
        token_nonce = str(payload.get("nonce") or "").strip()
        if not token_nonce:
            raise ValueError("SSO_NONCE_MISSING")
        expected_nonce = nonce or token_nonce
        if token_nonce != expected_nonce:
            raise ValueError("SSO_NONCE_INVALID")
        iat = payload.get("iat")
        if iat is None:
            raise ValueError("SSO_TOKEN_MISSING_IAT")
        issued_at = datetime.fromtimestamp(int(iat), tz=timezone.utc)
        now = datetime.now(timezone.utc)
        if issued_at > now.replace(microsecond=0) and (issued_at - now).total_seconds() > settings.SSO_IAT_FUTURE_SKEW_SECONDS:
            raise ValueError("SSO_TOKEN_INVALID_IAT")
        exp = payload.get("exp")
        if exp is None:
            raise ValueError("SSO_TOKEN_MISSING_EXP")
        expires_at = datetime.fromtimestamp(int(exp), tz=timezone.utc)
        await self.sso_replay_guard.consume_nonce(expected_nonce)
        replay_key = str(payload.get("jti") or "").strip() or hashlib.sha256(id_token.encode("utf-8")).hexdigest()
        await self.sso_replay_guard.mark_token_used(replay_key, expires_at)
        email = str(payload.get(settings.SSO_EMAIL_CLAIM) or "").strip()
        username = str(payload.get(settings.SSO_USERNAME_CLAIM) or email.split("@")[0]).strip()
        if not email:
            raise ValueError("Invalid SSO token")
        user = await self.user_repo.get_by_email(email)
        enterprise_id = str(payload.get(settings.SSO_ENTERPRISE_CLAIM) or "").strip() or None
        team_id = str(payload.get(settings.SSO_TEAM_CLAIM) or "").strip() or None
        role = str(payload.get(settings.SSO_ROLE_CLAIM) or settings.DEFAULT_ROLE).strip()
        status = str(payload.get(settings.SSO_STATUS_CLAIM) or settings.DEFAULT_USER_STATUS).strip()
        if not settings.ENABLE_ORG_MODEL:
            enterprise_id = None
            team_id = None
        if not settings.ENABLE_RBAC:
            role = settings.DEFAULT_ROLE
        identity = {
            "enterprise_id": enterprise_id,
            "team_id": team_id,
            "role": role,
            "status": status,
        }
        if not user:
            raw_password = secrets.token_urlsafe(24)
            user = await self.user_repo.create(
                email=email,
                username=username,
                password=raw_password,
                **identity,
            )
        else:
            user = await self.user_repo.update(user, **identity)
        return self.issue_token(user)

    def issue_token(self, user: User) -> TokenPair:
        token_version = self._get_token_version(user)
        return TokenPair(
            access_token=create_access_token(
                subject=str(user.id),
                token_version=token_version,
            ),
            refresh_token=create_refresh_token(
                subject=str(user.id),
                token_version=token_version,
            ),
        )

    async def login_ldap(self, username: str, password: str) -> TokenPair:
        import importlib

        ldap3 = importlib.import_module("ldap3")
        Connection = getattr(ldap3, "Connection")
        Server = getattr(ldap3, "Server")

        if not settings.LDAP_URL or not settings.LDAP_USER_DN_TEMPLATE:
            raise ValueError("LDAP not configured")
        server = Server(settings.LDAP_URL)
        user_dn = settings.LDAP_USER_DN_TEMPLATE.format(username=username)
        conn = Connection(server, user=user_dn, password=password, auto_bind=True)
        attributes = [
            settings.LDAP_EMAIL_ATTR,
            settings.LDAP_USERNAME_ATTR,
            settings.LDAP_ENTERPRISE_ATTR,
            settings.LDAP_TEAM_ATTR,
            settings.LDAP_ROLE_ATTR,
            settings.LDAP_STATUS_ATTR,
        ]
        email = ""
        username_value = username
        enterprise_id = None
        team_id = None
        role = settings.DEFAULT_ROLE
        status = settings.DEFAULT_USER_STATUS
        if settings.LDAP_SEARCH_BASE:
            conn.search(
                search_base=settings.LDAP_SEARCH_BASE,
                search_filter=settings.LDAP_SEARCH_FILTER.format(username=username),
                attributes=attributes,
            )
            if not conn.entries:
                raise ValueError("Invalid credentials")
            entry = conn.entries[0]
            email = str(entry[settings.LDAP_EMAIL_ATTR].value or "")
            username_value = str(entry[settings.LDAP_USERNAME_ATTR].value or username)
            enterprise_id = str(entry[settings.LDAP_ENTERPRISE_ATTR].value or "") or None
            team_id = str(entry[settings.LDAP_TEAM_ATTR].value or "") or None
            role = str(entry[settings.LDAP_ROLE_ATTR].value or settings.DEFAULT_ROLE)
            status = str(entry[settings.LDAP_STATUS_ATTR].value or settings.DEFAULT_USER_STATUS)
        if not settings.ENABLE_ORG_MODEL:
            enterprise_id = None
            team_id = None
        if not settings.ENABLE_RBAC:
            role = settings.DEFAULT_ROLE
        if not email:
            email = f"{username}@local"
        user = await self.user_repo.get_by_email(email)
        identity = {
            "enterprise_id": enterprise_id,
            "team_id": team_id,
            "role": role,
            "status": status,
        }
        if not user:
            raw_password = secrets.token_urlsafe(24)
            user = await self.user_repo.create(
                email=email,
                username=username_value,
                password=raw_password,
                **identity,
            )
        else:
            user = await self.user_repo.update(user, **identity)
        return self.issue_token(user)

    async def refresh_token(self, refresh_token: str) -> TokenPair:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("Invalid token type")
        subject = payload.get("sub")
        if not subject:
            raise ValueError("Invalid token")
        user = await self.user_repo.get_by_id(subject)
        if not user or not user.is_active:
            raise ValueError("User not found")
        if payload.get("ver", 0) != self._get_token_version(user):
            raise ValueError("Token revoked")
        return self.issue_token(user)
