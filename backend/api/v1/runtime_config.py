from fastapi import APIRouter

from backend.schemas.runtime_config import RuntimeConfigResponse
from backend.services.runtime_config import RuntimeConfigService


router = APIRouter()


@router.get("", response_model=RuntimeConfigResponse)
async def get_runtime_config():
    return RuntimeConfigService.build_response()
