"""公共应用模块，提供 SkillHubMcpApp 类供两种运行模式使用。

此模块包含：
- fastmcp stub 定义（可选依赖）
- SkillHubMcpApp 类
"""

import importlib
import json
import sys
import types
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING

try:
    fastmcp = importlib.import_module("fastmcp")
except Exception:
    fastmcp_stub = types.ModuleType("fastmcp")
    fastmcp_stub.__path__ = []
    setattr(fastmcp_stub, "__skillhub_stub__", True)

    class Client:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            return None

    setattr(fastmcp_stub, "Client", Client)

    class FastMCP:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs
            self.auth = None

        def add_tool(self, *_args, **_kwargs):
            return None

        def http_app(self, *_args, **_kwargs):
            async def app(scope, _receive, send):
                if scope["type"] != "http":
                    return
                payload = json.dumps(
                    {
                        "detail": "Unauthorized",
                        "code": "UNAUTHORIZED",
                        "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                    },
                ).encode("utf-8")
                await send(
                    {
                        "type": "http.response.start",
                        "status": 401,
                        "headers": [(b"content-type", b"application/json")],
                    },
                )
                await send(
                    {
                        "type": "http.response.body",
                        "body": payload,
                    },
                )

            return app

    setattr(fastmcp_stub, "FastMCP", FastMCP)

    client_pkg = types.ModuleType("fastmcp.client")
    client_pkg.__path__ = []

    client_module = types.ModuleType("fastmcp.client.client")

    class CallToolResult:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

    setattr(client_module, "CallToolResult", CallToolResult)

    transports_module = types.ModuleType("fastmcp.client.transports")

    class StdioTransport:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

    class SSETransport:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

    class StreamableHttpTransport:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

    setattr(transports_module, "StdioTransport", StdioTransport)
    setattr(transports_module, "SSETransport", SSETransport)
    setattr(transports_module, "StreamableHttpTransport", StreamableHttpTransport)

    tools_module = types.ModuleType("fastmcp.tools")

    class FunctionTool:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

    setattr(tools_module, "FunctionTool", FunctionTool)

    sys.modules["fastmcp"] = fastmcp_stub
    sys.modules["fastmcp.client"] = client_pkg
    sys.modules["fastmcp.client.client"] = client_module
    sys.modules["fastmcp.client.transports"] = transports_module
    sys.modules["fastmcp.tools"] = tools_module

if TYPE_CHECKING:
    from flowllm.core.application import Application
    from skillhub.config import ConfigParser
else:
    Application = importlib.import_module("flowllm.core.application").Application
    ConfigParser = importlib.import_module("skillhub.config.config_parser").ConfigParser


class SkillHubMcpApp(Application):
    """Concrete FlowLLM application for the Open SkillHub package.

    This subclass simply pre-configures the base :class:`Application` with the
    skillhub specific configuration parser and sensible defaults. All heavy
    lifting (service lifecycle, routing, etc.) is delegated to the parent class.
    """

    def __init__(
        self,
        *args,
        llm_api_key: Optional[str] = None,
        llm_api_base: Optional[str] = None,
        embedding_api_key: Optional[str] = None,
        embedding_api_base: Optional[str] = None,
        config_path: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(
            *args,
            llm_api_key=llm_api_key,
            llm_api_base=llm_api_base,
            embedding_api_key=embedding_api_key,
            embedding_api_base=embedding_api_base,
            service_config=None,
            parser=ConfigParser,
            config_path=config_path,
            load_default_config=True,
            **kwargs,
        )


__all__ = ["SkillHubMcpApp"]
