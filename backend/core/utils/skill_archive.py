import base64
import hashlib
import os
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from backend.config.settings import settings


def _archive_key(user_id: str, skill_name: str, version: str) -> str:
    return f"{user_id}/{skill_name}/{version}.zip"


def _archive_path(user_id: str, skill_name: str, version: str) -> Path:
    base = Path(settings.SKILL_STORAGE_PATH) / "_archives" / user_id / skill_name
    return base / f"{version}.zip"


def _local_cache_path(user_id: str, skill_name: str, version: str) -> Path:
    base = Path(settings.SKILL_STORAGE_PATH) / "_local_cache" / user_id / skill_name
    return base / f"{version}.cache"


def _build_encryption_key(value: str) -> bytes:
    return hashlib.sha256(value.encode("utf-8")).digest()


def _encrypt_payload(payload: bytes) -> bytes:
    key = _build_encryption_key(settings.SECRET_KEY)
    nonce = os.urandom(12)
    encrypted = nonce + AESGCM(key).encrypt(nonce, payload, None)
    return base64.b64encode(encrypted)


def _decrypt_payload(payload: bytes) -> bytes:
    key = _build_encryption_key(settings.SECRET_KEY)
    raw = base64.b64decode(payload)
    nonce, ciphertext = raw[:12], raw[12:]
    return AESGCM(key).decrypt(nonce, ciphertext, None)


def _is_expired(path: Path) -> bool:
    ttl_seconds = int(settings.SKILL_CACHE_TTL_SECONDS or 0)
    if ttl_seconds <= 0:
        return False
    try:
        modified = path.stat().st_mtime
    except OSError:
        return False
    import time

    return modified + ttl_seconds < time.time()


def _read_local_cache(path: Path) -> bytes | None:
    if not path.exists():
        return None
    if _is_expired(path):
        try:
            path.unlink()
        except OSError:
            pass
        return None
    data = path.read_bytes()
    if settings.ENABLE_LOCAL_CACHE_ENCRYPTION:
        try:
            return _decrypt_payload(data)
        except Exception:
            try:
                path.unlink()
            except OSError:
                pass
            return None
    return data


def _write_local_cache(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = _encrypt_payload(content) if settings.ENABLE_LOCAL_CACHE_ENCRYPTION else content
    path.write_bytes(data)


def _read_plain_archive(path: Path) -> bytes | None:
    if not path.exists():
        return None
    if _is_expired(path):
        try:
            path.unlink()
        except OSError:
            pass
        return None
    return path.read_bytes()


def _get_s3_client():
    import importlib

    boto3 = importlib.import_module("boto3")
    config_module = importlib.import_module("botocore.config")
    Config = getattr(config_module, "Config")
    session = boto3.session.Session()
    return session.client(
        "s3",
        region_name=settings.SKILL_ARCHIVE_S3_REGION or None,
        endpoint_url=settings.SKILL_ARCHIVE_S3_ENDPOINT or None,
        aws_access_key_id=settings.SKILL_ARCHIVE_S3_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.SKILL_ARCHIVE_S3_SECRET_ACCESS_KEY or None,
        config=Config(s3={"addressing_style": "path"})
        if settings.SKILL_ARCHIVE_S3_FORCE_PATH_STYLE
        else None,
    )


async def save_archive(user_id: str, skill_name: str, version: str, content: bytes) -> None:
    backend = (settings.SKILL_ARCHIVE_BACKEND or "local").lower()
    if backend == "s3":
        _write_local_cache(_local_cache_path(user_id, skill_name, version), content)
        client = _get_s3_client()
        client.put_object(
            Bucket=settings.SKILL_ARCHIVE_S3_BUCKET,
            Key=_archive_key(user_id, skill_name, version),
            Body=content,
        )
        return
    path = _archive_path(user_id, skill_name, version)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


async def load_archive(user_id: str, skill_name: str, version: str) -> bytes | None:
    backend = (settings.SKILL_ARCHIVE_BACKEND or "local").lower()
    if backend == "s3":
        client = _get_s3_client()
        try:
            result = client.get_object(
                Bucket=settings.SKILL_ARCHIVE_S3_BUCKET,
                Key=_archive_key(user_id, skill_name, version),
            )
        except Exception:
            if settings.ENABLE_CACHE_OFFLINE_FALLBACK:
                return _read_local_cache(_local_cache_path(user_id, skill_name, version))
            return None
        body = result.get("Body")
        payload = body.read() if body else None
        if payload is not None:
            _write_local_cache(_local_cache_path(user_id, skill_name, version), payload)
        return payload
    path = _archive_path(user_id, skill_name, version)
    return _read_plain_archive(path)
