from typing import Any

_sse_app: Any | None = None


def create_sse_app(server: Any) -> Any:
    return server.http_app(path="/", transport="sse")


def set_sse_app(app: Any | None) -> None:
    global _sse_app
    _sse_app = app


def get_sse_app() -> Any:
    if _sse_app is None:
        raise RuntimeError("MCP SSE app is not initialized")
    return _sse_app
