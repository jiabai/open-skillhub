from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
import psutil

from backend.api.router import api_router
from backend.config.settings import settings
from backend.core.errors import (
    error_code_for_status,
    error_payload as build_error_payload,
    error_payload_from_exception as build_error_payload_from_exception,
)
from backend.core.middleware.deprecation import DeprecationMiddleware
from backend.core.middleware.logging import RequestLoggingMiddleware, configure_loguru
from backend.core.middleware.rate_limit import RateLimitMiddleware
from backend.db.session import engine, get_async_session, init_db
from backend.repositories.audit_log import AuditLogRepository
from backend.services.deprecation_notification import DeprecationNotifier


def _error_payload(detail: object, code: str) -> dict:
    return build_error_payload(detail, code)


def _code_for_status(status_code: int) -> str:
    return error_code_for_status(status_code)


def _error_payload_from_exception(detail: object, status_code: int) -> dict:
    return build_error_payload_from_exception(detail, status_code)


async def _check_db_connection() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def _register_core_middleware(application: FastAPI) -> None:
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(RequestLoggingMiddleware)
    application.add_middleware(RateLimitMiddleware)
    if settings.ENABLE_DEPRECATION_HEADERS:
        application.add_middleware(
            DeprecationMiddleware,
            deprecated_endpoints=settings.DEPRECATED_ENDPOINTS,
            deprecated_versions=settings.DEPRECATED_VERSIONS,
            version_sunset_date=settings.DEPRECATED_VERSION_SUNSET_DATE,
        )


def _register_routes(application: FastAPI) -> None:
    application.include_router(api_router, prefix="/api/v1")


def _health_content(db_connected: bool) -> dict[str, bool | str]:
    status_value = "healthy" if db_connected else "unhealthy"
    return {"status": status_value, "db_connected": db_connected}


async def _readiness_response() -> JSONResponse:
    db_connected = await _check_db_connection()
    status_code = 200 if db_connected else 503
    return JSONResponse(status_code=status_code, content=_health_content(db_connected))


def _register_operational_endpoints(application: FastAPI) -> None:
    @application.get("/livez")
    async def livez():
        return JSONResponse(status_code=200, content={"status": "alive"})

    @application.get("/readyz")
    async def readyz():
        return await _readiness_response()

    @application.get("/health")
    async def health():
        return await _readiness_response()

    @application.get("/metrics")
    async def metrics():
        if not settings.ENABLE_METRICS:
            raise HTTPException(status_code=404, detail="Metrics disabled")
        db_connected = await _check_db_connection()
        skill_path = Path(settings.SKILL_STORAGE_PATH)
        disk_root = skill_path if skill_path.exists() else skill_path.parent
        disk_usage_percent = None
        try:
            disk = psutil.disk_usage(str(disk_root))
            disk_usage_percent = disk.percent
        except Exception:
            disk_usage_percent = None
        memory = psutil.virtual_memory()
        return {
            "db_connected": db_connected,
            "disk_usage_percent": disk_usage_percent,
            "memory_usage_percent": memory.percent,
            "cpu_usage_percent": psutil.cpu_percent(),
        }


def _register_request_size_middleware(application: FastAPI) -> None:
    @application.middleware("http")
    async def limit_skill_download_request_size(request: Request, call_next):
        if request.method == "POST" and request.url.path == "/api/v1/client/skills/download":
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    if int(content_length) > settings.SKILL_DOWNLOAD_MAX_REQUEST_BYTES:
                        return JSONResponse(
                            status_code=413,
                            content=_error_payload("Request too large", "REQUEST_TOO_LARGE"),
                        )
                except ValueError:
                    return JSONResponse(
                        status_code=400,
                        content=_error_payload("Invalid Content-Length header", "BAD_REQUEST"),
                    )
            received_bytes = 0
            original_receive = request._receive

            async def limited_receive():
                nonlocal received_bytes
                message = await original_receive()
                if message["type"] == "http.request":
                    body = message.get("body", b"")
                    received_bytes += len(body)
                    if received_bytes > settings.SKILL_DOWNLOAD_MAX_REQUEST_BYTES:
                        raise HTTPException(
                            status_code=413,
                            detail={"detail": "Request too large", "code": "REQUEST_TOO_LARGE"},
                        )
                return message

            request._receive = limited_receive
        return await call_next(request)


def _register_exception_handlers(application: FastAPI) -> None:
    @application.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload_from_exception(exc.detail, exc.status_code),
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(_request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=_error_payload("Validation error", "VALIDATION_ERROR"),
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, _exc: Exception):
        return JSONResponse(
            status_code=500,
            content=_error_payload("Internal Server Error", "INTERNAL_SERVER_ERROR"),
        )


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
    _register_core_middleware(application)
    _register_routes(application)
    _register_operational_endpoints(application)
    _register_request_size_middleware(application)
    _register_exception_handlers(application)
    return application


app = create_application()
