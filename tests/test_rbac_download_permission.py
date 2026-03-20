import pytest

from skillhub.core.security.rbac import _DEFAULT_ROLE_PERMISSIONS, has_permission


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
