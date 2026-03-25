from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status

from backend.config.settings import settings
from backend.core.middleware.auth import get_current_active_user
from backend.core.security.rbac import has_permission
from backend.db.session import get_async_session
from backend.repositories.audit_log import AuditLogRepository
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.schemas.skill_download import SkillDownloadRequest, SkillDownloadResponse
from backend.schemas.skill_lifecycle import SkillInstallInstructionsResponse, SkillVersionDiffResponse
from backend.schemas.skill import (
    SkillCachePolicyResponse,
    SkillCreate,
    SkillListResponse,
    SkillResponse,
    SkillUpdate,
)
from backend.schemas.skill_version import SkillVersionListResponse, SkillVersionResponse
from backend.services.audit import AuditService
from backend.services.skill import SkillService


router = APIRouter()


@router.get("", response_model=SkillListResponse)
@router.get("/", response_model=SkillListResponse)
async def list_skills(
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    include_inactive: bool = False,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    if not has_permission(current_user, "skill.list"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
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
        items=[SkillResponse.model_validate(skill) for skill in skills],
        total=total,
    )


@router.get("/cache-policy", response_model=SkillCachePolicyResponse)
async def get_cache_policy(current_user=Depends(get_current_active_user)):
    if not has_permission(current_user, "skill.read"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
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
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    if not has_permission(current_user, "skill.create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    service = SkillService(SkillRepository(session))
    try:
        skill = await service.create_skill(
            current_user,
            payload.name,
            payload.description,
            payload.tags,
            visibility=payload.visible,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.create",
            target=skill.id,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return skill


@router.get("/{skill_uuid}", response_model=SkillResponse)
async def get_skill(
    skill_uuid: str,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    if not has_permission(current_user, "skill.read"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    service = SkillService(SkillRepository(session))
    try:
        skill = await service.get_skill(current_user, skill_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return skill


@router.put("/{skill_uuid}", response_model=SkillResponse)
async def update_skill(
    request: Request,
    skill_uuid: str,
    payload: SkillUpdate,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    if not has_permission(current_user, "skill.update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    service = SkillService(SkillRepository(session))
    fields = payload.model_dump(exclude_unset=True)
    visible = fields.pop("visible", None)
    if visible is not None:
        fields["visibility"] = visible
    try:
        skill = await service.update_skill(current_user, skill_uuid, **fields)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.update",
            target=skill_uuid,
            ip=request.client.host if request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata=fields,
        )
    return skill


@router.delete("/{skill_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    request: Request,
    skill_uuid: str,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    if not has_permission(current_user, "skill.delete"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    service = SkillService(SkillRepository(session))
    try:
        await service.delete_skill(current_user, skill_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.delete",
            target=skill_uuid,
            ip=request.client.host if request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return None


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_skill_file(
    request: Request,
    skill_uuid: str = Form(...),
    file: UploadFile = File(...),
    metadata: str | None = Form(None),
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    if not has_permission(current_user, "skill.upload"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    content = await file.read()
    try:
        filename = file.filename or ""
        if filename.lower().endswith(".zip"):
            payload = await service.upload_zip(current_user, skill_uuid, filename, content, metadata)
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
        filename = await service.upload_file(current_user, skill_uuid, filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
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
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    if not has_permission(current_user, "skill.download"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        result = await service.download_skill(current_user, payload.skill_uuid, payload.version)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    response_payload = SkillDownloadResponse.model_validate(result)
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.download",
            target=payload.skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return response_payload


@router.post("/{skill_uuid}/deactivate", response_model=SkillResponse)
async def deactivate_skill(
    request: Request,
    skill_uuid: str,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        skill = await service.deactivate_skill(current_user, skill_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.deactivate",
            target=skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return skill


@router.post("/{skill_uuid}/activate", response_model=SkillResponse)
async def activate_skill(
    request: Request,
    skill_uuid: str,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        skill = await service.activate_skill(current_user, skill_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.activate",
            target=skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return skill


@router.get("/{skill_uuid}/versions", response_model=SkillVersionListResponse)
async def list_skill_versions(
    skill_uuid: str,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        versions = await service.list_versions(current_user, skill_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return SkillVersionListResponse(items=[SkillVersionResponse.model_validate(item) for item in versions])


@router.get("/{skill_uuid}/versions/{version}", response_model=SkillVersionResponse)
async def get_skill_version(
    skill_uuid: str,
    version: str,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        record = await service.get_version(current_user, skill_uuid, version)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return SkillVersionResponse.model_validate(record)


@router.get("/{skill_uuid}/versions/{version}/install-instructions", response_model=SkillInstallInstructionsResponse)
async def get_install_instructions(
    skill_uuid: str,
    version: str,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        payload = await service.get_install_instructions(current_user, skill_uuid, version)
    except ValueError as exc:
        if str(exc) == "SKILL_DEACTIVATED":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail={"detail": "Skill deactivated", "code": "SKILL_DEACTIVATED"},
            ) from exc
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return SkillInstallInstructionsResponse.model_validate(payload)


@router.get("/{skill_uuid}/versions/diff", response_model=SkillVersionDiffResponse)
async def diff_skill_versions(
    skill_uuid: str,
    from_version: str = Query(..., alias="from"),
    to_version: str = Query(..., alias="to"),
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        payload = await service.diff_versions(current_user, skill_uuid, from_version, to_version)
    except ValueError as exc:
        if str(exc) == "SKILL_DEACTIVATED":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail={"detail": "Skill deactivated", "code": "SKILL_DEACTIVATED"},
            ) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return SkillVersionDiffResponse.model_validate(payload)


@router.post("/{skill_uuid}/versions/{version}/rollback", response_model=SkillVersionResponse)
async def rollback_skill_version(
    request: Request,
    skill_uuid: str,
    version: str,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        record = await service.rollback_version(current_user, skill_uuid, version)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
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
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session))
    try:
        files = await service.list_skill_files(current_user, skill_uuid)
    except ValueError as exc:
        if str(exc) == "SKILL_DEACTIVATED":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail={"detail": "Skill deactivated", "code": "SKILL_DEACTIVATED"},
            ) from exc
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return files


@router.get("/{skill_uuid}/files/{file_path:path}")
async def read_skill_file(
    skill_uuid: str,
    file_path: str,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        content = await service.read_skill_file(current_user, skill_uuid, file_path)
    except ValueError as exc:
        if str(exc) == "SKILL_DEACTIVATED":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail={"detail": "Skill deactivated", "code": "SKILL_DEACTIVATED"},
            ) from exc
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return Response(content, media_type="text/plain; charset=utf-8")
