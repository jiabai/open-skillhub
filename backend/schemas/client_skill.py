from pydantic import BaseModel

from backend.schemas.skill import SkillBaseResponse
from backend.schemas.skill_version import SkillVersionResponse


class ClientSkillSummaryResponse(SkillBaseResponse):
    is_downloadable: bool = False
    content_hash: str | None = None
    latest_version: SkillVersionResponse | None = None


class ClientSkillListResponse(BaseModel):
    items: list[ClientSkillSummaryResponse]
    total: int
