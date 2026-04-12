from fastapi import APIRouter, Depends, Request

from backend.api.v1.skills_support import handle_skill_download_request
from backend.core.deps import require_api_token_skill_download_access
from backend.db.session import get_async_session
from backend.schemas.skill_download import SkillDownloadRequest, SkillDownloadResponse


router = APIRouter()


@router.post("/download", response_model=SkillDownloadResponse)
async def download_skill(
    request: Request,
    payload: SkillDownloadRequest,
    current_user=Depends(require_api_token_skill_download_access()),
    session=Depends(get_async_session),
):
    return await handle_skill_download_request(request, payload, current_user, session)
