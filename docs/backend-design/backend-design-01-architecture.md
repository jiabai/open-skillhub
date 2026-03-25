# Open SkillHub 后端设计与开发文档 — 架构设计

> 本文档描述 Open SkillHub 的系统架构、模块依赖关系和两种运行模式。

---

## 1. 系统架构

Open SkillHub 是一个支持 Agent Skills 的后端平台，提供两类核心能力：

1. **Skill 管理**：用户上传、打包、版本管理、分享 Agent Skills
2. **Skill 执行**：通过 MCP（Model Context Protocol）协议暴露工具供 AI Agent 调用

系统分为 **FlowLLM 独立模式**（CLI）和 **FastAPI HTTP/SSE 模式**（有认证）两种运行形态，共用同一套 `core/app.py` 公共应用模块。

---

## 2. 模块依赖关系

```
backend/
├── main.py              # CLI 入口（FlowLLM 独立模式）
├── api_app.py           # FastAPI 入口（HTTP/SSE 模式）
├── core/
│   ├── app.py           # SkillHubMcpApp 公共类（两种模式共用）
│   ├── security/        # JWT、密码哈希、RBAC、Token 工具
│   ├── middleware/      # 认证、日志、限流、降级中间件
│   ├── tools/           # MCP 工具实现（execute_skill, run_shell_command 等）
│   └── utils/           # 用户上下文、存储、归档等工具
├── api/
│   ├── router.py        # API 路由聚合
│   ├── deps.py          # FastAPI 依赖注入
│   ├── v1/              # REST API v1 路由
│   │   ├── auth.py      # 认证相关路由
│   │   ├── skills.py    # Skill CRUD 路由
│   │   ├── tokens.py    # API Token 管理路由
│   │   ├── users.py     # 用户管理路由
│   │   ├── audit.py     # 审计日志路由
│   │   └── dashboard.py # 仪表盘路由
│   └── mcp/             # MCP 代理与传输层
│       ├── http_handler.py
│       ├── sse_handler.py
│       └── auth.py      # MCP 请求认证
├── config/
│   ├── settings.py      # Pydantic Settings 配置
│   └── config_parser.py # YAML 配置解析
├── models/              # SQLAlchemy ORM 模型
├── schemas/             # Pydantic 请求/响应 Schema
├── services/            # 业务逻辑层
├── repositories/        # 数据访问层
└── db/
    ├── session.py       # 异步数据库会话
    └── migrations/      # Alembic 数据库迁移
```

---

## 3. 运行模式

### 模式一：FlowLLM 独立模式（CLI，无认证）

```
┌──────────────┐     ┌──────────────────────────────────────────────┐
│   CLI/终端   │     │              FlowLLM 框架                    │
│   skillhub   │────▶│  ┌─────────────────────────────────────────┐ │
│   -mcp       │     │  │  SkillHubMcpApp (core/app.py)          │ │
│   transport  │     │  │    ├── mcp.transport=stdio/sse         │ │
│   =stdio/sse │     │  │    ├── ConfigParser                    │ │
└──────────────┘     │  │    └── run_service()                    │ │
                    │  └─────────────────────────────────────────┘ │
                    │                     │                          │
                    │                     ▼                          │
                    │  ┌─────────────────────────────────────────┐ │
                    │  │         MCP Service                    │ │
                    │  │   (load_skill, run_shell_command...)   │ │
                    │  └─────────────────────────────────────────┘ │
                    └──────────────────────────────────────────────┘
```

**特点**：
- 无用户隔离，所有操作在单一上下文中执行
- 通过 STDIO 或 SSE 传输与父进程通信
- 适用于本地开发、单机部署场景

### 模式二：FastAPI HTTP/SSE 模式（有认证）

```
┌──────────────┐     ┌──────────────────────────────────────────────┐
│  外部客户端   │     │              FastAPI 应用                     │
│  (HTTP请求)  │────▶│  ┌─────────────────────────────────────────┐ │
└──────────────┘     │  │  api_app.py: create_application()       │ │
                     │  │    ├── /api/v1/* (REST API)              │ │
                     │  │    ├── /mcp  ──▶ McpAppProxy + HTTP     │ │
                     │  │    └── /sse  ──▶ McpAppProxy + SSE      │ │
                     │  └─────────────────────────────────────────┘ │
                     │                     │                          │
                     │                     ▼                          │
                     │  ┌─────────────────────────────────────────┐ │
                     │  │         McpAppProxy                     │ │
                     │  │  ┌────────────────────────────────────┐  │ │
                     │  │  │ _authorize_mcp_request()          │  │ │
                     │  │  │   ├── 提取 Bearer Token            │  │ │
                     │  │  │   ├── 验证 API Token 格式          │  │ │
                     │  │  │   ├── 数据库验证 Token             │  │ │
                     │  │  │   └── 设置用户上下文 (ContextVar)  │  │ │
                     │  │  └────────────────────────────────────┘  │ │
                     │  └─────────────────────────────────────────┘ │
                     │                     │                          │
                     │                     ▼                          │
                     │  ┌─────────────────────────────────────────┐ │
                     │  │         FlowLLM MCP Service             │ │
                     │  │   (基于 user_context 隔离数据访问)       │ │
                     │  └─────────────────────────────────────────┘ │
                     └──────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌──────────────────────────────────────┐
                    │   端口 8000 (FastAPI)                │
                    │   认证后转发到 MCP 服务               │
                    └──────────────────────────────────────┘
```

**特点**：
- REST API 提供用户管理、Skill CRUD、Token 管理
- MCP 端点（HTTP/SSE）暴露工具供 AI Agent 调用
- 基于 API Token 的认证与用户隔离
- 适用于多用户 SaaS 平台部署

---

## 4. 技术栈

| 组件 | 技术选型 |
|------|---------|
| Web 框架 | FastAPI + Starlette |
| ORM | SQLAlchemy 2.0 (async) |
| 数据库 | PostgreSQL（通过 `DATABASE_URL` 配置） |
| 迁移工具 | Alembic |
| 认证 | JWT (PyJWT) + API Token |
| 密码哈希 | bcrypt (passlib) |
| MCP 运行时 | FlowLLM (fastmcp) |
| 配置管理 | Pydantic Settings |
| 日志 | Loguru |
| 邮件 | SMTP / 阿里云 DM |
| 系统监控 | psutil |
| 加密 | cryptography (AES-GCM) |

---

## 5. 配置管理

所有配置通过环境变量注入到 `Settings` 类（基于 Pydantic Settings）：

```python
class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # ... 80+ 配置项
```

关键功能开关（布尔配置）：
- `ENABLE_PUBLIC_SIGNUP` — 允许公开注册
- `ENABLE_SSO` / `ENABLE_LDAP` — SSO/LDAP 登录
- `ENABLE_ORG_MODEL` — 企业组织模型
- `ENABLE_RBAC` — 基于角色的权限控制
- `ENABLE_SKILL_VISIBILITY` — Skill 可见性控制
- `ENABLE_AUDIT_LOG` — 审计日志
- `ENABLE_METRICS` — 请求指标
- `ENABLE_RATE_LIMIT` — 限流

详细配置说明见 [backend-design-06-services.md](./backend-design-06-services.md#3-配置管理)。
