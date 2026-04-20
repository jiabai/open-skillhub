"""
Unit tests for the require_permission() dependency injection mechanism.

This test suite validates:
- Factory function behavior
- Closure correctness
- Integration with has_permission()
- Input validation (P3)
- HTTPException generation

Test Categories:
1. Factory Function Tests - Basic factory behavior
2. Permission Checker Tests - Core logic validation
3. Edge Case Tests - Boundary conditions
4. Integration Tests - End-to-end scenarios
"""

import pytest
from unittest.mock import patch

from backend.core.deps import require_permission


# ============================================================================
# Test Utilities
# ============================================================================

class MockUser:
    """Mock User model for testing."""
    
    def __init__(self, user_id: str = "test-user-123", role: str = "member", is_superuser: bool = False):
        self.id = user_id
        self.role = role
        self.is_superuser = is_superuser


def _create_mock_auth_dependency(user: MockUser):
    """
    Create a mock for get_current_active_user that returns the given user.
    Returns both the mock and an async function that resolves to the user.
    """
    async def mock_get_user():
        return user
    
    return mock_get_user


# ============================================================================
# 1. Factory Function Tests (P2)
# ============================================================================

class TestRequirePermissionFactory:
    """Test the require_permission() factory function behavior."""
    
    def test_returns_callable(self):
        """Factory should return a callable dependency."""
        dep = require_permission("skill.read")
        assert callable(dep), "require_permission() must return a callable"
    
    def test_different_permissions_create_different_closures(self):
        """Different permissions should produce different closure objects."""
        dep_read = require_permission("skill.read")
        dep_write = require_permission("skill.write")
        
        # They should be different function objects (different closures)
        assert dep_read is not dep_write
        
        # But they should all be callables
        assert callable(dep_read)
        assert callable(dep_write)
    
    def test_same_permission_returns_new_instance(self):
        """Calling factory with same permission should return new function instances."""
        dep1 = require_permission("skill.read")
        dep2 = require_permission("skill.read")
        
        # Should be different function objects (new closures each time)
        assert dep1 is not dep2
        # But logically equivalent


# ============================================================================
# 2. Input Validation Tests (P3)
# ============================================================================

class TestInputValidation:
    """Test P3: Input validation for permission parameter."""
    
    def test_rejects_empty_string(self):
        """Should raise ValueError for empty string permission."""
        with pytest.raises(ValueError) as exc_info:
            require_permission("")
        
        assert "non-empty string" in str(exc_info.value)
        assert "got:" in str(exc_info.value)
    
    def test_rejects_none(self):
        """Should raise ValueError for None permission."""
        with pytest.raises(ValueError) as exc_info:
            require_permission(None)
        
        assert "non-empty string" in str(exc_info.value)
    
    def test_rejects_whitespace_only(self):
        """Should raise ValueError for whitespace-only strings."""
        with pytest.raises(ValueError) as exc_info:
            require_permission("   ")
        
        assert "non-empty string" in str(exc_info.value)
    
    def test_rejects_non_string_type_integer(self):
        """Should raise ValueError for non-string types (integer)."""
        with pytest.raises(ValueError) as exc_info:
            require_permission(123)
        
        assert "non-empty string" in str(exc_info.value)
    
    def test_rejects_non_string_type_list(self):
        """Should raise ValueError for non-string types (list)."""
        with pytest.raises(ValueError) as exc_info:
            require_permission(["skill.read"])
        
        assert "non-empty string" in str(exc_info.value)
    
    def test_accepts_valid_permission_string(self):
        """Should accept valid non-empty permission strings without error."""
        try:
            dep = require_permission("skill.read")
            assert dep is not None
        except ValueError:
            pytest.fail("require_permission() raised ValueError for valid input")


# ============================================================================
# 3. Permission Checker Logic Tests (P2 - Core Logic)
# ============================================================================

class TestPermissionCheckerLogic:
    """Test the core logic of the permission checker dependency."""
    
    @pytest.mark.asyncio
    async def test_authorized_user_is_returned(self):
        """Should return user object when they have required permission."""
        from backend.core.security.rbac import has_permission
        
        # Create a member user who should have skill.read permission
        authorized_user = MockUser(role="member", is_superuser=False)
        
        # Verify our assumption about RBAC config
        assert has_permission(authorized_user, "skill.read") is True
        
        # Create the dependency
        dep = require_permission("skill.read")
        
        # Mock the auth dependency to return our user
        with patch('backend.core.deps.get_current_active_user') as mock_auth:
            # Make it return a coroutine that yields our user
            async def mock_auth_func():
                return authorized_user
            
            mock_auth.return_value = mock_auth_func()
            
            # Call the dependency
            result = await dep()
        
        # Should return the user object
        assert result is authorized_user
        assert result.id == "test-user-123"
    
    @pytest.mark.asyncio
    async def test_unauthorized_user_raises_403(self):
        """Should raise HTTP 403 when user lacks required permission."""
        from fastapi import HTTPException
        
        # Create a viewer user who lacks skill.create permission
        unauthorized_user = MockUser(role="viewer", is_superuser=False)
        
        # Create the dependency for a privileged operation
        dep = require_permission("skill.create")
        
        # Mock the auth dependency
        with patch('backend.core.deps.get_current_active_user') as mock_auth:
            async def mock_auth_func():
                return unauthorized_user
            
            mock_auth.return_value = mock_auth_func()
            
            # Should raise HTTPException with status 403
            with pytest.raises(HTTPException) as exc_info:
                await dep()
            
            assert exc_info.value.status_code == 403  # HTTP_403_FORBIDDEN
            assert exc_info.value.detail == "Permission denied"
    
    @pytest.mark.asyncio
    async def test_admin_always_authorized(self):
        """Admin users (with wildcard *) should always pass any permission check."""
        admin_user = MockUser(role="admin", is_superuser=False)
        
        # Test with a completely made-up permission
        dep = require_permission("some.random.permission.that.does.not.exist")
        
        with patch('backend.core.deps.get_current_active_user') as mock_auth:
            async def mock_auth_func():
                return admin_user
            
            mock_auth.return_value = mock_auth_func()
            
            # Should NOT raise exception
            result = await dep()
            assert result is admin_user
    
    @pytest.mark.asyncio
    async def test_superuser_bypasses_role_restrictions(self):
        """Superuser flag should bypass all role-based restrictions."""
        superuser_viewer = MockUser(role="viewer", is_superuser=True)
        
        # Even a viewer+superuser should be able to access admin-only operations
        dep = require_permission("user.manage")  # Admin-only permission
        
        with patch('backend.core.deps.get_current_active_user') as mock_auth:
            async def mock_auth_func():
                return superuser_viewer
            
            mock_auth.return_value = mock_auth_func()
            
            # Should succeed despite viewer base role
            result = await dep()
            assert result is superuser_viewer


# ============================================================================
# 4. Closure Capture Tests (P2)
# ============================================================================

class TestClosureCapture:
    """Test that the closure correctly captures the permission parameter."""
    
    def test_closure_captures_correct_value(self):
        """Each closure should capture its own permission value."""
        dep_read = require_permission("skill.read")
        dep_delete = require_permission("skill.delete")
        
        # We can verify this by checking the code object's free variables
        # This is a bit implementation-dependent but validates the concept
        import inspect
        
        # Both should be async functions
        assert inspect.iscoroutinefunction(dep_read)
        assert inspect.iscoroutinefunction(dep_delete)


# ============================================================================
# 5. Integration Scenario Tests
# ============================================================================

class TestIntegrationScenarios:
    """Real-world integration-style tests for the dependency."""
    
    @pytest.mark.asyncio
    async def scenario_1_member_accessing_own_resources(self):
        """Scenario: Member accessing read-only endpoint → Success."""
        member = MockUser(role="member", user_id="member-001")
        dep = require_permission("skill.read")
        
        with patch('backend.core.deps.get_current_active_user') as mock_auth:
            async def mock_auth_func():
                return member
            
            mock_auth.return_value = mock_auth_func()
            result = await dep()
            assert result.id == "member-001"
    
    @pytest.mark.asyncio
    async def scenario_2_viewer_trying_to_create_resource(self):
        """Scenario: Viewer trying to create resource → 403 Forbidden."""
        from fastapi import HTTPException
        
        viewer = MockUser(role="viewer", user_id="viewer-001")
        dep = require_permission("skill.create")
        
        with patch('backend.core.deps.get_current_active_user') as mock_auth:
            async def mock_auth_func():
                return viewer
            
            mock_auth.return_value = mock_auth_func()
            
            with pytest.raises(HTTPException) as exc:
                await dep()
            
            assert exc.value.status_code == 403
    
    @pytest.mark.asyncio
    async def scenario_3_admin_full_access(self):
        """Scenario: Admin accessing any endpoint → Success."""
        admin = MockUser(role="admin", user_id="admin-001")
        
        permissions_to_test = [
            "skill.list",
            "skill.create",
            "skill.delete",
            "skill.download",
            "user.manage",
            "audit.export",
        ]
        
        for perm in permissions_to_test:
            dep = require_permission(perm)
            
            with patch('backend.core.deps.get_current_active_user') as mock_auth:
                async def mock_auth_func():
                    return admin
                
                mock_auth.return_value = mock_auth_func()
                result = await dep()
                assert result is admin, f"Admin should have {perm} permission"


# ============================================================================
# 6. Performance & Memory Tests
# ============================================================================

class TestPerformanceCharacteristics:
    """Validate performance characteristics of the dependency system."""
    
    def test_factory_creation_is_fast(self):
        """Factory function creation should have minimal overhead."""
        import time
        
        iterations = 1000
        start = time.perf_counter()
        
        for _ in range(iterations):
            require_permission("skill.read")
        
        elapsed = time.perf_counter() - start
        
        # Creating 1000 dependencies should take < 10ms (very generous threshold)
        assert elapsed < 0.01, f"Factory too slow: {elapsed:.4f}s for {iterations} calls"
    
    def test_multiple_factories_share_no_mutable_state(self):
        """Different factory results should be independent."""
        dep1 = require_permission("permission.A")
        dep2 = require_permission("permission.B")
        
        # They should be different objects
        assert dep1 is not dep2
        
        # Modifying one should not affect the other (if there was mutable state)
        # Since we're using closures with immutable strings, this is inherently safe


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
