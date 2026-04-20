from contextlib import asynccontextmanager

from sqlalchemy import text
from fastapi import FastAPI

from backend.api._endpoints import register_operational_endpoints
from backend.api._exceptions import register_exception_handlers
from backend.api._middleware import register_core_middleware
from backend.api._size_guard import register_request_size_middleware
from backend.api.router import api_router
from backend.config.settings import settings
from backend.core.middleware.logging import configure_loguru
from backend.db.session import engine, get_async_session, init_db
from backend.repositories.audit_log import AuditLogRepository
from backend.services.deprecation_notification import DeprecationNotifier


async def _check_db_connection() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@asynccontextmanager
async def lifespan(_application: FastAPI):
    await init_db()
    if settings.ENABLE_DEPRECATION_NOTIFIER_ON_STARTUP:
        async for session in get_async_session():
            notifier = DeprecationNotifier(
                AuditLogRepository(session),
                day_offsets=list(settings.DEPRECATION_NOTIFY_OFFSETS_DAYS),
            )
            await notifier.notify_upcoming_deprecation()
            break
    yield


def create_application() -> FastAPI:
    configure_loguru()
    application = FastAPI(lifespan=lifespan, redirect_slashes=False)
    register_core_middleware(application)
    application.include_router(api_router, prefix="/api/v1")
    register_operational_endpoints(application, _check_db_connection)
    register_request_size_middleware(application)
    register_exception_handlers(application)
    return application


app = create_application()
