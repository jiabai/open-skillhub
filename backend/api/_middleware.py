from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config.settings import settings
from backend.core.middleware.deprecation import DeprecationMiddleware
from backend.core.middleware.logging import RequestLoggingMiddleware
from backend.core.middleware.rate_limit import RateLimitMiddleware


def register_core_middleware(application: FastAPI) -> None:
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
