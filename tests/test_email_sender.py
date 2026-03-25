import pytest

from backend.config.settings import settings
from backend.services.verification_code import VerificationCodeService


class DummySender:
    def __init__(self):
        self.calls = []

    def send_verification_code(
        self,
        email: str,
        code: str,
        expires_in: int,
        resend_interval: int,
        purpose: str,
    ) -> None:
        self.calls.append((email, code, expires_in, resend_interval, purpose))


@pytest.mark.asyncio
async def test_verification_code_sends_email(async_session, monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", True)
    sender = DummySender()
    service = VerificationCodeService(async_session, email_sender=sender)
    response = await service.send_code("test@example.com", "login")
    assert response["sent"] is True
    assert sender.calls == [
        ("test@example.com", "123456", response["expires_in"], response["resend_interval"], "login")
    ]


@pytest.mark.asyncio
async def test_verification_code_persists_and_verifies(async_session, monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", True)
    sender = DummySender()
    service = VerificationCodeService(async_session, email_sender=sender)
    await service.send_code("persist@example.com", "register")
    await service.verify_code("persist@example.com", "register", "123456")
    response = await service.send_code("persist@example.com", "register")
    assert response["sent"] is True


def test_email_sender_selects_smtp_in_debug(monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", True)
    from backend.services.email_sender import get_email_sender, SmtpEmailSender

    sender = get_email_sender()
    assert isinstance(sender, SmtpEmailSender)


def test_email_sender_selects_aliyun_in_production(monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", False)
    from backend.services.email_sender import AliyunEmailSender, get_email_sender

    sender = get_email_sender()
    assert isinstance(sender, AliyunEmailSender)


def test_verification_email_template_contains_brand_and_bilingual_text():
    from backend.services.email_sender import render_verification_email

    subject, text, html = render_verification_email(
        brand="SkillHub",
        code="123456",
        expires_in=300,
        resend_interval=60,
        purpose="login",
    )
    assert "SkillHub" in subject
    assert "验证码" in text
    assert "verification code" in text.lower()
    assert "resend interval" in text.lower()
    assert "SkillHub" in html
