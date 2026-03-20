from starlette.types import ASGIApp, Message, Receive, Scope, Send


class DeprecationMiddleware:
    """
    弃用中间件：为已弃用的端点自动添加 Deprecation 和 Sunset 响应头

    响应头说明：
    - Deprecation: true - 表示该端点已弃用
    - Sunset: <date> - 表示该端点将完全移除的日期（RFC 8594）
    - Link: <alternative>; rel="successor-version" - 替代端点（可选）

    使用纯 ASGI 实现，避免 BaseHTTPMiddleware 的弃用问题
    """

    def __init__(
        self,
        app: ASGIApp,
        deprecated_endpoints: dict[str, str] | None = None,
        deprecated_versions: set[str] | None = None,
        version_sunset_date: str | None = None,
    ):
        self.app = app
        self.deprecated_endpoints = deprecated_endpoints or {}
        self.deprecated_versions = deprecated_versions or set()
        self.version_sunset_date = version_sunset_date

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope["path"]
        headers_to_add: list[tuple[bytes, bytes]] = []

        if path in self.deprecated_endpoints:
            headers_to_add.append((b"Deprecation", b"true"))
            sunset_date = self.deprecated_endpoints[path].encode()
            headers_to_add.append((b"Sunset", sunset_date))

        for version_prefix in self.deprecated_versions:
            if path.startswith(version_prefix):
                headers_to_add.append((b"Deprecation", b"true"))
                if self.version_sunset_date:
                    headers_to_add.append((b"Sunset", self.version_sunset_date.encode()))
                break

        if not headers_to_add:
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                existing_headers = list(message.get("headers", []))
                message["headers"] = existing_headers + headers_to_add
            await send(message)

        await self.app(scope, receive, send_wrapper)


def create_deprecation_middleware(app: ASGIApp) -> DeprecationMiddleware:
    from skillhub.config.settings import settings

    return DeprecationMiddleware(
        app,
        deprecated_endpoints=settings.DEPRECATED_ENDPOINTS,
        deprecated_versions=settings.DEPRECATED_VERSIONS,
        version_sunset_date=settings.DEPRECATED_VERSION_SUNSET_DATE,
    )
