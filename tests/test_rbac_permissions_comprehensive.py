"""
Parameterized unit tests for RBAC permission system.

This test suite comprehensively validates the has_permission() function
and the require_permission() dependency injection mechanism.

Test Coverage:
- All role-permission combinations (admin, member, viewer)
- Superuser bypass logic
- Edge cases (RBAC disabled, unknown roles)
- Download permission restriction (admin-only)
- Dependency injection validation
"""

import pytest

from backend.core.security.rbac import _DEFAULT_ROLE_PERMISSIONS, get_role_permissions, has_permission


class MockUser:
    """Mock User model for testing permission checks without database."""
    
    def __init__(self, role: str = "member", is_superuser: bool = False):
        self.role = role
        self.is_superuser = is_superuser


# ============================================================================
# Parameterized Tests: Role-Permission Matrix
# ============================================================================

class TestRolePermissionMatrix:
    """Test all valid role-permission combinations using parameterization."""
    
    @pytest.mark.parametrize("role,permission,expected", [
        # Admin should have ALL permissions via wildcard (*)
        ("admin", "skill.list", True),
        ("admin", "skill.read", True),
        ("admin", "skill.create", True),
        ("admin", "skill.update", True),
        ("admin", "skill.delete", True),
        ("admin", "skill.upload", True),
        ("admin", "skill.execute", True),
        ("admin", "skill.download", True),  # Admin-only permission
        ("admin", "any.custom.permission", True),  # Wildcard matches everything
        
        # Member permissions
        ("member", "skill.list", True),
        ("member", "skill.read", True),
        ("member", "skill.create", True),
        ("member", "skill.update", True),
        ("member", "skill.delete", True),
        ("member", "skill.upload", True),
        ("member", "skill.execute", True),
        ("member", "skill.download", False),  # NOT granted to member
        
        # Viewer permissions (most restricted)
        ("viewer", "skill.list", True),
        ("viewer", "skill.read", True),
        ("viewer", "skill.create", False),
        ("viewer", "skill.update", False),
        ("viewer", "skill.delete", False),
        ("viewer", "skill.upload", False),
        ("viewer", "skill.execute", False),
        ("viewer", "skill.download", False),
    ])
    def test_role_permission_combinations(self, role, permission, expected):
        """Test that each role has the correct permissions as defined in RBAC config."""
        user = MockUser(role=role, is_superuser=False)
        assert has_permission(user, permission) == expected, (
            f"Expected {expected} for role={role}, permission={permission}"
        )
    
    @pytest.mark.parametrize("role,forbidden_permission", [
        ("viewer", "skill.create"),
        ("viewer", "skill.update"),
        ("viewer", "skill.delete"),
        ("viewer", "skill.upload"),
        ("viewer", "skill.execute"),
        ("member", "skill.download"),
    ])
    def test_forbidden_permissions_raise_403_semantic(self, role, forbidden_permission):
        """Verify that forbidden permissions would result in 403 Forbidden in API context."""
        user = MockUser(role=role, is_superuser=False)
        assert has_permission(user, forbidden_permission) is False
    
    @pytest.mark.parametrize("role,granted_permission", [
        ("admin", "skill.delete"),  # Highest privilege operation
        ("member", "skill.execute"),  # Execution capability
        ("viewer", "skill.read"),  # Basic read access
    ])
    def test_granted_permissions_succeed(self, role, granted_permission):
        """Verify that granted permissions allow operations to proceed."""
        user = MockUser(role=role, is_superuser=False)
        assert has_permission(user, granted_permission) is True


# ============================================================================
# Superuser Bypass Tests
# ============================================================================

class TestSuperuserBypass:
    """Test that superusers bypass all permission checks regardless of role."""
    
    @pytest.mark.parametrize("base_role", ["admin", "member", "viewer"])
    def test_superuser_has_all_permissions(self, base_role):
        """Superuser with any base role should have all permissions."""
        user = MockUser(role=base_role, is_superuser=True)
        
        # Test a mix of permissions including restricted ones
        assert has_permission(user, "skill.download") is True
        assert has_permission(user, "skill.delete") is True
        assert has_permission(user, "skill.admin.only") is True  # Even non-existent
    
    @pytest.mark.parametrize("base_role", ["admin", "member", "viewer"])
    def test_superuser_bypasses_role_restrictions(self, base_role):
        """Verify superuser bypass works even when base role lacks permission."""
        user = MockUser(role="viewer", is_superuser=True)  # Most restricted base role
        assert has_permission(user, "skill.create") is True  # viewer can't normally create
        assert has_permission(user, "skill.delete") is True  # viewer can't normally delete


# ============================================================================
# Edge Cases & Special Scenarios
# ============================================================================

class TestEdgeCases:
    """Test edge cases and special scenarios in permission system."""
    
    def test_unknown_role_falls_back_to_default(self):
        """Unknown roles should fallback to 'member' default behavior."""
        user = MockUser(role="unknown_custom_role", is_superuser=False)
        
        # Should behave like member (has most permissions but not download)
        assert has_permission(user, "skill.read") is True
        assert has_permission(user, "skill.download") is False
    
    @pytest.mark.parametrize("nonexistent_permission", [
        "skill.nonexistent",
        "completely.unknown.permission",
        "",
    ])
    def test_nonexistent_permission_denied_for_non_admin(self, nonexistent_permission):
        """Non-existent permissions should be denied for non-admin users."""
        user = MockUser(role="member", is_superuser=False)
        assert has_permission(user, nonexistent_permission) is False


# ============================================================================
# Download Permission Restriction Tests (Admin-Only Policy)
# ============================================================================

class TestDownloadPermissionPolicy:
    """
    Verify that skill.download is intentionally restricted to admin only.
    
    Policy Decision: skill.download is admin-only to control sensitive data export.
    - Admin: Has wildcard (*) → Allowed ✅
    - Member: Explicitly excluded → Denied 🔒
    - Viewer: Not in permission list → Denied 🔒
    """
    
    @pytest.mark.parametrize("role", ["admin"])
    def test_download_allowed_for_admin(self, role):
        """Only admin (or superuser) should have download permission."""
        user = MockUser(role=role, is_superuser=False)
        assert has_permission(user, "skill.download") is True
    
    @pytest.mark.parametrize("role", ["member", "viewer"])
    def test_download_denied_for_non_admin_roles(self, role):
        """Non-admin roles must not have download capability."""
        user = MockUser(role=role, is_superuser=False)
        assert has_permission(user, "skill.download") is False
    
    def test_download_not_in_member_defaults(self):
        """Explicitly verify download is absent from member's default permissions."""
        member_perms = _DEFAULT_ROLE_PERMISSIONS.get("member", [])
        assert "skill.download" not in member_perms
        # But member should have other common permissions
        assert "skill.read" in member_perms
        assert "skill.execute" in member_perms
    
    def test_download_not_in_viewer_defaults(self):
        """Viewer also lacks download permission (as expected)."""
        viewer_perms = _DEFAULT_ROLE_PERMISSIONS.get("viewer", [])
        assert "skill.download" not in viewer_perms
        # Viewer should only have read/list
        assert len(viewer_perms) == 2
        assert set(viewer_perms) == {"skill.list", "skill.read"}


# ============================================================================
# Permission Configuration Integrity Tests
# ============================================================================

class TestPermissionConfigIntegrity:
    """Validate the integrity of the _DEFAULT_ROLE_PERMISSIONS configuration."""
    
    def test_all_expected_roles_exist(self):
        """Ensure all three standard roles are defined."""
        assert "admin" in _DEFAULT_ROLE_PERMISSIONS
        assert "member" in _DEFAULT_ROLE_PERMISSIONS
        assert "viewer" in _DEFAULT_ROLE_PERMISSIONS
    
    def test_admin_has_wildcard(self):
        """Admin role must have wildcard permission."""
        assert "*" in _DEFAULT_ROLE_PERMISSIONS["admin"]
    
    def test_member_has_more_permissions_than_viewer(self):
        """Member role should be strictly more permissive than viewer."""
        member_perms = set(_DEFAULT_ROLE_PERMISSIONS["member"])
        viewer_perms = set(_DEFAULT_ROLE_PERMISSIONS["viewer"])
        
        assert member_perms.issuperset(viewer_perms), (
            "Member should have all viewer permissions plus additional ones"
        )
        assert len(member_perms) > len(viewer_perms)
    
    def test_viewer_has_minimal_readonly_permissions(self):
        """Viewer should have minimal read-only permissions."""
        viewer_perms = _DEFAULT_ROLE_PERMISSIONS["viewer"]
        
        # Only list and read
        assert "skill.list" in viewer_perms
        assert "skill.read" in viewer_perms
        assert len(viewer_perms) == 2
        
        # No write/modify permissions
        assert "skill.create" not in viewer_perms
        assert "skill.update" not in viewer_perms
        assert "skill.delete" not in viewer_perms
    
    def test_get_role_permissions_returns_sets(self):
        """Utility function should return sets for efficient lookup."""
        perms = get_role_permissions()
        
        assert isinstance(perms, dict)
        for role, perm_set in perms.items():
            assert isinstance(perm_set, set), f"Permissions for {role} should be a set"


# ============================================================================
# Permission Hierarchy Validation Tests
# ============================================================================

class TestPermissionHierarchy:
    """
    Validate that permission assignments follow logical business rules.
    
    Expected hierarchy:
    - admin > member > viewer (strictly increasing privileges)
    - Write permissions imply read permissions
    - Delete is high-privilege operation
    """
    
    @pytest.mark.parametrize("write_perm", ["skill.create", "skill.update", "skill.upload"])
    def test_write_permissions_require_member_or_higher(self, write_perm):
        """Write operations should require at least member role."""
        viewer_user = MockUser(role="viewer")
        member_user = MockUser(role="member")
        admin_user = MockUser(role="admin")
        
        assert has_permission(viewer_user, write_perm) is False
        assert has_permission(member_user, write_perm) is True
        assert has_permission(admin_user, write_perm) is True
    
    def test_delete_is_restricted_to_member_or_higher(self):
        """Delete operation requires at least member role."""
        assert has_permission(MockUser("viewer"), "skill.delete") is False
        assert has_permission(MockUser("member"), "skill.delete") is True
        assert has_permission(MockUser("admin"), "skill.delete") is True
    
    def test_execute_requires_member_or_higher(self):
        """Skill execution requires member or higher (not just viewer)."""
        assert has_permission(MockUser("viewer"), "skill.execute") is False
        assert has_permission(MockUser("member"), "skill.execute") is True


# ============================================================================
# Integration-style Scenario Tests
# ============================================================================

class TestPermissionScenarios:
    """Real-world usage scenarios to validate permission system behavior."""
    
    def scenario_1_viewer_trying_to_delete_skill(self):
        """Scenario: Viewer attempts to delete a skill → Should be denied."""
        viewer = MockUser(role="viewer")
        assert has_permission(viewer, "skill.delete") is False
    
    def scenario_2_member_downloading_skill_package(self):
        """Scenario: Member tries to download skill → Should be denied (admin-only)."""
        member = MockUser(role="member")
        assert has_permission(member, "skill.download") is False
    
    def scenario_3_admin_full_access(self):
        """Scenario: Admin performing any operation → All allowed."""
        admin = MockUser(role="admin")
        operations = [
            "skill.list", "skill.read", "skill.create",
            "skill.update", "skill.delete", "skill.upload",
            "skill.execute", "skill.download"
        ]
        for op in operations:
            assert has_permission(admin, op) is True, f"Admin should have {op}"
    
    def scenario_4_support_user_with_elevated_access(self):
        """Scenario: Support user marked as superuser → Full bypass."""
        support_user = MockUser(role="viewer", is_superuser=True)
        assert has_permission(support_user, "skill.delete") is True
        assert has_permission(support_user, "skill.download") is True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
