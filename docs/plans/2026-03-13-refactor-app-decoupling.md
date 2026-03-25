# 重构：Open SkillHubMcpApp 类解耦实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 Open SkillHubMcpApp 类从 main.py 剥离到独立模块，实现两种运行模式的低耦合。

**Architecture:** 创建 `core/app.py` 作为公共模块，包含 Open SkillHubMcpApp 类和 fastmcp stub 定义。main.py 只负责 CLI 入口，FastAPI 模式从 core/app.py 导入。

**Tech Stack:** Python, FlowLLM, FastAPI

---

### Task 1: 创建 core/app.py 公共模块

**Files:**
- Create: `backend/core/app.py`

**Step 1: 创建 core/app.py 文件**

```python
"""公共应用模块，提供 Open SkillHubMcpApp 类供两种运行模式使用。

此模块包含：
- fastmcp stub 定义（可选依赖）
- Open SkillHubMcpApp 类
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
    from backend.config import ConfigParser
else:
    Application = importlib.import_module("flowllm.core.application").Application
    ConfigParser = importlib.import_module("backend.config.config_parser").ConfigParser


class Open SkillHubMcpApp(Application):
    """Concrete FlowLLM application for the Agent Skills MCP package.

    This subclass simply pre-configures the base :class:`Application` with the
    skillhub-mcp specific configuration parser and sensible defaults. All heavy
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


__all__ = ["Open SkillHubMcpApp"]
```

**Step 2: 验证文件创建成功**

Run: `ls backend/core/app.py`
Expected: 文件存在

---

### Task 2: 更新 core/__init__.py 导出

**Files:**
- Modify: `backend/core/__init__.py`

**Step 1: 添加 Open SkillHubMcpApp 导出**

```python
from backend.core.app import Open SkillHubMcpApp

__all__ = ["Open SkillHubMcpApp"]
```

**Step 2: 验证导入**

Run: `python -c "from backend.core import Open SkillHubMcpApp; print(Open SkillHubMcpApp)"`
Expected: 输出类名，无错误

---

### Task 3: 重构 main.py 为纯 CLI 入口

**Files:**
- Modify: `backend/main.py`

**Step 1: 简化 main.py**

```python
"""CLI 入口点，负责启动 FlowLLM 独立模式。

此模块只负责命令行入口，Open SkillHubMcpApp 类已移至 core/app.py。
"""

import sys

from backend.core.app import Open SkillHubMcpApp


def main() -> None:
    """Run the Agent Skills MCP service as a command-line application.

    The function builds :class:`Open SkillHubMcpApp` from the command-line arguments
    (excluding the script name) and starts the FlowLLM service loop.
    """
    with Open SkillHubMcpApp(*sys.argv[1:]) as app:
        app.run_service()


if __name__ == "__main__":
    main()
```

**Step 2: 验证 CLI 入口**

Run: `python -c "from backend.main import main; print('OK')"`
Expected: 输出 OK，无错误

---

### Task 4: 更新 api/mcp/__init__.py 导入路径

**Files:**
- Modify: `backend/api/mcp/__init__.py`

**Step 1: 修改导入路径**

找到：
```python
from backend.main import Open SkillHubMcpApp
```

改为：
```python
from backend.core.app import Open SkillHubMcpApp
```

**Step 2: 验证导入**

Run: `python -c "from backend.api.mcp import ensure_mcp_initialized; print('OK')"`
Expected: 输出 OK，无错误

---

### Task 5: 运行测试验证

**Step 1: 运行现有测试**

Run: `pytest tests/ -v --tb=short`
Expected: 所有测试通过

**Step 2: 验证两种模式导入**

Run: `python -c "from backend.main import main; from backend.core.app import Open SkillHubMcpApp; print('Both modes OK')"`
Expected: 输出 Both modes OK

---

### Task 6: 更新 architecture.md 文档

**Files:**
- Modify: `docs/architecture.md`

**Step 1: 更新代码模块依赖关系图**

更新依赖关系图，展示新的模块结构：

```
┌─────────────────────────────────────────────────────────────────────┐
│                        代码模块依赖关系（重构后）                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐                         ┌─────────────┐          │
│   │   main.py   │                         │  api_app.py │          │
│   │ (CLI入口)   │                         │ (FastAPI入口)│          │
│   └──────┬──────┘                         └──────┬──────┘          │
│          │                                       │                  │
│          │  FlowLLM 独立模式                     │  FastAPI 模式    │
│          ▼                                       ▼                  │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │                    core/app.py                           │      │
│   │              Open SkillHubMcpApp (公共)                    │      │
│   └─────────────────────────────────────────────────────────┘      │
│          │                                       │                  │
│          └───────────────────┬───────────────────┘                  │
│                              ▼                                      │
│                    ┌─────────────────────┐                         │
│                    │   config/           │                         │
│                    │   ConfigParser      │                         │
│                    └─────────────────────┘                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Step 2: 提交更改**

```bash
git add backend/core/app.py backend/core/__init__.py backend/main.py backend/api/mcp/__init__.py docs/architecture.md
git commit -m "refactor: extract Open SkillHubMcpApp to core/app.py for better decoupling"
```

---

## 重构前后对比

| 特性 | 重构前 | 重构后 |
|-----|-------|-------|
| Open SkillHubMcpApp 位置 | main.py | core/app.py |
| FastAPI 模式导入 | from main import | from core.app import |
| main.py 职责 | 类定义 + CLI | 纯 CLI |
| 耦合度 | 中等 | 低 |
