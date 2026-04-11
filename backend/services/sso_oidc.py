from __future__ import annotations

import base64
import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt

from backend.config.settings import settings


class SSOOIDCService:
    def __init__(self):
        self._timeout = httpx.Timeout(float(settings.SSO_HTTP_TIMEOUT_SECONDS or 10))

    @staticmethod
    def build_code_challenge(code_verifier: str) -> str:
        digest = hashlib.sha256(code_verifier.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")

    @staticmethod
    def _issuer() -> str | None:
        return (settings.SSO_ISSUER or settings.SSO_JWT_ISSUER or "").strip() or None

    @staticmethod
    def _audience() -> str | None:
        return (settings.SSO_CLIENT_ID or settings.SSO_JWT_AUDIENCE or "").strip() or None

    def validate_configuration(self) -> None:
        missing = []
        required = {
            "SSO_AUTHORIZATION_ENDPOINT": settings.SSO_AUTHORIZATION_ENDPOINT,
            "SSO_TOKEN_ENDPOINT": settings.SSO_TOKEN_ENDPOINT,
            "SSO_CLIENT_ID": settings.SSO_CLIENT_ID,
            "SSO_REDIRECT_URI": settings.SSO_REDIRECT_URI,
            "SSO_FRONTEND_CALLBACK_URL": settings.SSO_FRONTEND_CALLBACK_URL,
        }
        for key, value in required.items():
            if not str(value or "").strip():
                missing.append(key)
        if missing:
            raise ValueError(f"SSO configuration incomplete: {', '.join(missing)}")
        if not str(settings.SSO_JWT_SECRET or "").strip() and not str(settings.SSO_JWKS_URI or "").strip():
            raise ValueError("SSO configuration incomplete: SSO_JWT_SECRET or SSO_JWKS_URI is required")

    def build_authorization_url(self, *, state: str, nonce: str, code_challenge: str) -> str:
        self.validate_configuration()
        params = {
            "response_type": "code",
            "client_id": settings.SSO_CLIENT_ID,
            "redirect_uri": settings.SSO_REDIRECT_URI,
            "scope": " ".join(settings.SSO_SCOPES or ["openid", "email", "profile"]),
            "state": state,
            "nonce": nonce,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        return f"{settings.SSO_AUTHORIZATION_ENDPOINT}?{urlencode(params)}"

    async def exchange_code_for_tokens(self, code: str, code_verifier: str) -> dict[str, Any]:
        self.validate_configuration()
        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.SSO_REDIRECT_URI,
            "client_id": settings.SSO_CLIENT_ID,
            "code_verifier": code_verifier,
        }
        client_secret = str(settings.SSO_CLIENT_SECRET or "").strip()
        if client_secret:
            payload["client_secret"] = client_secret
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                settings.SSO_TOKEN_ENDPOINT,
                data=payload,
                headers={"Accept": "application/json"},
            )
        data = response.json() if response.content else {}
        if not response.is_success:
            detail = data.get("error_description") or data.get("error") or response.text or response.reason_phrase
            raise ValueError(f"SSO_TOKEN_EXCHANGE_FAILED: {detail}")
        if not isinstance(data, dict) or not str(data.get("id_token") or "").strip():
            raise ValueError("SSO_TOKEN_EXCHANGE_FAILED: missing id_token")
        return data

    async def decode_id_token(self, id_token: str) -> dict[str, Any]:
        issuer = self._issuer()
        audience = self._audience()
        algorithms = [settings.SSO_JWT_ALGORITHM]
        if str(settings.SSO_JWT_SECRET or "").strip():
            key = settings.SSO_JWT_SECRET
        else:
            key = await self._fetch_jwk_signing_key(id_token)
        return jwt.decode(
            id_token,
            key,
            algorithms=algorithms,
            audience=audience,
            issuer=issuer,
            options={"require": ["exp", "iat", "nonce"]},
        )

    async def _fetch_jwk_signing_key(self, id_token: str):
        headers = jwt.get_unverified_header(id_token)
        kid = str(headers.get("kid") or "").strip()
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(settings.SSO_JWKS_URI)
        response.raise_for_status()
        payload = response.json()
        keys = payload.get("keys")
        if not isinstance(keys, list) or not keys:
            raise ValueError("SSO_JWKS_INVALID")
        candidates = [key for key in keys if isinstance(key, dict)]
        if kid:
            candidates = [key for key in candidates if str(key.get("kid") or "").strip() == kid]
        if not candidates:
            raise ValueError("SSO_JWKS_KEY_NOT_FOUND")
        return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(candidates[0]))

    @staticmethod
    def validate_nonce_and_timestamps(payload: dict[str, Any], *, expected_nonce: str) -> datetime:
        token_nonce = str(payload.get("nonce") or "").strip()
        if not token_nonce:
            raise ValueError("SSO_NONCE_MISSING")
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
        return datetime.fromtimestamp(int(exp), tz=timezone.utc)
