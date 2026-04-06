"""
Centralized permission constants for RBAC system.

This module defines all permission strings as constants to:
- Avoid typos in permission checks
- Enable IDE autocomplete and refactoring
- Provide single source of truth for permissions
- Document which roles should have each permission (via docstrings)

Usage:
    from backend.core.permissions import Permission

    @router.get("/skills", dependencies=[Depends(require_permission(Permission.SKILL_LIST))])
    async def list_skills(...): ...

Permission Hierarchy:
    - Admin: All permissions (via wildcard *)
    - Member: Read/Write/Execute/Upload (but NOT download)
    - Viewer: List/Read only
"""

from __future__ import annotations


class Permission:
    """
    Centralized permission constant class.
    
    Each attribute represents a permission string used in RBAC checks.
    
    Role Access Matrix:
    ┌─────────────────┬───────┬────────┬────────┐
    │ Permission       │ Admin │ Member │ Viewer │
    ├─────────────────┼───────┼────────┼────────┤
    │ SKILL_LIST       │   ✅   │   ✅   │   ✅   │
    │ SKILL_READ       │   ✅   │   ✅   │   ✅   │
    │ SKILL_CREATE     │   ✅   │   ✅   │   ❌   │
    │ SKILL_UPDATE     │   ✅   │   ✅   │   ❌   │
    │ SKILL_DELETE     │   ✅   │   ✅   │   ❌   │
    │ SKILL_UPLOAD     │   ✅   │   ✅   │   ❌   │
    │ SKILL_EXECUTE    │   ✅   │   ✅   │   ❌   │
    │ SKILL_DOWNLOAD   │   ✅   │   ❌   │   ❌   │  ← Admin-only!
    ├─────────────────┼───────┼────────┼────────┤
    │ USER_MANAGE      │   ✅   │   ❌   │   ❌   │  ← Admin-only!
    ├─────────────────┼───────┼────────┼────────┤
    │ AUDIT_READ       │   ✅   │   ❌   │   ❌   │  ← Admin-only!
    │ AUDIT_EXPORT     │   ✅   │   ❌   │   ❌   │  ← Admin-only!
    └─────────────────┴───────┴────────┴────────┘
    """
    
    # =========================================================================
    # Skill Permissions
    # =========================================================================
    
    # Read operations (available to viewer+)
    SKILL_LIST: str = "skill.list"
    SKILL_READ: str = "skill.read"
    
    # Write operations (member+)
    SKILL_CREATE: str = "skill.create"
    SKILL_UPDATE: str = "skill.update"
    SKILL_DELETE: str = "skill.delete"
    SKILL_UPLOAD: str = "skill.upload"
    SKILL_EXECUTE: str = "skill.execute"
    
    # Restricted operations (admin only)
    SKILL_DOWNLOAD: str = "skill.download"  # ⚠️ Admin-only: sensitive data export
    
    # =========================================================================
    # User Management Permissions
    # =========================================================================
    
    USER_MANAGE: str = "user.manage"  # ⚠️ Admin-only: user CRUD operations
    
    # =========================================================================
    # Audit & Monitoring Permissions
    # =========================================================================
    
    AUDIT_READ: str = "audit.read"      # ⚠️ Admin-only: view audit logs
    AUDIT_EXPORT: str = "audit.export"  # ⚠️ Admin-only: export audit data
    DASHBOARD_READ: str = "dashboard.read"  # Read personal dashboard overview
    METRICS_MANAGE: str = "metrics.manage"  # Admin-only: cleanup/reset metrics
    
    # =========================================================================
    # Aliases & Convenience Groups
    # =========================================================================
    
    @classmethod
    def all_skill_permissions(cls) -> list[str]:
        """Return all skill-related permissions."""
        return [
            cls.SKILL_LIST,
            cls.SKILL_READ,
            cls.SKILL_CREATE,
            cls.SKILL_UPDATE,
            cls.SKILL_DELETE,
            cls.SKILL_UPLOAD,
            cls.SKILL_EXECUTE,
            cls.SKILL_DOWNLOAD,
        ]
    
    @classmethod
    def member_skill_permissions(cls) -> list[str]:
        """Return permissions available to member role (excluding download)."""
        return [
            cls.SKILL_LIST,
            cls.SKILL_READ,
            cls.SKILL_CREATE,
            cls.SKILL_UPDATE,
            cls.SKILL_DELETE,
            cls.SKILL_UPLOAD,
            cls.SKILL_EXECUTE,
        ]
    
    @classmethod
    def viewer_permissions(cls) -> list[str]:
        """Return permissions available to viewer role."""
        return [
            cls.SKILL_LIST,
            cls.SKILL_READ,
        ]
    
    @classmethod
    def admin_only_permissions(cls) -> list[str]:
        """Return permissions restricted to admin/superuser only."""
        return [
            cls.SKILL_DOWNLOAD,
            cls.USER_MANAGE,
            cls.AUDIT_READ,
            cls.AUDIT_EXPORT,
            cls.METRICS_MANAGE,
        ]


# Convenience alias
Perm = Permission
