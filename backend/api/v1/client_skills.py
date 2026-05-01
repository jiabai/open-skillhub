import os

from fastapi import APIRouter, Depends, HTTPException, File, Form, Request, UploadFile, status

from backend.api.v1.skills_support import (
    build_skill_service,
    create_audit_event,
    handle_skill_download_request,
    handle_skill_value_error,
    stream_upload_to_temp_file,
)
from backend.core.deps import require_api_token_permission, require_api_token_skill_download_access
from backend.core.utils.skill_storage import MAX_TOTAL_SIZE
from backend.db.session import get_async_session
from backend.schemas.client_skill import ClientSkillListResponse
from backend.schemas.skill_download import SkillDownloadRequest, SkillDownloadResponse
from backend.services.client_skill_catalog import ClientSkillCatalogService
from backend.services.skill_errors import SkillError


router = APIRouter()


def _handle_client_upload_value_error(exc: ValueError) -> HTTPException:
    mapped = handle_skill_value_error(exc)
    if isinstance(exc, SkillError) and not isinstance(mapped.detail, dict):
        return HTTPException(
            status_code=mapped.status_code,
            detail={"detail": exc.detail, "code": str(exc.code)},
            headers=mapped.headers,
        )
    return mapped


@router.get("", response_model=ClientSkillListResponse)
@router.get("/", response_model=ClientSkillListResponse)
async def list_client_skills(
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    current_user=Depends(require_api_token_permission("skill.read")),
    session=Depends(get_async_session),
):
    service = ClientSkillCatalogService(build_skill_service(session))
    return await service.list_client_skills(current_user, skip=skip, limit=limit, query=q)


@router.post("/download", response_model=SkillDownloadResponse)
async def download_skill(
    request: Request,
    payload: SkillDownloadRequest,
    current_user=Depends(require_api_token_skill_download_access()),
    session=Depends(get_async_session),
):
    return await handle_skill_download_request(request, payload, current_user, session)


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_client_skill(
    request: Request,
    file: UploadFile = File(...),
    skill_uuid: str | None = Form(None),
    visibility: str = Form("private"),
    metadata: str | None = Form(None),
    current_user=Depends(require_api_token_permission("skill.upload")),
    session=Depends(get_async_session),
):
    service = build_skill_service(session)
    filename = file.filename or ""
    temp_path = None
    try:
        if metadata and not skill_uuid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "metadata is only supported when skill_uuid is provided",
                    "code": "INVALID_METADATA",
                },
            )
        temp_path, _content_size = await stream_upload_to_temp_file(file, MAX_TOTAL_SIZE)
        if skill_uuid:
            payload = await service.upload_zip_from_path(
                current_user,
                skill_uuid,
                filename,
                temp_path,
                metadata_text=metadata,
            )
            await create_audit_event(
                session,
                request,
                current_user,
                "skill.upload",
                skill_uuid,
                metadata={
                    "filename": filename,
                    "archive": True,
                    "version": payload.get("version"),
                    "client_api": True,
                },
            )
            return payload

        payload = await service.upload_zip_create_skill_from_path(current_user, filename, temp_path, visibility)
        await create_audit_event(
            session,
            request,
            current_user,
            "skill.create",
            payload.get("id", ""),
            metadata={
                "filename": filename,
                "name": payload.get("name"),
                "version": payload.get("version"),
                "client_api": True,
            },
        )
        return payload
    except ValueError as exc:
        raise _handle_client_upload_value_error(exc) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Upload failed") from exc
    finally:
        await file.close()
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
