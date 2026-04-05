import base64
import hashlib
import os
import shutil
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from loguru import logger

from backend.config.settings import settings
from backend.core.utils.key_derivation import derive_aes256_key


_LOCAL_CACHE_ENCRYPTION_PURPOSE = "skill-local-cache-encryption"


def _archive_key(user_id: str, skill_name: str, version: str) -> str:
    return f"{user_id}/{skill_name}/{version}.zip"


def _archive_path(user_id: str, skill_name: str, version: str) -> Path:
    base = Path(settings.SKILL_STORAGE_PATH) / "_archives" / user_id / skill_name
    return base / f"{version}.zip"


def _local_cache_path(user_id: str, skill_name: str, version: str) -> Path:
    base = Path(settings.SKILL_STORAGE_PATH) / "_local_cache" / user_id / skill_name
    return base / f"{version}.cache"


def _build_encryption_key(value: str) -> bytes:
    return derive_aes256_key(value, _LOCAL_CACHE_ENCRYPTION_PURPOSE)


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
    logger.debug(f"[ARCHIVE_SAVE] user_id={user_id}, skill_name={skill_name}, version={version}, backend={backend}, content_size={len(content)} bytes")
    if backend == "s3":
        _write_local_cache(_local_cache_path(user_id, skill_name, version), content)
        client = _get_s3_client()
        client.put_object(
            Bucket=settings.SKILL_ARCHIVE_S3_BUCKET,
            Key=_archive_key(user_id, skill_name, version),
            Body=content,
        )
        logger.debug(f"[ARCHIVE_SAVE] Saved to S3, key={_archive_key(user_id, skill_name, version)}")
        return
    path = _archive_path(user_id, skill_name, version)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    logger.debug(f"[ARCHIVE_SAVE] Saved to local file, path={path}")


async def save_archive_from_path(user_id: str, skill_name: str, version: str, source_path: Path) -> None:
    backend = (settings.SKILL_ARCHIVE_BACKEND or "local").lower()
    size = source_path.stat().st_size if source_path.exists() else 0
    logger.debug(
        f"[ARCHIVE_SAVE_PATH] user_id={user_id}, skill_name={skill_name}, "
        f"version={version}, backend={backend}, content_size={size} bytes"
    )
    if backend == "s3":
        _write_local_cache(_local_cache_path(user_id, skill_name, version), source_path.read_bytes())
        client = _get_s3_client()
        with source_path.open("rb") as file_obj:
            client.upload_fileobj(file_obj, settings.SKILL_ARCHIVE_S3_BUCKET, _archive_key(user_id, skill_name, version))
        logger.debug(f"[ARCHIVE_SAVE_PATH] Saved to S3, key={_archive_key(user_id, skill_name, version)}")
        return
    path = _archive_path(user_id, skill_name, version)
    path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source_path, path)
    logger.debug(f"[ARCHIVE_SAVE_PATH] Saved to local file, path={path}")


async def load_archive(user_id: str, skill_name: str, version: str) -> bytes | None:
    backend = (settings.SKILL_ARCHIVE_BACKEND or "local").lower()
    logger.debug(f"[ARCHIVE_LOAD] user_id={user_id}, skill_name={skill_name}, version={version}, backend={backend}")
    if backend == "s3":
        client = _get_s3_client()
        try:
            result = client.get_object(
                Bucket=settings.SKILL_ARCHIVE_S3_BUCKET,
                Key=_archive_key(user_id, skill_name, version),
            )
        except Exception as e:
            logger.debug(f"[ARCHIVE_LOAD] S3 load failed: {str(e)}")
            if settings.ENABLE_CACHE_OFFLINE_FALLBACK:
                logger.debug(f"[ARCHIVE_LOAD] Falling back to local cache")
                return _read_local_cache(_local_cache_path(user_id, skill_name, version))
            return None
        body = result.get("Body")
        payload = body.read() if body else None
        if payload is not None:
            _write_local_cache(_local_cache_path(user_id, skill_name, version), payload)
        logger.debug(f"[ARCHIVE_LOAD] Loaded from S3, payload_size={len(payload) if payload else 0} bytes")
        return payload
    path = _archive_path(user_id, skill_name, version)
    data = _read_plain_archive(path)
    logger.debug(f"[ARCHIVE_LOAD] Loaded from local, path={path}, found={'yes' if data else 'no'}")
    return data


def delete_archives_for_skill(user_id: str, skill_name: str) -> None:
    """Delete all archives for a specific skill."""
    logger.info(f"[ARCHIVE_DELETE] user_id={user_id}, skill_name={skill_name}")
    backend = (settings.SKILL_ARCHIVE_BACKEND or "local").lower()
    if backend == "s3":
        client = _get_s3_client()
        prefix = f"{user_id}/{skill_name}/"
        try:
            paginator = client.get_paginator("list_objects_v2")
            count = 0
            for page in paginator.paginate(Bucket=settings.SKILL_ARCHIVE_S3_BUCKET, Prefix=prefix):
                for obj in page.get("Contents", []):
                    client.delete_object(Bucket=settings.SKILL_ARCHIVE_S3_BUCKET, Key=obj["Key"])
                    count += 1
            logger.debug(f"[ARCHIVE_DELETE] Deleted {count} objects from S3, prefix={prefix}")
        except Exception as e:
            logger.error(f"[ARCHIVE_DELETE] S3 delete failed: {str(e)}", exc_info=True)
        local_cache_dir = Path(settings.SKILL_STORAGE_PATH) / "_local_cache" / user_id / skill_name
        if local_cache_dir.exists():
            shutil.rmtree(local_cache_dir)
            logger.debug(f"[ARCHIVE_DELETE] Deleted local cache directory: {local_cache_dir}")
        return
    archive_dir = Path(settings.SKILL_STORAGE_PATH) / "_archives" / user_id / skill_name
    if archive_dir.exists():
        shutil.rmtree(archive_dir)
        logger.debug(f"[ARCHIVE_DELETE] Deleted local archive directory: {archive_dir}")


def list_archive_versions(user_id: str, skill_name: str) -> list[str]:
    """List all archive versions for a specific skill."""
    logger.debug(f"[ARCHIVE_LIST_VERSIONS] user_id={user_id}, skill_name={skill_name}")
    backend = (settings.SKILL_ARCHIVE_BACKEND or "local").lower()
    if backend == "s3":
        client = _get_s3_client()
        prefix = f"{user_id}/{skill_name}/"
        versions = []
        try:
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=settings.SKILL_ARCHIVE_S3_BUCKET, Prefix=prefix):
                for obj in page.get("Contents", []):
                    key = obj["Key"]
                    if key.endswith(".zip"):
                        version = key.split("/")[-1].replace(".zip", "")
                        versions.append(version)
        except Exception as e:
            logger.error(f"[ARCHIVE_LIST_VERSIONS] S3 list failed: {str(e)}", exc_info=True)
        logger.debug(f"[ARCHIVE_LIST_VERSIONS] Found {len(versions)} versions from S3: {versions}")
        return versions
    archive_dir = Path(settings.SKILL_STORAGE_PATH) / "_archives" / user_id / skill_name
    if not archive_dir.exists():
        logger.debug(f"[ARCHIVE_LIST_VERSIONS] Archive directory does not exist: {archive_dir}")
        return []
    versions = [p.stem for p in archive_dir.glob("*.zip")]
    logger.debug(f"[ARCHIVE_LIST_VERSIONS] Found {len(versions)} versions from local: {versions}")
    return versions


def bump_patch_version(version: str) -> str:
    """Bump the patch version: 1.0.0 -> 1.0.1"""
    parts = version.split(".")
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        parts[2] = str(int(parts[2]) + 1)
        return ".".join(parts)
    return version
