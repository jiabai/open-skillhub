"""
FastAPI dependency injection for RBAC permission checks.

This module provides reusable permission-checking dependencies that can be
injected into FastAPI route handlers to enforce role-based access control.

Usage Example:
    from backend.core.deps import require_permission

    @router.get("/skills")
    async def list_skills(
        current_user=Depends(require_permission("skill.list")),
        session=Depends(get_async_session),
    ):
        # User is guaranteed to have "skill.list" permission here
        ...
"""

import inspect

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from starlette import status

from backend.config.settings import settings
from backend.core.middleware.auth import assert_user_active, get_current_active_user
from backend.core.security.rbac import has_permission
from backend.db.session import get_async_session
from backend.repositories.skill import SkillRepository
from backend.repositories.token import TokenRepository
from backend.repositories.user import UserRepository
from backend.schemas.skill_download import SkillDownloadRequest
from backend.services.token import TokenService


api_token_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/tokens", auto_error=False)


def require_permission(permission: str):
    """
    Create a FastAPI dependency that checks for a specific permission.

    This dependency:
    1. Extracts the authenticated user from the request (via JWT)
    2. Checks if the user has the required permission
    3. Returns the user object if authorized, raises 403 if not

    Args:
        permission: The permission string to check (e.g., "skill.read", "skill.update")
                   Must be a non-empty string.

    Returns:
        A FastAPI Depends-compatible dependency function

    Raises:
        ValueError: If permission is empty or not a string
        HTTPException: 403 Forbidden if user lacks the required permission

    Example:
        @router.get("/{skill_uuid}")
        async def get_skill(
            skill_uuid: str,
            current_user=Depends(require_permission("skill.read")),
            session=Depends(get_async_session),
        ):
            # User is guaranteed to have "skill.read" permission
            service = SkillService(session)
            return await service.get_skill(current_user, skill_uuid)
    """
    # P3: Input validation - ensure permission is a non-empty string
    if not isinstance(permission, str) or not permission.strip():
        raise ValueError(
            f"Permission must be a non-empty string, got: {permission!r}"
        )
    permission = permission.strip()

    async def _permission_checker(
        current_user=Depends(get_current_active_user),
    ):
        """Check if the current user has the required permission."""
        if hasattr(current_user, "dependency") and hasattr(current_user, "use_cache"):
            current_user = get_current_active_user()
        while inspect.isawaitable(current_user):
            current_user = await current_user
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied",
            )
        return current_user

    return _permission_checker


def require_management_access():
    """
    Create a FastAPI dependency for management-only endpoints.

    Management endpoints remain protected even when RBAC is disabled. When
    ENABLE_RBAC is false, the management surface is intentionally unavailable.
    When RBAC is enabled, only admin-role or superuser accounts may proceed.
    """

    async def _management_checker(
        current_user=Depends(get_current_active_user),
    ):
        if not settings.ENABLE_RBAC:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Management access requires RBAC",
            )
        if current_user.is_superuser or (current_user.role or "").strip() == "admin":
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied",
        )

    return _management_checker


async def get_current_api_token_user(
    token_value: str | None = Depends(api_token_scheme),
    session=Depends(get_async_session),
):
    if not token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token_service = TokenService(TokenRepository(session), UserRepository(session))
    try:
        token = await token_service.validate_token(token_value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    user = await token_service.user_repo.get_by_id(token.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        assert_user_active(user)
    except HTTPException as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc.detail),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return user


def require_api_token_permission(permission: str):
    if not isinstance(permission, str) or not permission.strip():
        raise ValueError(
            f"Permission must be a non-empty string, got: {permission!r}"
        )
    permission = permission.strip()

    async def _permission_checker(
        current_user=Depends(get_current_api_token_user),
    ):
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied",
            )
        return current_user

    return _permission_checker


def require_skill_download_access():
    """
    Create a FastAPI dependency for skill download authorization.

    When RBAC is enabled, the standard `skill.download` permission applies.
    When RBAC is disabled, downloading is limited to skills owned by the
    authenticated user, preserving self-service private-space downloads without
    reopening broad source export access.
    """

    async def _download_checker(
        payload: SkillDownloadRequest,
        current_user=Depends(get_current_active_user),
        session=Depends(get_async_session),
    ):
        if settings.ENABLE_RBAC:
            if has_permission(current_user, "skill.download"):
                return current_user
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied",
            )

        skill = await SkillRepository(session).get_by_id(payload.skill_uuid)
        if skill and skill.user_id == current_user.id:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied",
        )

    return _download_checker


def require_api_token_skill_download_access():
    """
    Create a FastAPI dependency for API-token-based skill downloads.

    Distribution endpoints are client-facing and only accept API tokens.
    Authorization still maps to the token owner's RBAC role and visibility.
    """

    async def _download_checker(
        payload: SkillDownloadRequest,
        current_user=Depends(get_current_api_token_user),
        session=Depends(get_async_session),
    ):
        if settings.ENABLE_RBAC:
            if has_permission(current_user, "skill.download"):
                return current_user
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied",
            )

        skill = await SkillRepository(session).get_by_id(payload.skill_uuid)
        if skill and skill.user_id == current_user.id:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied",
        )

    return _download_checker
