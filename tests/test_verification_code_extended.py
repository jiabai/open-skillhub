"""
Verification Code Service 完整测试
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.config.settings import settings
from backend.services.verification_code import (
    VerificationCodeService,
    CodeRecord,
    get_verification_service,
)
from backend.models.verification_code import VerificationCode


@pytest.fixture
def mock_session():
    """Mock database session"""
    session = AsyncMock()
    return session


@pytest.fixture
def mock_email_sender():
    """Mock email sender"""
    sender = MagicMock()
    sender.send_verification_code = MagicMock()
    return sender


class TestVerificationCodeServiceMethods:
    """测试内部方法"""

    def test_normalize_email(self, mock_session):
        """测试邮箱规范化"""
        service = VerificationCodeService(mock_session)
        result = service._normalize("  TEST@Example.COM  ")
        assert result == "test@example.com"

    def test_hash_code(self, mock_session):
        """测试验证码哈希"""
        service = VerificationCodeService(mock_session)
        hash1 = service._hash_code("123456")
        hash2 = service._hash_code("123456")
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 hex length

    def test_generate_code_debug(self, mock_session):
        """测试调试模式生成验证码"""
        with patch.object(settings, 'DEBUG', True):
            service = VerificationCodeService(mock_session, code_length=6)
            code = service._generate_code()
            assert code == "123456"

    def test_generate_code_production(self, mock_session):
        """测试生产模式生成验证码"""
        with patch.object(settings, 'DEBUG', False):
            service = VerificationCodeService(mock_session, code_length=6)
            code = service._generate_code()
            assert len(code) == 6
            assert code.isdigit()

    def test_ensure_aware_with_tz(self, mock_session):
        """测试带时区的时间"""
        service = VerificationCodeService(mock_session)
        dt = datetime(2024, 1, 1, tzinfo=timezone.utc)
        result = service._ensure_aware(dt)
        assert result.tzinfo is not None

    def test_ensure_aware_without_tz(self, mock_session):
        """测试无时区的时间"""
        service = VerificationCodeService(mock_session)
        dt = datetime(2024, 1, 1)
        result = service._ensure_aware(dt)
        assert result.tzinfo is not None


class TestVerificationCodeServiceSend:
    """测试发送验证码"""

    @pytest.mark.asyncio
    async def test_send_code_success(self, mock_session, mock_email_sender):
        """测试成功发送验证码"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()

        service = VerificationCodeService(mock_session, email_sender=mock_email_sender)

        with patch.object(settings, 'DEBUG', True):
            result = await service.send_code("test@example.com", "login")

        assert result["sent"] is True
        assert "expires_in" in result

    @pytest.mark.asyncio
    async def test_send_code_resend_too_frequent(self, mock_session, mock_email_sender):
        """测试重发过于频繁"""
        existing = MagicMock(spec=VerificationCode)
        existing.resend_available_at = datetime.now(timezone.utc) + timedelta(minutes=5)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        mock_session.execute = AsyncMock(return_value=mock_result)

        service = VerificationCodeService(mock_session, email_sender=mock_email_sender)

        with pytest.raises(ValueError, match="RESEND_TOO_FREQUENT"):
            await service.send_code("test@example.com", "login")

    @pytest.mark.asyncio
    async def test_send_code_update_existing(self, mock_session, mock_email_sender):
        """测试更新已有验证码"""
        existing = MagicMock(spec=VerificationCode)
        existing.resend_available_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        existing.code_hash = "old_hash"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()

        service = VerificationCodeService(mock_session, email_sender=mock_email_sender)

        with patch.object(settings, 'DEBUG', True):
            result = await service.send_code("test@example.com", "login")

        assert result["sent"] is True
        # Verify the existing record was updated
        assert existing.code_hash != "old_hash"


class TestVerificationCodeServiceVerify:
    """测试验证验证码"""

    @pytest.mark.asyncio
    async def test_verify_code_success(self, mock_session):
        """测试成功验证"""
        service = VerificationCodeService(mock_session)

        # Generate expected hash for "123456"
        code_hash = service._hash_code("123456")

        existing = MagicMock(spec=VerificationCode)
        existing.code_hash = code_hash
        existing.expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        existing.attempts_left = 5

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()

        await service.verify_code("test@example.com", "login", "123456")

    @pytest.mark.asyncio
    async def test_verify_code_not_found(self, mock_session):
        """测试验证码不存在"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        service = VerificationCodeService(mock_session)

        with pytest.raises(ValueError, match="CODE_INVALID"):
            await service.verify_code("test@example.com", "login", "123456")

    @pytest.mark.asyncio
    async def test_verify_code_expired(self, mock_session):
        """测试验证码过期"""
        service = VerificationCodeService(mock_session)

        existing = MagicMock(spec=VerificationCode)
        existing.code_hash = service._hash_code("123456")
        existing.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        existing.attempts_left = 5

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()

        with pytest.raises(ValueError, match="CODE_EXPIRED"):
            await service.verify_code("test@example.com", "login", "123456")

    @pytest.mark.asyncio
    async def test_verify_code_too_many_attempts(self, mock_session):
        """测试尝试次数过多"""
        service = VerificationCodeService(mock_session)

        existing = MagicMock(spec=VerificationCode)
        existing.code_hash = service._hash_code("123456")
        existing.expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        existing.attempts_left = 0

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        mock_session.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="TOO_MANY_ATTEMPTS"):
            await service.verify_code("test@example.com", "login", "123456")

    @pytest.mark.asyncio
    async def test_verify_code_wrong_code(self, mock_session):
        """测试错误验证码"""
        service = VerificationCodeService(mock_session)

        existing = MagicMock(spec=VerificationCode)
        existing.code_hash = service._hash_code("123456")
        existing.expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        existing.attempts_left = 5

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.commit = AsyncMock()

        with pytest.raises(ValueError, match="CODE_INVALID"):
            await service.verify_code("test@example.com", "login", "654321")

        # Verify attempts were decremented
        assert existing.attempts_left == 4


class TestGetVerificationService:
    """测试获取验证服务"""

    def test_get_verification_service(self, mock_session):
        """测试获取服务实例"""
        service = get_verification_service(mock_session)
        assert isinstance(service, VerificationCodeService)