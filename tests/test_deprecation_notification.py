"""
Deprecation Notification Service 测试
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.deprecation_notification import DeprecationNotifier
from backend.repositories.audit_log import AuditLogRepository


@pytest.fixture
def mock_audit_repo():
    """Mock audit log repository"""
    return AsyncMock(spec=AuditLogRepository)


class TestDeprecationNotifierParsing:
    """测试日期解析"""

    def test_parse_sunset_date_valid(self):
        """测试解析有效日期"""
        result = DeprecationNotifier._parse_sunset_date("2024-12-31")
        assert result is not None
        assert result.year == 2024
        assert result.month == 12
        assert result.day == 31

    def test_parse_sunset_date_with_z(self):
        """测试解析带 Z 的日期"""
        result = DeprecationNotifier._parse_sunset_date("2024-12-31T00:00:00Z")
        assert result is not None
        assert result.tzinfo is not None

    def test_parse_sunset_date_with_timezone(self):
        """测试解析带时区的日期"""
        result = DeprecationNotifier._parse_sunset_date("2024-12-31T00:00:00+00:00")
        assert result is not None
        assert result.tzinfo is not None

    def test_parse_sunset_date_empty(self):
        """测试解析空日期"""
        result = DeprecationNotifier._parse_sunset_date("")
        assert result is None

    def test_parse_sunset_date_none(self):
        """测试解析 None"""
        result = DeprecationNotifier._parse_sunset_date(None)
        assert result is None

    def test_parse_sunset_date_invalid(self):
        """测试解析无效日期"""
        result = DeprecationNotifier._parse_sunset_date("not-a-date")
        assert result is None

    def test_parse_sunset_date_whitespace(self):
        """测试解析空白日期"""
        result = DeprecationNotifier._parse_sunset_date("   ")
        assert result is None


class TestDeprecationNotifierNotify:
    """测试通知功能"""

    @pytest.mark.asyncio
    async def test_notify_upcoming_deprecation_no_endpoints(self, mock_audit_repo):
        """测试无废弃端点"""
        notifier = DeprecationNotifier(mock_audit_repo)
        result = await notifier.notify_upcoming_deprecation(deprecated_endpoints={})

        assert result == []

    @pytest.mark.asyncio
    async def test_notify_upcoming_deprecation_invalid_date(self, mock_audit_repo):
        """测试无效日期"""
        notifier = DeprecationNotifier(mock_audit_repo)
        result = await notifier.notify_upcoming_deprecation(
            deprecated_endpoints={"/api/v1/old": "invalid-date"}
        )

        assert result == []

    @pytest.mark.asyncio
    async def test_notify_upcoming_deprecation_future_date(self, mock_audit_repo):
        """测试未来日期（不在偏移列表中）"""
        future_date = (datetime.now(timezone.utc) + timedelta(days=100)).strftime("%Y-%m-%d")

        notifier = DeprecationNotifier(mock_audit_repo, day_offsets=[7, 30])
        result = await notifier.notify_upcoming_deprecation(
            deprecated_endpoints={"/api/v1/old": future_date}
        )

        # 100 days is not in [7, 30] offsets
        assert result == []

    @pytest.mark.asyncio
    async def test_notify_upcoming_deprecation_matching_offset(self, mock_audit_repo):
        """测试匹配偏移的日期"""
        # Create a date exactly 7 days from now
        target_date = datetime.now(timezone.utc) + timedelta(days=7)
        date_str = target_date.strftime("%Y-%m-%d")

        mock_audit_repo.create_event = AsyncMock()

        notifier = DeprecationNotifier(mock_audit_repo, day_offsets=[7, 30])
        result = await notifier.notify_upcoming_deprecation(
            deprecated_endpoints={"/api/v1/old": date_str}
        )

        assert len(result) == 1
        assert result[0]["endpoint"] == "/api/v1/old"
        assert result[0]["days_remaining"] == 7

    @pytest.mark.asyncio
    async def test_notify_upcoming_deprecation_critical_severity(self, mock_audit_repo):
        """测试关键严重性"""
        # Create a date exactly 3 days from now
        target_date = datetime.now(timezone.utc) + timedelta(days=3)
        date_str = target_date.strftime("%Y-%m-%d")

        mock_audit_repo.create_event = AsyncMock()

        notifier = DeprecationNotifier(mock_audit_repo, day_offsets=[3, 7])
        result = await notifier.notify_upcoming_deprecation(
            deprecated_endpoints={"/api/v1/old": date_str}
        )

        assert len(result) == 1
        assert result[0]["severity"] == "critical"

    @pytest.mark.asyncio
    async def test_notify_upcoming_deprecation_warning_severity(self, mock_audit_repo):
        """测试警告严重性"""
        # Create a date exactly 30 days from now
        target_date = datetime.now(timezone.utc) + timedelta(days=30)
        date_str = target_date.strftime("%Y-%m-%d")

        mock_audit_repo.create_event = AsyncMock()

        notifier = DeprecationNotifier(mock_audit_repo, day_offsets=[30])
        result = await notifier.notify_upcoming_deprecation(
            deprecated_endpoints={"/api/v1/old": date_str}
        )

        assert len(result) == 1
        assert result[0]["severity"] == "warning"

    @pytest.mark.asyncio
    async def test_notify_upcoming_deprecation_multiple_endpoints(self, mock_audit_repo):
        """测试多个端点"""
        # Create dates that match the offsets
        date_7 = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
        date_30 = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")

        mock_audit_repo.create_event = AsyncMock()

        notifier = DeprecationNotifier(mock_audit_repo, day_offsets=[7, 30])
        result = await notifier.notify_upcoming_deprecation(
            deprecated_endpoints={
                "/api/v1/old1": date_7,
                "/api/v1/old2": date_30,
                "/api/v1/old3": "invalid",  # Should be skipped
            }
        )

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_notify_upcoming_deprecation_past_date(self, mock_audit_repo):
        """测试过去日期"""
        past_date = (datetime.now(timezone.utc) - timedelta(days=10)).strftime("%Y-%m-%d")

        notifier = DeprecationNotifier(mock_audit_repo, day_offsets=[7, 30])
        result = await notifier.notify_upcoming_deprecation(
            deprecated_endpoints={"/api/v1/old": past_date}
        )

        # Past dates have negative days_remaining, not in offsets
        assert result == []


class TestDeprecationNotifierSendNotifications:
    """测试发送通知"""

    @pytest.mark.asyncio
    async def test_send_notifications(self, mock_audit_repo):
        """测试发送通知"""
        notifier = DeprecationNotifier(mock_audit_repo)

        notifications = [
            {"endpoint": "/api/v1/old", "days_remaining": 7, "severity": "warning"}
        ]

        result = await notifier._send_notifications(notifications)

        assert result is None