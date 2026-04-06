from datetime import datetime, timedelta, timezone

import jwt

from backend.config.settings import settings
from backend.core.security.jwt_utils import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from backend.core.security.password import get_password_hash, verify_password


def test_access_token_contains_type_and_subject():
    token = create_access_token(subject="user-1")
    payload = decode_token(token)
    assert payload["sub"] == "user-1"
    assert payload["type"] == "access"
    assert payload["ver"] == 0


def test_refresh_token_contains_type_and_subject():
    token = create_refresh_token(subject="user-2")
    payload = decode_token(token)
    assert payload["sub"] == "user-2"
    assert payload["type"] == "refresh"
    assert payload["ver"] == 0


def test_decode_token_rejects_expired():
    expired_payload = {
        "sub": "user-3",
        "type": "access",
        "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
    }
    # Use the same secret key and algorithm as the application
    token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    try:
        decode_token(token)
        assert False
    except Exception as exc:
        assert "expired" in str(exc).lower()


def test_password_hash_uses_bcrypt():
    hashed = get_password_hash("pass1234")
    assert hashed.startswith("$2")


def test_password_verify_matches_hash():
    hashed = get_password_hash("pass1234")
    assert verify_password("pass1234", hashed)
