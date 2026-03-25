# Restrict Skill Download Permission Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove `skill.download` permission from `member` and `viewer` default roles to enhance security.

**Architecture:** Modify RBAC default permissions in `rbac.py` and update documentation in `project-spec.md`. The download permission should only be granted to admin users by default.

**Tech Stack:** Python, FastAPI, RBAC, Pytest

---

## Background

Skill download is a high-risk operation that exposes complete skill source code and business logic. Currently, both `member` and `viewer` roles have `skill.download` permission by default, which is a security risk.

**Current State:**
| Role | Permissions | Has download? |
|------|-------------|---------------|
| admin | `*` | Yes |
| member | list, read, create, update, delete, upload, download, execute | Yes |
| viewer | list, read, download | Yes (PROBLEM!) |

**Target State:**
| Role | Permissions | Has download? |
|------|-------------|---------------|
| admin | `*` | Yes |
| member | list, read, create, update, delete, upload, execute | No |
| viewer | list, read | No |

---

### Task 1: Write failing tests for new permission model

**Files:**
- Create: `tests/test_rbac_download_permission.py`

**Step 1: Write the failing tests**

```python
import pytest

from backend.core.security.rbac import _DEFAULT_ROLE_PERMISSIONS, has_permission
from backend.models.user import User


class MockUser:
    def __init__(self, role: str, is_superuser: bool = False):
        self.role = role
        self.is_superuser = is_superuser


class TestSkillDownloadPermission:
    def test_admin_has_download_permission(self):
        user = MockUser(role="admin", is_superuser=False)
        assert has_permission(user, "skill.download") is True

    def test_member_lacks_download_permission(self):
        user = MockUser(role="member", is_superuser=False)
        assert has_permission(user, "skill.download") is False

    def test_viewer_lacks_download_permission(self):
        user = MockUser(role="viewer", is_superuser=False)
        assert has_permission(user, "skill.download") is False

    def test_superuser_has_download_permission(self):
        user = MockUser(role="viewer", is_superuser=True)
        assert has_permission(user, "skill.download") is True

    def test_member_has_execute_permission(self):
        user = MockUser(role="member", is_superuser=False)
        assert has_permission(user, "skill.execute") is True

    def test_viewer_has_read_permission(self):
        user = MockUser(role="viewer", is_superuser=False)
        assert has_permission(user, "skill.read") is True

    def test_viewer_lacks_execute_permission(self):
        user = MockUser(role="viewer", is_superuser=False)
        assert has_permission(user, "skill.execute") is False

    def test_default_permissions_member_no_download(self):
        assert "skill.download" not in _DEFAULT_ROLE_PERMISSIONS["member"]

    def test_default_permissions_viewer_no_download(self):
        assert "skill.download" not in _DEFAULT_ROLE_PERMISSIONS["viewer"]
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_rbac_download_permission.py -v`
Expected: FAIL - tests expect download permission to be removed

---

### Task 2: Modify RBAC default permissions

**Files:**
- Modify: `backend/core/security/rbac.py:8-23`

**Step 1: Update default permissions**

```python
_DEFAULT_ROLE_PERMISSIONS = {
    "admin": ["*"],
    "member": [
        "skill.list",
        "skill.read",
        "skill.create",
        "skill.update",
        "skill.delete",
        "skill.upload",
        "skill.execute",
    ],
    "viewer": ["skill.list", "skill.read"],
}
```

**Step 2: Run tests to verify they pass**

Run: `pytest tests/test_rbac_download_permission.py -v`
Expected: PASS

---

### Task 3: Update documentation - RBAC example

**Files:**
- Modify: `docs/project-spec.md:89`

**Step 1: Update RBAC_ROLE_PERMISSIONS example**

Find line 89, replace:
```env
RBAC_ROLE_PERMISSIONS={"admin":["*"],"member":["skill.list","skill.read","skill.create","skill.update","skill.delete","skill.upload","skill.download","skill.execute"],"viewer":["skill.list","skill.read","skill.download"]}
```

With:
```env
RBAC_ROLE_PERMISSIONS={"admin":["*"],"member":["skill.list","skill.read","skill.create","skill.update","skill.delete","skill.upload","skill.execute"],"viewer":["skill.list","skill.read"]}
```

**Step 2: Verify documentation consistency**

Run: `grep -n "skill.download" docs/project-spec.md`
Expected: Only references in permission explanation and audit log sections, not in default role examples

---

### Task 4: Add documentation note about download permission

**Files:**
- Modify: `docs/project-spec.md` (near line 1285)

**Step 1: Add security note for download endpoint**

Find the `/api/v1/skills/download` section (around line 1280-1286), update permission description:

```markdown
**权限说明**

- 仅对具备可见性权限的用户开放
- 需要 RBAC 权限：`skill.download`
- **安全提示**：`skill.download` 默认仅授予 `admin` 角色。此权限允许下载完整技能源码，属于高敏感权限，建议仅在确有需要时通过 `RBAC_ROLE_PERMISSIONS` 配置单独授予。
```

**Step 2: Verify the change**

Run: `grep -A5 "skill.download" docs/project-spec.md | head -20`
Expected: See the new security note

---

### Task 5: Run full test suite

**Step 1: Run all RBAC-related tests**

Run: `pytest tests/test_visibility_rbac.py tests/test_rbac_download_permission.py -v`
Expected: PASS

**Step 2: Run all tests to ensure no regression**

Run: `pytest tests/ -v --tb=short`
Expected: PASS (or only pre-existing failures)

---

### Task 6: Commit changes

**Step 1: Stage and commit**

```bash
git add backend/core/security/rbac.py
git add tests/test_rbac_download_permission.py
git add docs/project-spec.md
git commit -m "security: restrict skill.download permission to admin only

- Remove skill.download from member and viewer default roles
- Add test coverage for new permission model
- Update documentation with security note

BREAKING CHANGE: member and viewer roles no longer have skill.download
permission by default. Grant manually via RBAC_ROLE_PERMISSIONS if needed."
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `backend/core/security/rbac.py` | Remove `skill.download` from member/viewer defaults |
| `tests/test_rbac_download_permission.py` | New test file for permission model |
| `docs/project-spec.md` | Update RBAC example and add security note |

## Migration Guide for Existing Deployments

If existing deployments need to grant download permission to non-admin users, add to `.env`:

```env
RBAC_ROLE_PERMISSIONS={"admin":["*"],"member":["skill.list","skill.read","skill.create","skill.update","skill.delete","skill.upload","skill.download","skill.execute"],"viewer":["skill.list","skill.read","skill.download"]}
```
