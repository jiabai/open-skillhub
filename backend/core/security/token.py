import hashlib
import secrets


def generate_api_token() -> str:
    return f"ask_live_{secrets.token_hex(32)}"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_token_hash(token: str, token_hash: str) -> bool:
    return hash_token(token) == token_hash
