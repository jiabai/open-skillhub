"""
Audit Service 测试补充
"""
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.services.audit import AuditService
from backend.repositories.audit_log import AuditLogRepository
from backend.models.audit_log import AuditLog


@pytest.fixture
def mock_audit_repo():
    """Mock audit log repository"""
    return AsyncMock(spec=AuditLogRepository)


@pytest.fixture
def test_audit_log():
    """Create test audit log"""
    log = MagicMock(spec=AuditLog)
    log.id = "log-123"
    log.actor_id = "user-123"
    log.action = "test.action"
    log.target = "target-123"
    log.result = "success"
    log.created_at = datetime.now(timezone.utc)
    return log


class TestAuditServiceCreate:
    """测试创建审计日志"""

    @pytest.mark.asyncio
    async def test_create_event_success(self, mock_audit_repo, test_audit_log):
        """测试成功创建审计事件"""
        mock_audit_repo.create_event = AsyncMock(return_value=test_audit_log)

        service = AuditService(mock_audit_repo)
        await service.create_event(
            actor_id="user-123",
            action="user.login",
            target="user-123",
        )

        mock_audit_repo.create_event.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_event_with_metadata(self, mock_audit_repo, test_audit_log):
        """测试带元数据创建审计事件"""
        mock_audit_repo.create_event = AsyncMock(return_value=test_audit_log)

        service = AuditService(mock_audit_repo)
        await service.create_event(
            actor_id="user-123",
            action="skill.create",
            target="skill-456",
            metadata={"name": "test-skill", "visibility": "private"},
        )

        mock_audit_repo.create_event.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_event_with_ip(self, mock_audit_repo, test_audit_log):
        """测试带 IP 创建审计事件"""
        mock_audit_repo.create_event = AsyncMock(return_value=test_audit_log)

        service = AuditService(mock_audit_repo)
        await service.create_event(
            actor_id="user-123",
            action="auth.login",
            target="user-123",
            ip="192.168.1.1",
        )

        mock_audit_repo.create_event.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_event_with_user_agent(self, mock_audit_repo, test_audit_log):
        """测试带 User-Agent 创建审计事件"""
        mock_audit_repo.create_event = AsyncMock(return_value=test_audit_log)

        service = AuditService(mock_audit_repo)
        await service.create_event(
            actor_id="user-123",
            action="api.request",
            target="/api/v1/skills",
            user_agent="Mozilla/5.0",
        )

        mock_audit_repo.create_event.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_event_with_result(self, mock_audit_repo, test_audit_log):
        """测试带结果创建审计事件"""
        mock_audit_repo.create_event = AsyncMock(return_value=test_audit_log)

        service = AuditService(mock_audit_repo)
        await service.create_event(
            actor_id="user-123",
            action="skill.delete",
            target="skill-456",
            result="failed",
        )

        mock_audit_repo.create_event.assert_called_once()


class TestAuditServiceList:
    """测试列出审计日志"""

    @pytest.mark.asyncio
    async def test_list_events_empty(self, mock_audit_repo):
        """测试空审计日志列表"""
        mock_audit_repo.list_events = AsyncMock(return_value=[])

        service = AuditService(mock_audit_repo)
        await service.list_events(actor_id="user-123")

        mock_audit_repo.list_events.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_events_with_actor(self, mock_audit_repo, test_audit_log):
        """测试按 actor 列出审计日志"""
        mock_audit_repo.list_events = AsyncMock(return_value=[test_audit_log])

        service = AuditService(mock_audit_repo)
        result = await service.list_events(actor_id="user-123")

        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_list_events_with_action(self, mock_audit_repo, test_audit_log):
        """测试按 action 列出审计日志"""
        mock_audit_repo.list_events = AsyncMock(return_value=[test_audit_log])

        service = AuditService(mock_audit_repo)
        await service.list_events(action="user.login")

        mock_audit_repo.list_events.assert_called_once()


class TestAuditServiceExport:
    """测试导出审计日志"""

    def test_export_json(self):
        """测试导出 JSON 格式"""
        items = [
            {
                "id": "log-1",
                "actor_id": "user-123",
                "action": "user.login",
                "target": "user-123",
                "result": "success",
                "timestamp": "2024-01-01T00:00:00Z",
                "ip": "127.0.0.1",
                "user_agent": "test",
                "metadata": {},
            }
        ]

        result = AuditService.export_json(items)

        # Verify it's valid JSON
        parsed = json.loads(result)
        assert len(parsed) == 1
        assert parsed[0]["action"] == "user.login"

    def test_export_csv(self):
        """测试导出 CSV 格式"""
        items = [
            {
                "id": "log-1",
                "actor_id": "user-123",
                "action": "user.login",
                "target": "user-123",
                "result": "success",
                "timestamp": "2024-01-01T00:00:00Z",
                "ip": "127.0.0.1",
                "user_agent": "test",
                "metadata": "{}",
            }
        ]

        result = AuditService.export_csv(items)

        # Verify it contains expected content
        assert "user.login" in result
        assert "user-123" in result

    def test_export_csv_multiple_items(self):
        """测试导出多条 CSV"""
        items = [
            {
                "id": f"log-{i}",
                "actor_id": "user-123",
                "action": f"action.{i}",
                "target": "target",
                "result": "success",
                "timestamp": "2024-01-01T00:00:00Z",
                "ip": "127.0.0.1",
                "user_agent": "test",
                "metadata": "{}",
            }
            for i in range(3)
        ]

        result = AuditService.export_csv(items)

        assert "action.0" in result
        assert "action.1" in result
        assert "action.2" in result