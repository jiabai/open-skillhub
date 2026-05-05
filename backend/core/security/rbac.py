from collections.abc import Iterable

from backend.config.settings import settings
from backend.domain.skill_visibility import (
    ENTERPRISE_SKILL_VISIBILITY,
    PRIVATE_SKILL_VISIBILITY,
    PUBLIC_SKILL_VISIBILITY,
    TEAM_SKILL_VISIBILITY,
    normalize_skill_visibility,
)
from backend.models.skill import Skill
from backend.models.user import User


_DEFAULT_ROLE_PERMISSIONS = {
    "admin": ["*"],
    "member": [
        "dashboard.read",
        "skill.list",
        "skill.read",
        "skill.create",
        "skill.update",
        "skill.delete",
        "skill.upload",
    ],
    "viewer": ["skill.list", "skill.read"],
}


def _normalize_permissions(value: object) -> set[str]:
    if isinstance(value, str):
        return {value}
    if isinstance(value, Iterable):
        return {str(item) for item in value}
    return set()


def get_role_permissions() -> dict[str, set[str]]:
    merged: dict[str, set[str]] = {}
    for role, permissions in _DEFAULT_ROLE_PERMISSIONS.items():
        merged[role] = _normalize_permissions(permissions)
    overrides = settings.RBAC_ROLE_PERMISSIONS or {}
    if isinstance(overrides, dict):
        for role, permissions in overrides.items():
            merged[str(role)] = _normalize_permissions(permissions)
    return merged


def has_permission(user: User, permission: str) -> bool:
    if not settings.ENABLE_RBAC:
        return True
    if user.is_superuser:
        return True
    role = (user.role or settings.DEFAULT_ROLE or "member").strip()
    permissions_by_role = get_role_permissions()
    permissions = permissions_by_role.get(role) or permissions_by_role.get("member", set())
    return "*" in permissions or permission in permissions


def is_skill_visible(user: User, skill: Skill) -> bool:
    if not settings.ENABLE_SKILL_VISIBILITY:
        return skill.user_id == user.id
    try:
        visibility = normalize_skill_visibility(skill.visibility, settings.DEFAULT_SKILL_VISIBILITY)
    except ValueError:
        visibility = PRIVATE_SKILL_VISIBILITY
    if visibility == PUBLIC_SKILL_VISIBILITY and not settings.ENABLE_RBAC:
        return True
    if visibility == ENTERPRISE_SKILL_VISIBILITY:
        return bool(user.enterprise_id) and user.enterprise_id == skill.enterprise_id
    if visibility == TEAM_SKILL_VISIBILITY:
        return (
            bool(user.enterprise_id)
            and user.enterprise_id == skill.enterprise_id
            and bool(user.team_id)
            and user.team_id == skill.team_id
        )
    return skill.user_id == user.id
