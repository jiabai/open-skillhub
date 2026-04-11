import asyncio
import os
import tempfile
import time
from pathlib import Path

from fastapi import Depends, HTTPException, Request, UploadFile, status
from fastapi.security import OAuth2PasswordBearer

from backend.config.settings import settings
from backend.core.security.jwt_utils import decode_token
from backend.db.session import get_async_session
from backend.repositories.audit_log import AuditLogRepository
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.repositories.user import UserRepository
from backend.schemas.skill import PublicSkillListItem, SkillResponse
from backend.services.audit import AuditService
from backend.services.skill import DownloadTooLargeError, SkillService
from backend.services.skill_errors import SkillError, SkillErrorCode


UPLOAD_CHUNK_SIZE = 64 * 1024
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
_download_rate_limit_lock = asyncio.Lock()
_download_rate_limit_state: dict[str, list[float]] = {}


_SKILL_ERROR_RESPONSES: dict[SkillErrorCode, tuple[int, bool]] = {
    SkillErrorCode.SKILL_DEACTIVATED: (status.HTTP_410_GONE, True),
    SkillErrorCode.PUBLIC_SKILLS_DISABLED: (status.HTTP_404_NOT_FOUND, True),
    SkillErrorCode.PUBLIC_SKILL_DOWNLOAD_REQUIRES_REFERENCE_OR_CLONE: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.PUBLIC_SKILL_EXECUTION_REQUIRES_REFERENCE_OR_CLONE: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.SKILL_NOT_FOUND: (status.HTTP_404_NOT_FOUND, True),
    SkillErrorCode.FILE_NOT_FOUND: (status.HTTP_404_NOT_FOUND, False),
    SkillErrorCode.VERSION_FILES_NOT_FOUND: (status.HTTP_404_NOT_FOUND, False),
    SkillErrorCode.REFERENCE_SKILL_READ_ONLY: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.REFERENCE_ALREADY_EXISTS: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.SOURCE_SKILL_UNAVAILABLE: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.SKILL_ALREADY_EXISTS: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.INVALID_FILENAME: (status.HTTP_400_BAD_REQUEST, True),
    SkillErrorCode.INVALID_FILE_PATH: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.INVALID_METADATA: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.INVALID_SKILL_NAME: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.INVALID_VERSION: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.INVALID_VISIBILITY: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.INVALID_ZIP_FILE: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.SKILL_MD_NAME_MISSING: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.SKILL_MD_NOT_FOUND: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.SKILL_MD_NOT_FOUND_IN_ZIP: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.TOO_MANY_FILES: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.TOTAL_SKILL_SIZE_LIMIT_EXCEEDED: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.VERSION_ALREADY_EXISTS: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.VERSION_NOT_FOUND: (status.HTTP_404_NOT_FOUND, True),
    SkillErrorCode.ZIP_EMPTY: (status.HTTP_400_BAD_REQUEST, False),
}


def build_skill_service(session) -> SkillService:
    return SkillService(SkillRepository(session), SkillVersionRepository(session))


def _build_http_exception(status_code: int, detail: str, code: str | None = None, structured: bool = False) -> HTTPException:
    if structured and code:
        return HTTPException(status_code=status_code, detail={"detail": detail, "code": code})
    return HTTPException(status_code=status_code, detail=detail)


def handle_skill_value_error(exc: ValueError) -> HTTPException:
    if isinstance(exc, SkillError):
        if exc.code == SkillErrorCode.FILE_TOO_LARGE:
            return _build_http_exception(
                status.HTTP_413_CONTENT_TOO_LARGE,
                "File exceeds maximum size limit",
                code=SkillErrorCode.FILE_TOO_LARGE.value,
                structured=True,
            )
        status_code, structured = _SKILL_ERROR_RESPONSES.get(exc.code, (status.HTTP_400_BAD_REQUEST, False))
        return _build_http_exception(status_code, exc.detail, code=exc.code.value, structured=structured)

    detail = str(exc)
    if "Filename contains invalid characters" in detail:
        return _build_http_exception(
            status.HTTP_400_BAD_REQUEST,
            detail,
            code=SkillErrorCode.INVALID_FILENAME.value,
            structured=True,
        )
    if detail == "File too large":
        return _build_http_exception(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "File exceeds maximum size limit",
            code=SkillErrorCode.FILE_TOO_LARGE.value,
            structured=True,
        )
    if detail == "Skill already exists":
        return _build_http_exception(
            status.HTTP_409_CONFLICT,
            detail,
            code=SkillErrorCode.SKILL_ALREADY_EXISTS.value,
            structured=True,
        )
    if detail == "Version not found":
        return _build_http_exception(
            status.HTTP_404_NOT_FOUND,
            detail,
            code=SkillErrorCode.VERSION_NOT_FOUND.value,
            structured=True,
        )
    if detail in {"File not found", "Version files not found"}:
        return _build_http_exception(status.HTTP_404_NOT_FOUND, detail)
    if detail == "Invalid visibility":
        return _build_http_exception(status.HTTP_400_BAD_REQUEST, detail)
    return _build_http_exception(status.HTTP_400_BAD_REQUEST, detail)


async def get_optional_current_user(
    token: str | None = Depends(optional_oauth2_scheme),
    session=Depends(get_async_session),
):
    if not token:
        return None
    try:
        payload = decode_token(token)
    except ValueError:
        return None
    if payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if not user or not user.is_active:
        return None
    if payload.get("ver", 0) != user.jwt_token_version:
        return None
    return user


async def serialize_skill(service: SkillService, skill) -> SkillResponse:
    payload = SkillResponse.model_validate(skill).model_dump(by_alias=True)
    payload["resolved_version"] = await service.resolved_version_for_skill(skill)
    payload["skill_kind"] = await service.skill_kind(skill)
    payload["is_reference_read_only"] = service.is_reference_skill(skill)
    return SkillResponse.model_validate(payload)


async def serialize_public_skill(
    service: SkillService,
    skill,
    reference_source_ids: set[str] | None = None,
    clone_source_ids: set[str] | None = None,
) -> PublicSkillListItem:
    payload = (await serialize_skill(service, skill)).model_dump(by_alias=True)
    payload["has_reference"] = False
    payload["has_clone"] = False
    if reference_source_ids is not None:
        payload["has_reference"] = skill.id in reference_source_ids
    if clone_source_ids is not None:
        payload["has_clone"] = skill.id in clone_source_ids
    return PublicSkillListItem.model_validate(payload)


async def stream_upload_to_temp_file(file: UploadFile, max_bytes: int) -> tuple[Path, int]:
    suffix = Path(file.filename or "").suffix or ".upload"
    total_size = 0
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = Path(temp_file.name)
        try:
            while True:
                chunk = await file.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > max_bytes:
                    raise ValueError("File too large")
                temp_file.write(chunk)
        except Exception:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
            raise
    return temp_path, total_size


async def enforce_download_rate_limit(request: Request, current_user) -> None:
    if not settings.ENABLE_RATE_LIMIT:
        return
    limit = settings.SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS
    window = settings.SKILL_DOWNLOAD_RATE_LIMIT_WINDOW
    if limit <= 0 or window <= 0:
        return
    key = str(getattr(current_user, "id", "") or (request.client.host if request and request.client else "unknown"))
    now = time.monotonic()
    async with _download_rate_limit_lock:
        timestamps = _download_rate_limit_state.get(key, [])
        cutoff = now - window
        timestamps = [timestamp for timestamp in timestamps if timestamp >= cutoff]
        if len(timestamps) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "detail": "Too many download requests. Please try again later.",
                    "code": "RATE_LIMIT_EXCEEDED",
                },
            )
        timestamps.append(now)
        _download_rate_limit_state[key] = timestamps


async def create_audit_event(
    session,
    request: Request | None,
    current_user,
    action: str,
    target: str,
    metadata: dict | None = None,
) -> None:
    if not settings.ENABLE_AUDIT_LOG:
        return
    audit_service = AuditService(AuditLogRepository(session))
    await audit_service.create_event(
        actor_id=current_user.id,
        action=action,
        target=target,
        ip=request.client.host if request and request.client else "",
        user_agent=request.headers.get("user-agent", "") if request else "",
        metadata=metadata,
    )


__all__ = [
    "DownloadTooLargeError",
    "_download_rate_limit_state",
    "build_skill_service",
    "create_audit_event",
    "enforce_download_rate_limit",
    "get_optional_current_user",
    "handle_skill_value_error",
    "serialize_public_skill",
    "serialize_skill",
    "stream_upload_to_temp_file",
]
