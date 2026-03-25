from contextlib import AsyncExitStack, asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
import psutil

from backend.api.mcp import (
    McpAppProxy,
    ensure_mcp_initialized,
    get_http_app,
    get_sse_app,
    shutdown_mcp,
)
from backend.api.router import api_router
from backend.config.settings import settings
from backend.core.middleware.deprecation import DeprecationMiddleware
from backend.core.middleware.logging import RequestLoggingMiddleware, configure_loguru
from backend.core.middleware.rate_limit import RateLimitMiddleware
from backend.db.session import engine, get_async_session, init_db
from backend.repositories.audit_log import AuditLogRepository
from backend.services.deprecation_notification import DeprecationNotifier


class _SlashPathMiddleware:
    def __init__(self, app: FastAPI, paths: set[str]):
        self.app = app
        self.paths = paths

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            path = scope.get("path")
            if path in self.paths:
                updated = dict(scope)
                updated["path"] = f"{path}/"
                updated["raw_path"] = f"{path}/".encode()
                scope = updated
        await self.app(scope, receive, send)


@asynccontextmanager
async def lifespan(_application: FastAPI):
    await init_db()
    await ensure_mcp_initialized()
    if settings.ENABLE_DEPRECATION_NOTIFIER_ON_STARTUP:
        async for session in get_async_session():
            notifier = DeprecationNotifier(
                AuditLogRepository(session),
                day_offsets=list(settings.DEPRECATION_NOTIFY_OFFSETS_DAYS),
            )
            await notifier.notify_upcoming_deprecation()
            break
    async with AsyncExitStack() as stack:
        for mcp_app in (get_http_app(), get_sse_app()):
            router = getattr(mcp_app, "router", None)
            lifespan_context = getattr(router, "lifespan_context", None) if router else None
            if lifespan_context:
                await stack.enter_async_context(lifespan_context(mcp_app))
        yield
    await shutdown_mcp()


def create_application() -> FastAPI:
    def _utc_timestamp() -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    configure_loguru()
    application = FastAPI(lifespan=lifespan, redirect_slashes=False)
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
    application.add_middleware(_SlashPathMiddleware, paths={"/mcp", "/sse"})
    application.include_router(api_router, prefix="/api/v1")
    application.mount("/mcp", McpAppProxy(get_http_app))
    application.mount("/sse", McpAppProxy(get_sse_app))

    async def _check_db_connection() -> bool:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            return True
        except Exception:
            return False

    @application.get("/health")
    async def health():
        db_connected = await _check_db_connection()
        status_code = 200 if db_connected else 503
        status_value = "healthy" if db_connected else "unhealthy"
        return JSONResponse(
            status_code=status_code,
            content={"status": status_value, "db_connected": db_connected},
        )

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

    def _error_payload(detail: object, code: str) -> dict:
        return {
            "detail": detail,
            "code": code,
            "timestamp": _utc_timestamp(),
        }

    def _error_payload_from_exception(detail: object, status_code: int) -> dict:
        if isinstance(detail, dict) and "detail" in detail and "code" in detail:
            payload = dict(detail)
            if "timestamp" not in payload:
                payload["timestamp"] = _utc_timestamp()
            return payload
        return _error_payload(detail, _code_for_status(status_code))

    def _code_for_status(status_code: int) -> str:
        return {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
        }.get(status_code, "HTTP_ERROR")

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

    return application


app = create_application()
