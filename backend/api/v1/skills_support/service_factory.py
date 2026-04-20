from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.services.skill import SkillService


def build_skill_service(session) -> SkillService:
    return SkillService(SkillRepository(session), SkillVersionRepository(session))
