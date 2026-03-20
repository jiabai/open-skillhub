from dataclasses import dataclass
import secrets

import jwt

from skillhub.config.settings import settings
from skillhub.core.security.jwt_utils import create_access_token, create_refresh_token, decode_token
from skillhub.models.user import User
from skillhub.repositories.user import UserRepository


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str


class AuthService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def register(self, email: str, username: str, password: str | None) -> User:
        if await self.user_repo.get_by_email(email):
            raise ValueError("Email already registered")
        if await self.user_repo.get_by_username(username):
            raise ValueError("Username already registered")
        raw_password = password or secrets.token_urlsafe(24)
        return await self.user_repo.create(email=email, username=username, password=raw_password)

    async def login_sso(self, id_token: str) -> TokenPair:
        payload = jwt.decode(
            id_token,
            settings.SSO_JWT_SECRET,
            algorithms=[settings.SSO_JWT_ALGORITHM],
            audience=settings.SSO_JWT_AUDIENCE or None,
            issuer=settings.SSO_JWT_ISSUER or None,
        )
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
        return TokenPair(
            access_token=create_access_token(subject=str(user.id)),
            refresh_token=create_refresh_token(subject=str(user.id)),
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
        return self.issue_token(user)
