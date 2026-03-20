from typing import Any

_http_app: Any | None = None


def create_http_app(server: Any) -> Any:
    return server.http_app(path="/", transport="http")


def set_http_app(app: Any | None) -> None:
    global _http_app
    _http_app = app


def get_http_app() -> Any:
    if _http_app is None:
        raise RuntimeError("MCP HTTP app is not initialized")
    return _http_app
