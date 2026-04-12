from fastapi import APIRouter

from backend.api.v1.audit import router as audit_router
from backend.api.v1.auth import router as auth_router
from backend.api.v1.client_skills import router as client_skills_router
from backend.api.v1.dashboard import router as dashboard_router
from backend.api.v1.skills import router as skills_router
from backend.api.v1.tokens import router as tokens_router
from backend.api.v1.users import router as users_router


api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(audit_router, prefix="/audit", tags=["audit"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(tokens_router, prefix="/tokens", tags=["tokens"])
api_router.include_router(skills_router, prefix="/skills", tags=["skills"])
api_router.include_router(client_skills_router, prefix="/client/skills", tags=["client-skills"])
