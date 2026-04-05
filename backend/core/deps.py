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

from fastapi import Depends, HTTPException
from starlette import status

from backend.core.middleware.auth import get_current_active_user
from backend.core.security.rbac import has_permission


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
    if not permission or not isinstance(permission, str):
        raise ValueError(
            f"Permission must be a non-empty string, got: {permission!r}"
        )

    async def _permission_checker(
        current_user=Depends(get_current_active_user),
    ):
        """Check if the current user has the required permission."""
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied",
            )
        return current_user

    return _permission_checker
