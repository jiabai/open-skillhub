from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.middleware.logging import RequestLoggingMiddleware
from backend.core.middleware.rate_limit import RateLimitMiddleware


def test_core_middlewares_are_pure_asgi():
    assert not issubclass(RequestLoggingMiddleware, BaseHTTPMiddleware)
    assert not issubclass(RateLimitMiddleware, BaseHTTPMiddleware)
