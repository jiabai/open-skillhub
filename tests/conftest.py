import os
import sys
from pathlib import Path
from typing import AsyncGenerator

import pytest_asyncio
import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _set_default_env():
    os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    os.environ.setdefault("SECRET_KEY", "a" * 32)
    os.environ.setdefault("DEBUG", "true")
    os.environ.setdefault("CORS_ORIGINS", '["http://localhost:3000"]')
    os.environ.setdefault("FLOW_LLM_API_KEY", "key")
    os.environ.setdefault("FLOW_LLM_BASE_URL", "https://api.example.com/v1")
    os.environ.setdefault("ENABLE_PUBLIC_SIGNUP", "true")
    os.environ.setdefault("ENABLE_EMAIL_OTP_LOGIN", "true")
    os.environ.setdefault("ENABLE_SSO", "true")
    os.environ.setdefault("ENABLE_LDAP", "true")
    os.environ.setdefault("ENABLE_ORG_MODEL", "true")
    os.environ.setdefault("ENABLE_RBAC", "true")
    os.environ.setdefault("ENABLE_SKILL_VISIBILITY", "true")
    os.environ.setdefault("ENABLE_AUDIT_LOG", "true")
    os.environ.setdefault("ENABLE_AUDIT_EXPORT", "true")
    os.environ.setdefault("ENABLE_SKILL_DOWNLOAD_ENCRYPTION", "true")
    os.environ.setdefault("ENABLE_LOCAL_CACHE_ENCRYPTION", "true")
    os.environ.setdefault("ENABLE_RATE_LIMIT", "true")
    os.environ.setdefault("ENABLE_METRICS", "true")
    os.environ.setdefault("SSO_JWT_SECRET", "test-sso-secret")
    os.environ.setdefault("SSO_JWT_ISSUER", "test-issuer")
    os.environ.setdefault("SSO_JWT_AUDIENCE", "skillhub")


_set_default_env()


@pytest_asyncio.fixture(scope="session")
async def async_engine():
    from skillhub import models as _models
    from skillhub.models.base import Base
    _ = _models.__all__

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


@pytest_asyncio.fixture
async def app(async_session) -> AsyncGenerator:
    from skillhub.api_app import create_application
    from skillhub.db.session import get_async_session

    application = create_application()

    async def _override_session():
        yield async_session

    application.dependency_overrides[get_async_session] = _override_session
    yield application
    application.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app) -> AsyncGenerator[httpx.AsyncClient, None]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as session_client:
        yield session_client
