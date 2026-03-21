"""
Repository 测试补充
覆盖 team 和 enterprise repositories
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from skillhub.repositories.team import TeamRepository
from skillhub.repositories.enterprise import EnterpriseRepository
from skillhub.models.team import Team
from skillhub.models.enterprise import Enterprise


@pytest.fixture
def mock_session():
    """Mock database session"""
    session = AsyncMock()
    return session


@pytest.fixture
def test_team():
    """Create test team"""
    team = MagicMock(spec=Team)
    team.id = "team-123"
    team.name = "Test Team"
    team.external_id = "ext-team-123"
    team.enterprise_id = "ent-123"
    return team


@pytest.fixture
def test_enterprise():
    """Create test enterprise"""
    enterprise = MagicMock(spec=Enterprise)
    enterprise.id = "ent-123"
    enterprise.name = "Test Enterprise"
    enterprise.external_id = "ext-ent-123"
    return enterprise


class TestTeamRepository:
    """测试团队仓库"""

    @pytest.mark.asyncio
    async def test_get_by_external_id(self, mock_session, test_team):
        """测试通过外部 ID 获取团队"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = test_team
        mock_session.execute = AsyncMock(return_value=mock_result)

        repo = TeamRepository(mock_session)
        result = await repo.get_by_external_id("ext-team-123")

        mock_session.execute.assert_called_once()
        assert result == test_team

    @pytest.mark.asyncio
    async def test_get_by_external_id_not_found(self, mock_session):
        """测试外部 ID 不存在"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        repo = TeamRepository(mock_session)
        result = await repo.get_by_external_id("non-existent")

        assert result is None

    @pytest.mark.asyncio
    async def test_create(self, mock_session, test_team):
        """测试创建团队"""
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()

        repo = TeamRepository(mock_session)
        result = await repo.create(
            name="New Team",
            external_id="ext-new-team",
            enterprise_id="ent-123",
        )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()


class TestEnterpriseRepository:
    """测试企业仓库"""

    @pytest.mark.asyncio
    async def test_get_by_external_id(self, mock_session, test_enterprise):
        """测试通过外部 ID 获取企业"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = test_enterprise
        mock_session.execute = AsyncMock(return_value=mock_result)

        repo = EnterpriseRepository(mock_session)
        result = await repo.get_by_external_id("ext-ent-123")

        mock_session.execute.assert_called_once()
        assert result == test_enterprise

    @pytest.mark.asyncio
    async def test_get_by_external_id_not_found(self, mock_session):
        """测试外部 ID 不存在"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        repo = EnterpriseRepository(mock_session)
        result = await repo.get_by_external_id("non-existent")

        assert result is None

    @pytest.mark.asyncio
    async def test_create(self, mock_session, test_enterprise):
        """测试创建企业"""
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()

        repo = EnterpriseRepository(mock_session)
        result = await repo.create(
            name="New Enterprise",
            external_id="ext-new-ent",
        )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()


class TestEnterpriseRepositoryFull:
    """完整的企业仓库测试"""

    @pytest.mark.asyncio
    async def test_get_by_external_id_with_name(self, mock_session):
        """测试带名称的外部 ID 查询"""
        enterprise = MagicMock(spec=Enterprise)
        enterprise.id = "ent-456"
        enterprise.name = "Another Enterprise"
        enterprise.external_id = "ext-ent-456"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = enterprise
        mock_session.execute = AsyncMock(return_value=mock_result)

        repo = EnterpriseRepository(mock_session)
        result = await repo.get_by_external_id("ext-ent-456")

        assert result.name == "Another Enterprise"

    @pytest.mark.asyncio
    async def test_create_with_all_fields(self, mock_session):
        """测试创建带所有字段的企业"""
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()

        repo = EnterpriseRepository(mock_session)
        result = await repo.create(
            name="Full Enterprise",
            external_id="ext-full-ent",
        )

        # Verify add was called with an Enterprise instance
        call_args = mock_session.add.call_args
        assert isinstance(call_args.args[0], Enterprise)


class TestTeamRepositoryFull:
    """完整的团队仓库测试"""

    @pytest.mark.asyncio
    async def test_create_with_all_fields(self, mock_session):
        """测试创建带所有字段的团队"""
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()

        repo = TeamRepository(mock_session)
        result = await repo.create(
            name="Full Team",
            external_id="ext-full-team",
            enterprise_id="ent-123",
        )

        # Verify add was called with a Team instance
        call_args = mock_session.add.call_args
        assert isinstance(call_args.args[0], Team)