import base64
import hashlib
import hmac
import smtplib
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Protocol
from urllib.parse import quote

import httpx

from backend.config.settings import settings


class EmailSender(Protocol):
    def send_verification_code(
        self,
        email: str,
        code: str,
        expires_in: int,
        resend_interval: int,
        purpose: str,
    ) -> None: ...


def render_verification_email(
    brand: str,
    code: str,
    expires_in: int,
    resend_interval: int,
    purpose: str,
) -> tuple[str, str, str]:
    subject = f"{brand} 验证码"
    text = (
        f"{brand} 验证码：{code}\n"
        f"有效期：{expires_in} 秒\n"
        f"重发间隔：{resend_interval} 秒\n"
        f"用途：{purpose}\n\n"
        f"Your verification code is {code}\n"
        f"Expires in {expires_in} seconds\n"
        f"Resend interval {resend_interval} seconds\n"
        f"Purpose: {purpose}"
    )
    html = (
        f"<p><strong>{brand}</strong></p>"
        f"<p>验证码：<strong>{code}</strong></p>"
        f"<p>有效期：{expires_in} 秒</p>"
        f"<p>重发间隔：{resend_interval} 秒</p>"
        f"<p>用途：{purpose}</p>"
        f"<hr/>"
        f"<p>Your verification code is <strong>{code}</strong></p>"
        f"<p>Expires in {expires_in} seconds</p>"
        f"<p>Resend interval {resend_interval} seconds</p>"
        f"<p>Purpose: {purpose}</p>"
    )
    return subject, text, html


class SmtpEmailSender:
    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        from_address: str,
        use_tls: bool = True,
        timeout: int = 10,
    ):
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._from_address = from_address
        self._use_tls = use_tls
        self._timeout = timeout

    def send_verification_code(
        self,
        email: str,
        code: str,
        expires_in: int,
        resend_interval: int,
        purpose: str,
    ) -> None:
        if not self._host or not self._from_address:
            raise ValueError("SMTP settings are not configured")
        subject, text, html = render_verification_email(
            brand="SkillDrive",
            code=code,
            expires_in=expires_in,
            resend_interval=resend_interval,
            purpose=purpose,
        )
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = self._from_address
        message["To"] = email
        message.set_content(text)
        message.add_alternative(html, subtype="html")
        if self._port == 465:
            with smtplib.SMTP_SSL(self._host, self._port, timeout=self._timeout) as server:
                if self._username:
                    server.login(self._username, self._password)
                server.send_message(message)
        else:
            with smtplib.SMTP(self._host, self._port, timeout=self._timeout) as server:
                server.ehlo()
                if self._use_tls:
                    server.starttls()
                    server.ehlo()
                if self._username:
                    server.login(self._username, self._password)
                server.send_message(message)


class AliyunEmailSender:
    def __init__(
        self,
        access_key_id: str,
        access_key_secret: str,
        account_name: str,
        from_alias: str | None = None,
        reply_to_address: bool = True,
        endpoint: str = "https://dm.aliyuncs.com/",
        timeout: int = 10,
    ):
        self._access_key_id = access_key_id
        self._access_key_secret = access_key_secret
        self._account_name = account_name
        self._from_alias = from_alias or None
        self._reply_to_address = reply_to_address
        self._endpoint = endpoint
        self._timeout = timeout

    def send_verification_code(
        self,
        email: str,
        code: str,
        expires_in: int,
        resend_interval: int,
        purpose: str,
    ) -> None:
        if not self._access_key_id or not self._access_key_secret or not self._account_name:
            raise ValueError("Aliyun DM settings are not configured")
        subject, _, html = render_verification_email(
            brand="SkillDrive",
            code=code,
            expires_in=expires_in,
            resend_interval=resend_interval,
            purpose=purpose,
        )
        params = {
            "Action": "SingleSendMail",
            "AccountName": self._account_name,
            "ReplyToAddress": "true" if self._reply_to_address else "false",
            "AddressType": "1",
            "ToAddress": email,
            "Subject": subject,
            "HtmlBody": html,
            "Format": "JSON",
            "Version": "2015-11-23",
            "AccessKeyId": self._access_key_id,
            "SignatureMethod": "HMAC-SHA1",
            "Timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "SignatureVersion": "1.0",
            "SignatureNonce": str(uuid.uuid4()),
        }
        if self._from_alias:
            params["FromAlias"] = self._from_alias
        params["Signature"] = _sign_aliyun_params(params, self._access_key_secret)
        response = httpx.post(self._endpoint, data=params, timeout=self._timeout)
        if response.status_code != 200:
            raise ValueError("Aliyun DM request failed")
        payload = response.json() if response.content else {}
        if isinstance(payload, dict) and payload.get("Code") not in (None, "OK"):
            message = payload.get("Message") or "Aliyun DM error"
            raise ValueError(message)


def _percent_encode(value: str) -> str:
    return quote(str(value), safe="-_.~")


def _sign_aliyun_params(params: dict[str, str], secret: str) -> str:
    canonicalized = "&".join(
        f"{_percent_encode(key)}={_percent_encode(value)}" for key, value in sorted(params.items())
    )
    string_to_sign = f"POST&%2F&{_percent_encode(canonicalized)}"
    signature = hmac.new(
        f"{secret}&".encode("utf-8"),
        string_to_sign.encode("utf-8"),
        hashlib.sha1,
    ).digest()
    return base64.b64encode(signature).decode("utf-8")


def get_email_sender() -> EmailSender:
    if settings.DEBUG:
        return SmtpEmailSender(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            from_address=settings.SMTP_FROM,
            use_tls=settings.SMTP_USE_TLS,
        )
    return AliyunEmailSender(
        access_key_id=settings.ALIYUN_DM_ACCESS_KEY_ID,
        access_key_secret=settings.ALIYUN_DM_ACCESS_KEY_SECRET,
        account_name=settings.ALIYUN_DM_ACCOUNT_NAME,
        from_alias=settings.ALIYUN_DM_FROM_ALIAS or None,
        reply_to_address=settings.ALIYUN_DM_REPLY_TO_ADDRESS,
        endpoint=settings.ALIYUN_DM_ENDPOINT,
    )
