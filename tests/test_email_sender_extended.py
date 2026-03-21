"""
Email Sender 服务测试
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from skillhub.config.settings import settings
from skillhub.services.email_sender import (
    SmtpEmailSender,
    AliyunEmailSender,
    render_verification_email,
    _sign_aliyun_params,
    _percent_encode,
    get_email_sender,
)


class TestRenderVerificationEmail:
    """测试邮件渲染"""

    def test_render_verification_email(self):
        """测试渲染验证邮件"""
        subject, text, html = render_verification_email(
            brand="TestBrand",
            code="123456",
            expires_in=300,
            resend_interval=60,
            purpose="login",
        )

        assert "TestBrand" in subject
        assert "123456" in subject or "123456" in text
        assert "123456" in text
        assert "123456" in html
        assert "login" in text.lower() or "login" in html.lower()


class TestSmtpEmailSender:
    """SMTP 邮件发送测试"""

    def test_smtp_not_configured(self):
        """测试 SMTP 未配置"""
        sender = SmtpEmailSender(
            host="",
            port=587,
            username="user",
            password="pass",
            from_address="",
            use_tls=True,
        )

        with pytest.raises(ValueError, match="SMTP settings are not configured"):
            sender.send_verification_code(
                email="test@example.com",
                code="123456",
                expires_in=300,
                resend_interval=60,
                purpose="login",
            )

    def test_smtp_send_success(self):
        """测试 SMTP 发送成功"""
        sender = SmtpEmailSender(
            host="smtp.example.com",
            port=587,
            username="user",
            password="pass",
            from_address="noreply@example.com",
            use_tls=True,
        )

        with patch('smtplib.SMTP') as mock_smtp_class:
            mock_server = MagicMock()
            mock_server.ehlo = MagicMock()
            mock_server.starttls = MagicMock()
            mock_server.login = MagicMock()
            mock_server.send_message = MagicMock()
            mock_server.__enter__ = MagicMock(return_value=mock_server)
            mock_server.__exit__ = MagicMock(return_value=None)
            mock_smtp_class.return_value = mock_server

            sender.send_verification_code(
                email="test@example.com",
                code="123456",
                expires_in=300,
                resend_interval=60,
                purpose="login",
            )

            mock_server.send_message.assert_called_once()

    def test_smtp_send_no_auth(self):
        """测试 SMTP 无认证发送"""
        sender = SmtpEmailSender(
            host="smtp.example.com",
            port=25,
            username="",
            password="",
            from_address="noreply@example.com",
            use_tls=False,
        )

        with patch('smtplib.SMTP') as mock_smtp_class:
            mock_server = MagicMock()
            mock_server.ehlo = MagicMock()
            mock_server.send_message = MagicMock()
            mock_server.__enter__ = MagicMock(return_value=mock_server)
            mock_server.__exit__ = MagicMock(return_value=None)
            mock_smtp_class.return_value = mock_server

            sender.send_verification_code(
                email="test@example.com",
                code="123456",
                expires_in=300,
                resend_interval=60,
                purpose="register",
            )

            mock_server.login.assert_not_called()


class TestAliyunEmailSender:
    """阿里云邮件发送测试"""

    def test_aliyun_not_configured(self):
        """测试阿里云未配置"""
        sender = AliyunEmailSender(
            access_key_id="",
            access_key_secret="",
            account_name="",
        )

        with pytest.raises(ValueError, match="Aliyun DM settings are not configured"):
            sender.send_verification_code(
                email="test@example.com",
                code="123456",
                expires_in=300,
                resend_interval=60,
                purpose="login",
            )

    def test_aliyun_send_success(self):
        """测试阿里云发送成功"""
        sender = AliyunEmailSender(
            access_key_id="test-key-id",
            access_key_secret="test-secret",
            account_name="test@test.com",
            from_alias="TestSender",
            reply_to_address=True,
        )

        with patch('httpx.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"Code": "OK"}
            mock_response.content = b'{"Code": "OK"}'
            mock_post.return_value = mock_response

            sender.send_verification_code(
                email="test@example.com",
                code="123456",
                expires_in=300,
                resend_interval=60,
                purpose="login",
            )

            mock_post.assert_called_once()

    def test_aliyun_send_failure(self):
        """测试阿里云发送失败"""
        sender = AliyunEmailSender(
            access_key_id="test-key-id",
            access_key_secret="test-secret",
            account_name="test@test.com",
        )

        with patch('httpx.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 500
            mock_post.return_value = mock_response

            with pytest.raises(ValueError, match="Aliyun DM request failed"):
                sender.send_verification_code(
                    email="test@example.com",
                    code="123456",
                    expires_in=300,
                    resend_interval=60,
                    purpose="login",
                )

    def test_aliyun_send_error_response(self):
        """测试阿里云返回错误"""
        sender = AliyunEmailSender(
            access_key_id="test-key-id",
            access_key_secret="test-secret",
            account_name="test@test.com",
        )

        with patch('httpx.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"Code": "InvalidParameterValue", "Message": "Invalid email"}
            mock_response.content = b'{"Code": "InvalidParameterValue", "Message": "Invalid email"}'
            mock_post.return_value = mock_response

            with pytest.raises(ValueError, match="Invalid email"):
                sender.send_verification_code(
                    email="test@example.com",
                    code="123456",
                    expires_in=300,
                    resend_interval=60,
                    purpose="login",
                )


class TestAliyunSigning:
    """测试阿里云签名"""

    def test_percent_encode(self):
        """测试 URL 编码"""
        result = _percent_encode("hello world")
        assert result == "hello%20world"

    def test_sign_aliyun_params(self):
        """测试签名生成"""
        params = {
            "Action": "SingleSendMail",
            "AccessKeyId": "test-key",
            "Format": "JSON",
        }
        signature = _sign_aliyun_params(params, "test-secret")

        assert isinstance(signature, str)
        assert len(signature) > 0


class TestGetEmailSender:
    """测试获取邮件发送器"""

    def test_get_email_sender_debug_mode(self):
        """测试调试模式获取 SMTP 发送器"""
        with patch.object(settings, 'DEBUG', True):
            with patch.object(settings, 'SMTP_HOST', 'smtp.example.com'):
                with patch.object(settings, 'SMTP_PORT', 587):
                    with patch.object(settings, 'SMTP_USERNAME', 'user'):
                        with patch.object(settings, 'SMTP_PASSWORD', 'pass'):
                            with patch.object(settings, 'SMTP_FROM', 'noreply@example.com'):
                                with patch.object(settings, 'SMTP_USE_TLS', True):
                                    sender = get_email_sender()
                                    assert isinstance(sender, SmtpEmailSender)

    def test_get_email_sender_production_mode(self):
        """测试生产模式获取阿里云发送器"""
        with patch.object(settings, 'DEBUG', False):
            with patch.object(settings, 'ALIYUN_DM_ACCESS_KEY_ID', 'key'):
                with patch.object(settings, 'ALIYUN_DM_ACCESS_KEY_SECRET', 'secret'):
                    with patch.object(settings, 'ALIYUN_DM_ACCOUNT_NAME', 'test@test.com'):
                        with patch.object(settings, 'ALIYUN_DM_FROM_ALIAS', 'Test'):
                            with patch.object(settings, 'ALIYUN_DM_REPLY_TO_ADDRESS', True):
                                with patch.object(settings, 'ALIYUN_DM_ENDPOINT', 'https://dm.aliyuncs.com/'):
                                    sender = get_email_sender()
                                    assert isinstance(sender, AliyunEmailSender)