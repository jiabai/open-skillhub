from fastapi import APIRouter, Depends, Request

from backend.api.v1.skills_support import build_skill_service, handle_skill_download_request
from backend.core.deps import require_api_token_permission, require_api_token_skill_download_access
from backend.db.session import get_async_session
from backend.schemas.client_skill import ClientSkillListResponse
from backend.schemas.skill_download import SkillDownloadRequest, SkillDownloadResponse
from backend.services.client_skill_catalog import ClientSkillCatalogService


router = APIRouter()


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
