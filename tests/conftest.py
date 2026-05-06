import os
import re
import sys
import tempfile
from pathlib import Path
from typing import AsyncGenerator
from uuid import uuid4

import pytest

# Set env vars BEFORE any imports to override .env loaded by FlowLLM
# This must be at module level to run before pytest imports test modules
ROOT = Path(__file__).resolve().parents[1]
RUN_ID = uuid4().hex
TMP_BASE = Path(tempfile.gettempdir()) / "skilldrive-pytest"
TMP_ROOT = TMP_BASE / RUN_ID
TMP_ROOT.mkdir(parents=True, exist_ok=True)
TEST_DB_PATH = TMP_ROOT / "skillhub-test.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "a" * 32
os.environ["DEBUG"] = "true"
os.environ["CORS_ORIGINS"] = '["http://localhost:3000"]'
os.environ["FLOW_LLM_API_KEY"] = "key"
os.environ["FLOW_LLM_BASE_URL"] = "https://api.example.com/v1"
os.environ["ENABLE_PUBLIC_SIGNUP"] = "true"
os.environ["ENABLE_EMAIL_OTP_LOGIN"] = "true"
os.environ["ENABLE_SSO"] = "true"
os.environ["ENABLE_LDAP"] = "true"
os.environ["ENABLE_ORG_MODEL"] = "true"
os.environ["ENABLE_RBAC"] = "true"
os.environ["ENABLE_SKILL_VISIBILITY"] = "true"
os.environ["ENABLE_AUDIT_LOG"] = "true"
os.environ["ENABLE_AUDIT_EXPORT"] = "true"
os.environ["ENABLE_SKILL_DOWNLOAD_ENCRYPTION"] = "true"
os.environ["ENABLE_LOCAL_CACHE_ENCRYPTION"] = "true"
os.environ["SKILL_STORAGE_PATH"] = str(TMP_ROOT.as_posix())
os.environ["ENABLE_RATE_LIMIT"] = "true"
os.environ["ENABLE_METRICS"] = "true"
os.environ["LOG_FILE"] = str(TMP_ROOT / "app.log")
os.environ["SSO_JWT_SECRET"] = "test-sso-secret-key-at-least-32ch"
os.environ["SSO_JWT_ISSUER"] = "test-issuer"
os.environ["SSO_JWT_AUDIENCE"] = "skillhub"
os.environ["SSO_ISSUER"] = "https://sso.example.com"
os.environ["SSO_CLIENT_ID"] = "skillhub-web"
os.environ["SSO_CLIENT_SECRET"] = "test-client-secret"
os.environ["SSO_AUTHORIZATION_ENDPOINT"] = "https://sso.example.com/oauth2/authorize"
os.environ["SSO_TOKEN_ENDPOINT"] = "https://sso.example.com/oauth2/token"
os.environ["SSO_REDIRECT_URI"] = "http://test/api/v1/auth/sso/callback"
os.environ["SSO_FRONTEND_CALLBACK_URL"] = "http://frontend.test/login/sso/callback"
os.environ["RBAC_ROLE_PERMISSIONS"] = '{"admin":["*"],"member":["dashboard.read","skill.list","skill.read","skill.create","skill.update","skill.delete","skill.upload"],"viewer":["dashboard.read","skill.list","skill.read"]}'
os.environ["PYTEST_DEBUG_TEMPROOT"] = str(TMP_ROOT)

import pytest_asyncio  # noqa: E402
import httpx  # noqa: E402
from sqlalchemy import delete  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class _NoopEmailSender:
    def send_verification_code(
        self,
        email: str,
        code: str,
        expires_in: int,
        resend_interval: int,
        purpose: str,
    ) -> None:
        return None


class TestVerificationCodeService:
    """Deterministic verification service for API tests."""

    def __init__(self, session: AsyncSession):
        from backend.services.verification_code import VerificationCodeService

        class _DeterministicVerificationCodeService(VerificationCodeService):
            def _generate_code(self) -> str:
                return "123456"

        self._service = _DeterministicVerificationCodeService(
            session,
            email_sender=_NoopEmailSender(),
        )

    async def send_code(self, email, purpose, schedule=None):
        result = await self._service.send_code(email, purpose, schedule=schedule)
        return {"test_code": "123456", **result}

    async def verify_code(self, email, purpose, code):
        await self._service.verify_code(email, purpose, code)


import backend.services.verification_code as vc_module  # noqa: E402

_original_generate_code = vc_module.VerificationCodeService._generate_code


def _patched_generate_code(self):
    from backend.config.settings import settings

    if settings.DEBUG:
        return "123456"
    return _original_generate_code(self)


vc_module.VerificationCodeService._generate_code = _patched_generate_code


@pytest.fixture
def tmp_path(request) -> Path:
    node_name = re.sub(r"[^A-Za-z0-9._-]+", "-", request.node.name).strip("-") or "tmp"
    path = TMP_ROOT / f"{node_name}-{uuid4().hex}"
    path.mkdir(parents=True, exist_ok=False)
    return path


@pytest_asyncio.fixture(scope="session")
async def async_engine():
    from backend import models as _models
    from backend.models.base import Base
    _ = _models.__all__

    TMP_ROOT.mkdir(parents=True, exist_ok=True)
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink(missing_ok=True)

    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield engine
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest_asyncio.fixture
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    session_maker = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)
    async with session_maker() as session:
        yield session


@pytest_asyncio.fixture(autouse=True)
async def reset_database(async_session: AsyncSession):
    from backend import models as _models
    from backend.models.base import Base

    _ = _models.__all__
    for table in reversed(Base.metadata.sorted_tables):
        await async_session.execute(delete(table))
    await async_session.commit()
    yield


@pytest_asyncio.fixture
async def app(async_session) -> AsyncGenerator:
    from backend.api_app import create_application
    from backend.api.v1 import auth as auth_api
    from backend.api.v1 import users as users_api
    from backend.db.session import get_async_session

    application = create_application()

    async def _override_session():
        yield async_session

    def _mock_get_verification_service(session):
        return TestVerificationCodeService(session)

    application.dependency_overrides[get_async_session] = _override_session
    original_auth_service = auth_api.get_verification_service
    original_users_service = users_api.get_verification_service
    auth_api.get_verification_service = _mock_get_verification_service
    users_api.get_verification_service = _mock_get_verification_service
    yield application
    auth_api.get_verification_service = original_auth_service
    users_api.get_verification_service = original_users_service
    application.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app) -> AsyncGenerator[httpx.AsyncClient, None]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as session_client:
        yield session_client
