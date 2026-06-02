from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import secrets
import uuid

import jwt
from loguru import logger

from backend.config.settings import settings
from backend.core.middleware.logging import safe_log_context
from backend.domain.user_status import (
    is_user_active,
    normalize_user_status,
    user_status_is_active,
)
from backend.core.security.jwt_utils import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from backend.models.user import User
from backend.repositories.refresh_token import (
    REFRESH_TOKEN_STATUS_ACTIVE,
    RefreshTokenRepository,
)
from backend.repositories.user import UserRepository
from backend.services.sso_replay_guard import SSOReplayGuardService


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str


class RefreshTokenReuseDetected(ValueError):
    pass


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
        refresh_token_repo: RefreshTokenRepository | None = None,
    ):
        self.user_repo = user_repo
        self.sso_replay_guard = sso_replay_guard or _NoopSSOReplayGuard()
        self.refresh_token_repo = refresh_token_repo

    @staticmethod
    def _get_token_version(user: User) -> int:
        raw_value = getattr(user, "jwt_token_version", 0)
        if isinstance(raw_value, bool):
            return int(raw_value)
        if isinstance(raw_value, int):
            return raw_value
        if isinstance(raw_value, str):
            try:
                return int(raw_value.strip())
            except ValueError:
                return 0
        return 0

    @staticmethod
    def _coerce_user_active_flag(raw_value: object, fallback: bool | None) -> bool:
        if isinstance(raw_value, bool):
            return raw_value
        if fallback is not None:
            return fallback
        return bool(raw_value)

    @classmethod
    def _is_user_enabled(
        cls,
        user: User,
        *,
        fallback_status: str | None = None,
        fallback_is_active: bool | None = None,
    ) -> bool:
        try:
            return is_user_active(user)
        except ValueError:
            if fallback_status is None:
                return False
            return cls._coerce_user_active_flag(
                getattr(user, "is_active", fallback_is_active), fallback_is_active
            ) and user_status_is_active(fallback_status)

    @classmethod
    def _assert_user_enabled(
        cls,
        user: User,
        *,
        fallback_status: str | None = None,
        fallback_is_active: bool | None = None,
    ) -> None:
        if not cls._is_user_enabled(
            user, fallback_status=fallback_status, fallback_is_active=fallback_is_active
        ):
            raise ValueError("Inactive user")

    async def register(self, email: str, username: str, password: str | None) -> User:
        if await self.user_repo.get_by_email(email):
            raise ValueError("Email already registered")
        if await self.user_repo.get_by_username(username):
            raise ValueError("Username already registered")
        raw_password = password or secrets.token_urlsafe(24)
        return await self.user_repo.create(
            email=email, username=username, password=raw_password
        )

    async def _login_sso_payload(
        self, payload: dict, *, replay_key: str, expires_at: datetime
    ) -> TokenPair:
        logger.bind(
            **safe_log_context(
                replay_key_hash=hashlib.sha256(replay_key.encode("utf-8")).hexdigest()[
                    :12
                ],
                expires_at=expires_at.isoformat(),
            )
        ).debug("SSO replay key validation started")
        await self.sso_replay_guard.mark_token_used(replay_key, expires_at)
        email = str(payload.get(settings.SSO_EMAIL_CLAIM) or "").strip()
        username = str(
            payload.get(settings.SSO_USERNAME_CLAIM) or email.split("@")[0]
        ).strip()
        if not email:
            logger.debug("SSO payload rejected because email claim is missing")
            raise ValueError("Invalid SSO token")
        user = await self.user_repo.get_by_email(email)
        enterprise_id = (
            str(payload.get(settings.SSO_ENTERPRISE_CLAIM) or "").strip() or None
        )
        team_id = str(payload.get(settings.SSO_TEAM_CLAIM) or "").strip() or None
        role = str(
            payload.get(settings.SSO_ROLE_CLAIM) or settings.DEFAULT_ROLE
        ).strip()
        status = normalize_user_status(
            payload.get(settings.SSO_STATUS_CLAIM), settings.DEFAULT_USER_STATUS
        )
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
        logger.bind(
            **safe_log_context(
                email=email,
                user_exists=bool(user),
                enterprise_id=enterprise_id,
                team_id=team_id,
                role=role,
                status=status,
            )
        ).debug("SSO identity resolved")
        if not user:
            raw_password = secrets.token_urlsafe(24)
            user = await self.user_repo.create(
                email=email,
                username=username,
                password=raw_password,
                **identity,
            )
            logger.bind(**safe_log_context(user_id=str(user.id), email=email)).debug(
                "SSO user created"
            )
        else:
            user = await self.user_repo.update(user, **identity)
            logger.bind(**safe_log_context(user_id=str(user.id), email=email)).debug(
                "SSO user updated"
            )
        self._assert_user_enabled(
            user,
            fallback_status=status,
            fallback_is_active=user_status_is_active(status),
        )
        logger.bind(**safe_log_context(user_id=str(user.id))).debug(
            "SSO user enabled check passed"
        )
        return await self.issue_token_pair(user)

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
            logger.debug("SSO JWT rejected because nonce is missing")
            raise ValueError("SSO_NONCE_MISSING")
        expected_nonce = nonce or token_nonce
        if token_nonce != expected_nonce:
            logger.debug("SSO JWT rejected because nonce does not match expected nonce")
            raise ValueError("SSO_NONCE_INVALID")
        iat = payload.get("iat")
        if iat is None:
            logger.debug("SSO JWT rejected because iat is missing")
            raise ValueError("SSO_TOKEN_MISSING_IAT")
        issued_at = datetime.fromtimestamp(int(iat), tz=timezone.utc)
        now = datetime.now(timezone.utc)
        if (
            issued_at > now.replace(microsecond=0)
            and (issued_at - now).total_seconds() > settings.SSO_IAT_FUTURE_SKEW_SECONDS
        ):
            logger.bind(
                issued_at=issued_at.isoformat(),
                now=now.isoformat(),
                allowed_skew_seconds=settings.SSO_IAT_FUTURE_SKEW_SECONDS,
            ).debug("SSO JWT rejected because iat is too far in the future")
            raise ValueError("SSO_TOKEN_INVALID_IAT")
        exp = payload.get("exp")
        if exp is None:
            logger.debug("SSO JWT rejected because exp is missing")
            raise ValueError("SSO_TOKEN_MISSING_EXP")
        expires_at = datetime.fromtimestamp(int(exp), tz=timezone.utc)
        await self.sso_replay_guard.consume_nonce(expected_nonce)
        replay_key = (
            str(payload.get("jti") or "").strip()
            or hashlib.sha256(id_token.encode("utf-8")).hexdigest()
        )
        logger.bind(
            **safe_log_context(
                email=str(payload.get(settings.SSO_EMAIL_CLAIM) or ""),
                has_jti=bool(payload.get("jti")),
                expires_at=expires_at.isoformat(),
            )
        ).debug("SSO JWT claims validated")
        return await self._login_sso_payload(
            payload, replay_key=replay_key, expires_at=expires_at
        )

    async def login_sso_claims(
        self, payload: dict, *, replay_key: str, expires_at: datetime
    ) -> TokenPair:
        return await self._login_sso_payload(
            payload, replay_key=replay_key, expires_at=expires_at
        )

    @staticmethod
    def _expires_at_from_payload(payload: dict) -> datetime:
        raw_exp = payload.get("exp")
        if raw_exp is None:
            raise ValueError("Invalid token")
        if isinstance(raw_exp, datetime):
            expires_at = raw_exp
        else:
            expires_at = datetime.fromtimestamp(int(raw_exp), tz=timezone.utc)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return expires_at

    @staticmethod
    def _is_expired(value: datetime) -> bool:
        expires_at = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return expires_at <= datetime.now(timezone.utc)

    def _build_token_pair(
        self, user: User, *, family_id: str | None = None
    ) -> tuple[TokenPair, str, str, datetime]:
        token_version = self._get_token_version(user)
        family_id = family_id or str(uuid.uuid4())
        jti = str(uuid.uuid4())
        refresh_token = create_refresh_token(
            subject=str(user.id),
            token_version=token_version,
            jti=jti,
            family_id=family_id,
        )
        payload = decode_token(refresh_token)
        return (
            TokenPair(
                access_token=create_access_token(
                    subject=str(user.id),
                    token_version=token_version,
                ),
                refresh_token=refresh_token,
            ),
            jti,
            family_id,
            self._expires_at_from_payload(payload),
        )

    def issue_token(self, user: User) -> TokenPair:
        token_pair, _, _, _ = self._build_token_pair(user)
        return token_pair

    async def issue_token_pair(
        self, user: User, *, family_id: str | None = None, commit: bool = True
    ) -> TokenPair:
        token_pair, jti, family_id, expires_at = self._build_token_pair(
            user, family_id=family_id
        )
        if self.refresh_token_repo:
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    family_id=family_id,
                    jti=jti,
                    expires_at=expires_at.isoformat(),
                )
            ).debug("Persisting refresh token session")
            await self.refresh_token_repo.create_session(
                user_id=str(user.id),
                family_id=family_id,
                jti=jti,
                token_hash=self.refresh_token_repo.hash_token(token_pair.refresh_token),
                expires_at=expires_at,
            )
            if commit:
                await self.refresh_token_repo.session.commit()
                logger.bind(
                    **safe_log_context(
                        user_id=str(user.id), family_id=family_id, jti=jti
                    )
                ).debug("Refresh token session committed")
        return token_pair

    async def _compromise_refresh_family(self, user: User, family_id: str) -> None:
        if not self.refresh_token_repo:
            return
        logger.bind(
            **safe_log_context(user_id=str(user.id), family_id=family_id)
        ).debug("Revoking refresh token family after reuse detection")
        await self.refresh_token_repo.revoke_family(
            user_id=str(user.id), family_id=family_id
        )
        user.jwt_token_version = self._get_token_version(user) + 1
        await self.refresh_token_repo.session.flush()
        await self.refresh_token_repo.session.commit()

    async def _rotate_persisted_refresh_token(
        self,
        user: User,
        *,
        raw_refresh_token: str,
        family_id: str,
        jti: str,
    ) -> TokenPair:
        if not self.refresh_token_repo:
            return self.issue_token(user)
        token_hash = self.refresh_token_repo.hash_token(raw_refresh_token)
        token = await self.refresh_token_repo.get_by_token_hash(token_hash)
        if (
            not token
            or token.user_id != str(user.id)
            or token.family_id != family_id
            or token.jti != jti
        ):
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    family_id=family_id,
                    jti=jti,
                    token_found=bool(token),
                    stored_user_id=str(token.user_id) if token else "",
                    stored_family_id=str(token.family_id) if token else "",
                    stored_jti=str(token.jti) if token else "",
                )
            ).debug(
                "Refresh token rotation rejected because persisted session did not match"
            )
            raise ValueError("Token revoked")
        if token.status != REFRESH_TOKEN_STATUS_ACTIVE:
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    family_id=family_id,
                    jti=jti,
                    token_status=token.status,
                )
            ).debug("Refresh token reuse detected")
            await self._compromise_refresh_family(user, family_id)
            raise RefreshTokenReuseDetected("Refresh token reuse detected")
        if self._is_expired(token.expires_at):
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    family_id=family_id,
                    jti=jti,
                    expires_at=token.expires_at.isoformat(),
                )
            ).debug("Refresh token rotation rejected because persisted session expired")
            raise ValueError("Token expired")
        token_pair, replacement_jti, _, expires_at = self._build_token_pair(
            user, family_id=family_id
        )
        await self.refresh_token_repo.mark_used(token, replaced_by_jti=replacement_jti)
        await self.refresh_token_repo.create_session(
            user_id=str(user.id),
            family_id=family_id,
            jti=replacement_jti,
            token_hash=self.refresh_token_repo.hash_token(token_pair.refresh_token),
            expires_at=expires_at,
        )
        await self.refresh_token_repo.session.commit()
        logger.bind(
            **safe_log_context(
                user_id=str(user.id),
                family_id=family_id,
                used_jti=jti,
                replacement_jti=replacement_jti,
                expires_at=expires_at.isoformat(),
            )
        ).debug("Refresh token rotated")
        return token_pair

    async def login_ldap(self, username: str, password: str) -> TokenPair:
        import importlib

        ldap3 = importlib.import_module("ldap3")
        Connection = getattr(ldap3, "Connection")
        Server = getattr(ldap3, "Server")

        if not settings.LDAP_URL or not settings.LDAP_USER_DN_TEMPLATE:
            logger.debug("LDAP login rejected because LDAP settings are incomplete")
            raise ValueError("LDAP not configured")
        logger.bind(
            **safe_log_context(
                username=username, has_search_base=bool(settings.LDAP_SEARCH_BASE)
            )
        ).debug("LDAP login started")
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
        status = normalize_user_status(settings.DEFAULT_USER_STATUS)
        if settings.LDAP_SEARCH_BASE:
            conn.search(
                search_base=settings.LDAP_SEARCH_BASE,
                search_filter=settings.LDAP_SEARCH_FILTER.format(username=username),
                attributes=attributes,
            )
            if not conn.entries:
                logger.bind(**safe_log_context(username=username)).debug(
                    "LDAP search returned no entries"
                )
                raise ValueError("Invalid credentials")
            entry = conn.entries[0]
            email = str(entry[settings.LDAP_EMAIL_ATTR].value or "")
            username_value = str(entry[settings.LDAP_USERNAME_ATTR].value or username)
            enterprise_id = (
                str(entry[settings.LDAP_ENTERPRISE_ATTR].value or "") or None
            )
            team_id = str(entry[settings.LDAP_TEAM_ATTR].value or "") or None
            role = str(entry[settings.LDAP_ROLE_ATTR].value or settings.DEFAULT_ROLE)
            status = normalize_user_status(
                entry[settings.LDAP_STATUS_ATTR].value, settings.DEFAULT_USER_STATUS
            )
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
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id), email=email, username=username_value
                )
            ).debug("LDAP user created")
        else:
            user = await self.user_repo.update(user, **identity)
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id), email=email, username=username_value
                )
            ).debug("LDAP user updated")
        self._assert_user_enabled(
            user,
            fallback_status=status,
            fallback_is_active=user_status_is_active(status),
        )
        logger.bind(**safe_log_context(user_id=str(user.id))).debug(
            "LDAP user enabled check passed"
        )
        return await self.issue_token_pair(user)

    async def refresh_token(self, refresh_token: str) -> TokenPair:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            logger.bind(token_type=payload.get("type")).debug(
                "Refresh token rejected because type is invalid"
            )
            raise ValueError("Invalid token type")
        subject = payload.get("sub")
        if not subject:
            logger.debug("Refresh token rejected because subject is missing")
            raise ValueError("Invalid token")
        jti = str(payload.get("jti") or "").strip()
        family_id = str(payload.get("family_id") or "").strip()
        if self.refresh_token_repo and (not jti or not family_id):
            logger.bind(
                **safe_log_context(
                    subject=str(subject),
                    jti_present=bool(jti),
                    family_id_present=bool(family_id),
                )
            ).debug("Refresh token rejected because rotation claims are missing")
            raise ValueError("Invalid token")
        user = await self.user_repo.get_by_id(subject)
        if not user:
            logger.bind(**safe_log_context(subject=str(subject))).debug(
                "Refresh token subject user not found"
            )
            raise ValueError("User not found")
        self._assert_user_enabled(user)
        if payload.get("ver", 0) != self._get_token_version(user):
            logger.bind(
                **safe_log_context(
                    user_id=str(user.id),
                    token_version=payload.get("ver", 0),
                    current_version=self._get_token_version(user),
                )
            ).debug("Refresh token rejected because token version is stale")
            raise ValueError("Token revoked")
        if not self.refresh_token_repo:
            logger.bind(**safe_log_context(user_id=str(user.id))).debug(
                "Issuing non-persisted refresh token pair because repository is unavailable"
            )
            return self.issue_token(user)
        logger.bind(
            **safe_log_context(user_id=str(user.id), family_id=family_id, jti=jti)
        ).debug("Refresh token rotation started")
        return await self._rotate_persisted_refresh_token(
            user,
            raw_refresh_token=refresh_token,
            family_id=family_id,
            jti=jti,
        )
