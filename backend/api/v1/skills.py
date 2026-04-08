import asyncio
import os
from pathlib import Path
import tempfile
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from loguru import logger

from backend.config.settings import settings
from backend.core.deps import require_permission
from backend.core.security.jwt_utils import decode_token
from backend.core.utils.skill_storage import MAX_FILE_SIZE, MAX_TOTAL_SIZE
from backend.db.session import get_async_session
from backend.repositories.audit_log import AuditLogRepository
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.repositories.user import UserRepository
from backend.schemas.skill_download import SkillDownloadRequest, SkillDownloadResponse
from backend.schemas.skill_lifecycle import SkillInstallInstructionsResponse, SkillVersionDiffResponse
from backend.schemas.skill import (
    SkillCachePolicyResponse,
    SkillCloneCreate,
    SkillCreate,
    SkillListResponse,
    SkillPinVersionRequest,
    PublicSkillListItem,
    PublicSkillListResponse,
    SkillReferenceCreate,
    SkillResponse,
    SkillUpdate,
)
from backend.schemas.skill_version import SkillVersionListResponse, SkillVersionResponse
from backend.services.audit import AuditService
from backend.services.skill import DownloadTooLargeError, SkillService
from backend.services.skill_errors import SkillError, SkillErrorCode


router = APIRouter()
UPLOAD_CHUNK_SIZE = 64 * 1024
_download_rate_limit_lock = asyncio.Lock()
_download_rate_limit_state: dict[str, list[float]] = {}
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


_SKILL_ERROR_RESPONSES: dict[SkillErrorCode, tuple[int, bool]] = {
    SkillErrorCode.SKILL_DEACTIVATED: (status.HTTP_410_GONE, True),
    SkillErrorCode.PUBLIC_SKILLS_DISABLED: (status.HTTP_404_NOT_FOUND, True),
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


def _build_http_exception(status_code: int, detail: str, code: str | None = None, structured: bool = False) -> HTTPException:
    if structured and code:
        return HTTPException(status_code=status_code, detail={"detail": detail, "code": code})
    return HTTPException(status_code=status_code, detail=detail)


def _handle_skill_value_error(exc: ValueError) -> HTTPException:
    if isinstance(exc, SkillError):
        if exc.code == SkillErrorCode.FILE_TOO_LARGE:
            return _build_http_exception(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
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
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
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


async def _serialize_skill(service: SkillService, skill) -> SkillResponse:
    payload = SkillResponse.model_validate(skill).model_dump(by_alias=True)
    payload["resolved_version"] = await service.resolved_version_for_skill(skill)
    payload["skill_kind"] = await service.skill_kind(skill)
    payload["is_reference_read_only"] = service.is_reference_skill(skill)
    return SkillResponse.model_validate(payload)


async def _serialize_public_skill(
    service: SkillService,
    skill,
    reference_source_ids: set[str] | None = None,
    clone_source_ids: set[str] | None = None,
) -> PublicSkillListItem:
    payload = (await _serialize_skill(service, skill)).model_dump(by_alias=True)
    payload["has_reference"] = False
    payload["has_clone"] = False
    if reference_source_ids is not None:
        payload["has_reference"] = skill.id in reference_source_ids
    if clone_source_ids is not None:
        payload["has_clone"] = skill.id in clone_source_ids
    return PublicSkillListItem.model_validate(payload)


async def _stream_upload_to_temp_file(file: UploadFile, max_bytes: int) -> tuple[Path, int]:
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


async def _enforce_download_rate_limit(request: Request, current_user) -> None:
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


@router.get("", response_model=SkillListResponse)
@router.get("/", response_model=SkillListResponse)
async def list_skills(
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    include_inactive: bool = False,
    current_user=Depends(require_permission("skill.list")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    skills = await service.list_skills(
        current_user,
        skip=skip,
        limit=limit,
        query=q,
        include_inactive=include_inactive,
    )
    total = await service.skill_repo.count_visible(
        current_user.id,
        current_user.enterprise_id,
        current_user.team_id,
        query=q,
        include_inactive=include_inactive,
    )
    return SkillListResponse(
        items=[await _serialize_skill(service, skill) for skill in skills],
        total=total,
    )


@router.get("/public", response_model=PublicSkillListResponse)
async def list_public_skills(
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    current_user=Depends(get_optional_current_user),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        skills = await service.list_public_skills(skip=skip, limit=limit, query=q)
        total = await service.count_public_skills(query=q)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    reference_source_ids: set[str] | None = None
    clone_source_ids: set[str] | None = None
    if current_user:
        repo = SkillRepository(session)
        reference_source_ids = await repo.list_reference_source_ids(current_user.id)
        clone_source_ids = await repo.list_cloned_source_ids(current_user.id)
    items = [
        await _serialize_public_skill(service, skill, reference_source_ids, clone_source_ids)
        for skill in skills
    ]
    return PublicSkillListResponse(items=items, total=total)


@router.get("/public/{skill_uuid}", response_model=SkillResponse)
async def get_public_skill(
    skill_uuid: str,
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        skill = await service.get_public_skill(skill_uuid)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    return await _serialize_skill(service, skill)


@router.get("/cache-policy", response_model=SkillCachePolicyResponse)
async def get_cache_policy(current_user=Depends(require_permission("skill.read"))):
    return SkillCachePolicyResponse(
        cache_ttl_seconds=settings.SKILL_CACHE_TTL_SECONDS,
        encryption_enabled=settings.ENABLE_LOCAL_CACHE_ENCRYPTION,
        download_encryption_enabled=settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION,
    )


@router.post("", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    request: Request,
    payload: SkillCreate,
    current_user=Depends(require_permission("skill.create")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        skill = await service.create_skill(
            current_user,
            payload.name,
            payload.description,
            payload.tags,
            visibility=payload.visible,
        )
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.create",
            target=skill.id,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return await _serialize_skill(service, skill)


@router.get("/{skill_uuid}", response_model=SkillResponse)
async def get_skill(
    skill_uuid: str,
    current_user=Depends(require_permission("skill.read")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        skill = await service.get_skill(current_user, skill_uuid)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    return await _serialize_skill(service, skill)


@router.put("/{skill_uuid}", response_model=SkillResponse)
async def update_skill(
    request: Request,
    skill_uuid: str,
    payload: SkillUpdate,
    current_user=Depends(require_permission("skill.update")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    fields = payload.model_dump(exclude_unset=True)
    visible = fields.pop("visible", None)
    if visible is not None:
        fields["visibility"] = visible
    try:
        skill = await service.update_skill(current_user, skill_uuid, **fields)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.update",
            target=skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata=fields,
        )
    return await _serialize_skill(service, skill)


@router.delete("/{skill_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    request: Request,
    skill_uuid: str,
    delete_archives: bool = Query(False, description="Also delete skill archives"),
    current_user=Depends(require_permission("skill.delete")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session))
    try:
        await service.delete_skill(current_user, skill_uuid, delete_archives=delete_archives)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.delete",
            target=skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata={"delete_archives": delete_archives},
        )
    return None


@router.post("/{public_uuid}/reference", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_reference_skill(
    request: Request,
    public_uuid: str,
    payload: SkillReferenceCreate,
    current_user=Depends(require_permission("skill.create")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        skill = await service.create_reference_skill(current_user, public_uuid, payload.name, payload.pinned_version)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.reference",
            target=skill.id,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata={"source_skill_id": public_uuid, "pinned_version": payload.pinned_version},
        )
    return await _serialize_skill(service, skill)


@router.post("/{public_uuid}/clone", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def clone_public_skill(
    request: Request,
    public_uuid: str,
    payload: SkillCloneCreate,
    current_user=Depends(require_permission("skill.create")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        result = await service.clone_public_skill(current_user, public_uuid, payload.name, payload.visible)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.clone",
            target=result.skill.id,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata={
                "source_skill_id": public_uuid,
                "source_version": result.source_version,
                "version": result.version,
            },
        )
    return await _serialize_skill(service, result.skill)


@router.put("/{skill_uuid}/pin", response_model=SkillResponse)
async def pin_reference_skill_version(
    request: Request,
    skill_uuid: str,
    payload: SkillPinVersionRequest,
    current_user=Depends(require_permission("skill.update")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        skill = await service.pin_reference_version(current_user, skill_uuid, payload.version)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.pin_version",
            target=skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata={"version": payload.version},
        )
    return await _serialize_skill(service, skill)


@router.put("/{skill_uuid}/unpin", response_model=SkillResponse)
async def unpin_reference_skill_version(
    request: Request,
    skill_uuid: str,
    current_user=Depends(require_permission("skill.update")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        skill = await service.unpin_reference_version(current_user, skill_uuid)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.unpin_version",
            target=skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return await _serialize_skill(service, skill)


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_skill_file(
    request: Request,
    file: UploadFile = File(...),
    skill_uuid: str | None = Form(None),
    visibility: str = Form("private"),
    metadata: str | None = Form(None),
    current_user=Depends(require_permission("skill.upload")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    filename = file.filename or ""
    is_zip = filename.lower().endswith(".zip")
    temp_path = None
    content_size = 0
    max_upload_size = MAX_TOTAL_SIZE if is_zip else MAX_FILE_SIZE
    try:
        temp_path, content_size = await _stream_upload_to_temp_file(file, max_upload_size)
        logger.info(
            f"[UPLOAD START] user_id={current_user.id}, filename={filename}, "
            f"skill_uuid={skill_uuid}, visibility={visibility}, content_size={content_size} bytes"
        )
        if is_zip:
            if skill_uuid:
                logger.debug(f"[UPLOAD ZIP] Updating existing skill, skill_uuid={skill_uuid}")
                payload = await service.upload_zip_from_path(current_user, skill_uuid, filename, temp_path, metadata)
                logger.info(f"[UPLOAD ZIP SUCCESS] Updated skill, version={payload.get('version')}")
                if settings.ENABLE_AUDIT_LOG:
                    audit_service = AuditService(AuditLogRepository(session))
                    await audit_service.create_event(
                        actor_id=current_user.id,
                        action="skill.upload",
                        target=skill_uuid,
                        ip=request.client.host if request and request.client else "",
                        user_agent=request.headers.get("user-agent", ""),
                        metadata={"filename": filename, "archive": True, "version": payload.get("version")},
                    )
                return payload
            else:
                logger.debug(f"[UPLOAD ZIP] Creating new skill")
                payload = await service.upload_zip_create_skill_from_path(current_user, filename, temp_path, visibility)
                logger.info(
                    f"[UPLOAD ZIP SUCCESS] Created new skill, id={payload.get('id')}, "
                    f"name={payload.get('name')}, version={payload.get('version')}"
                )
                if settings.ENABLE_AUDIT_LOG:
                    audit_service = AuditService(AuditLogRepository(session))
                    await audit_service.create_event(
                        actor_id=current_user.id,
                        action="skill.create",
                        target=payload.get("id", ""),
                        ip=request.client.host if request and request.client else "",
                        user_agent=request.headers.get("user-agent", ""),
                        metadata={"filename": filename, "name": payload.get("name"), "version": payload.get("version")},
                    )
                return payload
        if not skill_uuid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="skill_uuid is required for non-zip uploads")
        filename = await service.upload_file_from_path(current_user, skill_uuid, filename, temp_path, content_size)
    except ValueError as exc:
        logger.error(f"[UPLOAD FAILED] user_id={current_user.id}, filename={filename}, error={str(exc)}", exc_info=True)
        raise _handle_skill_value_error(exc) from exc
    except Exception as exc:
        logger.error(f"[UPLOAD FAILED] user_id={current_user.id}, filename={filename}, unexpected_error={str(exc)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Upload failed") from exc
    finally:
        await file.close()
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.upload",
            target=skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata={"filename": filename, "archive": False},
        )
    return {"filename": filename}


@router.post("/download", response_model=SkillDownloadResponse)
async def download_skill(
    request: Request,
    payload: SkillDownloadRequest,
    current_user=Depends(require_permission("skill.download")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        await _enforce_download_rate_limit(request, current_user)
        result = await service.download_skill(current_user, payload.skill_uuid, payload.version)
    except DownloadTooLargeError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Download too large ({exc.size_bytes // 1024 // 1024}MB). Max allowed is {exc.limit_bytes // 1024 // 1024}MB.",
        ) from exc
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"[DOWNLOAD FAILED] user_id={current_user.id}, skill={payload.skill_uuid}, unexpected_error={str(exc)}",
            exc_info=True,
        )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Download failed") from exc
    response_payload = SkillDownloadResponse.model_validate(result)
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.download",
            target=payload.skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata={
                "version": response_payload.version,
                "requested_version": payload.version or "(current)",
                "archive_size_bytes": response_payload.archive_size_bytes,
                "encryption_enabled": response_payload.encryption_enabled,
                "download_filename": response_payload.download_filename,
            },
        )
    return response_payload


@router.post("/{skill_uuid}/deactivate", response_model=SkillResponse)
async def deactivate_skill(
    request: Request,
    skill_uuid: str,
    current_user=Depends(require_permission("skill.update")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        skill = await service.deactivate_skill(current_user, skill_uuid)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.deactivate",
            target=skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return await _serialize_skill(service, skill)


@router.post("/{skill_uuid}/activate", response_model=SkillResponse)
async def activate_skill(
    request: Request,
    skill_uuid: str,
    current_user=Depends(require_permission("skill.update")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        skill = await service.activate_skill(current_user, skill_uuid)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.activate",
            target=skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return await _serialize_skill(service, skill)


@router.get("/{skill_uuid}/versions", response_model=SkillVersionListResponse)
async def list_skill_versions(
    skill_uuid: str,
    current_user=Depends(require_permission("skill.read")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        versions = await service.list_versions(current_user, skill_uuid)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    return SkillVersionListResponse(items=[SkillVersionResponse.model_validate(item) for item in versions])


# NOTE: /versions/diff must come before /versions/{version} to avoid route collision
@router.get("/{skill_uuid}/versions/diff", response_model=SkillVersionDiffResponse)
async def diff_skill_versions(
    skill_uuid: str,
    from_version: str = Query(..., alias="from"),
    to_version: str = Query(..., alias="to"),
    current_user=Depends(require_permission("skill.read")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        payload = await service.diff_versions(current_user, skill_uuid, from_version, to_version)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    return SkillVersionDiffResponse.model_validate(payload)


@router.get("/{skill_uuid}/versions/{version}", response_model=SkillVersionResponse)
async def get_skill_version(
    skill_uuid: str,
    version: str,
    current_user=Depends(require_permission("skill.read")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        record = await service.get_version(current_user, skill_uuid, version)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    return SkillVersionResponse.model_validate(record)


@router.get("/{skill_uuid}/versions/{version}/install-instructions", response_model=SkillInstallInstructionsResponse)
async def get_install_instructions(
    skill_uuid: str,
    version: str,
    current_user=Depends(require_permission("skill.read")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        payload = await service.get_install_instructions(current_user, skill_uuid, version)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    return SkillInstallInstructionsResponse.model_validate(payload)


@router.post("/{skill_uuid}/versions/{version}/rollback", response_model=SkillVersionResponse)
async def rollback_skill_version(
    request: Request,
    skill_uuid: str,
    version: str,
    current_user=Depends(require_permission("skill.update")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        record = await service.rollback_version(current_user, skill_uuid, version)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.rollback",
            target=skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata={"version": version},
        )
    return SkillVersionResponse.model_validate(record)


@router.get("/{skill_uuid}/files")
async def list_skill_files(
    skill_uuid: str,
    current_user=Depends(require_permission("skill.read")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        files = await service.list_skill_files(current_user, skill_uuid)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    return files


@router.get("/{skill_uuid}/files/{file_path:path}")
async def read_skill_file(
    skill_uuid: str,
    file_path: str,
    current_user=Depends(require_permission("skill.read")),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        content = await service.read_skill_file(current_user, skill_uuid, file_path)
    except ValueError as exc:
        raise _handle_skill_value_error(exc) from exc
    return Response(content, media_type="text/plain; charset=utf-8")
