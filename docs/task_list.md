# Open SkillHub 多用户Web服务改造 - 任务列表

> 本文档定义了项目改造的详细任务分解，按阶段和优先级组织。
>
> **状态**: 后端 Python 代码与前端控制台均已完成实现；下方任务表用于保留后端实施记录与回溯参考。

---

## 阶段概览

- Phase 1: 基础设施搭建（配置、模型、迁移、Schemas）
- Phase 2: 安全与认证模块（安全工具、中间件、Repo/Service）
- Phase 3: API 接口实现（认证、用户、Token、Skill、Dashboard、Audit）
- Phase 4: MCP 服务集成（工具改造、HTTP/SSE）
- Phase 5: 应用入口与部署（FastAPI 入口、部署配置）
- Phase 6: 测试（单元与集成）

## Phase 1: 基础设施搭建

### 1.1 项目配置

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T1.1.1 | 创建配置模块 | 创建 `skillhub/config/settings.py`，定义 Pydantic Settings | 无 | ✅ |
| T1.1.2 | 更新依赖配置 | 更新 `pyproject.toml`，添加新依赖 (使用 PyJWT) | T1.1.1 | ✅ |
| T1.1.3 | 创建环境变量模板 | 创建 `.env.example` 文件 | T1.1.1 | ✅ |
| T1.1.4 | 扩展 default.yaml | 添加用户隔离相关配置 | T1.1.1 | ✅ |
| T1.1.5 | 创建辅助脚本 | 创建 `scripts/checklist_stats.py` | 无 | ✅ |

### 1.2 数据库层

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T1.2.1 | 创建数据库会话模块 | 创建 `db/session.py`，配置异步引擎 | T1.1.1 | ✅ |
| T1.2.2 | 创建基础模型 | 创建 `models/base.py`，定义 Base 和 Mixin | T1.2.1 | ✅ |
| T1.2.3 | 创建 User 模型 | 创建 `models/user.py` | T1.2.2 | ✅ |
| T1.2.4 | 创建 Skill 模型 | 创建 `models/skill.py` | T1.2.2 | ✅ |
| T1.2.5 | 创建 APIToken 模型 | 创建 `models/token.py` | T1.2.2 | ✅ |
| T1.2.6 | 创建模型导出 | 创建 `models/__init__.py` | T1.2.3-T1.2.5 | ✅ |
| T1.2.7 | 配置 Alembic | 初始化数据库迁移 | T1.2.6 | ✅ |
| T1.2.8 | 创建初始迁移 | 生成初始数据库表迁移脚本 | T1.2.7 | ✅ |

### 1.3 Pydantic Schemas

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T1.3.1 | 创建通用响应 Schema | 创建 `schemas/response.py` | 无 | ✅ |
| T1.3.2 | 创建 User Schema | 创建 `schemas/user.py` | T1.2.3 | ✅ |
| T1.3.3 | 创建 Skill Schema | 创建 `schemas/skill.py` | T1.2.4 | ✅ |
| T1.3.4 | 创建 Token Schema | 创建 `schemas/token.py` | T1.2.5 | ✅ |
| T1.3.5 | 创建 Schema 导出 | 创建 `schemas/__init__.py` | T1.3.1-T1.3.4 | ✅ |

---

## Phase 2: 安全与认证模块

### 2.1 安全工具

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T2.1.1 | 创建密码哈希模块 | 创建 `core/security/password.py` | 无 | ✅ |
| T2.1.2 | 创建 JWT 工具 | 创建 `core/security/jwt_utils.py` | T1.1.1 | ✅ |
| T2.1.3 | 创建 API Token 工具 | 创建 `core/security/token.py` | 无 | ✅ |
| T2.1.4 | 创建安全模块导出 | 创建 `core/security/__init__.py` | T2.1.1-T2.1.3 | ✅ |

### 2.2 认证中间件

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T2.2.1 | 创建 JWT 认证中间件 | 创建 `core/middleware/auth.py` | T2.1.2 | ✅ |
| T2.2.2 | 创建 MCP Token 认证 | 创建 `api/mcp/auth.py` | T2.1.3 | ✅ |
| T2.2.3 | 创建限流中间件 | 创建 `core/middleware/rate_limit.py` | 无 | ✅ |
| T2.2.4 | 创建中间件导出 | 创建 `core/middleware/__init__.py` | T2.2.1-T2.2.3 | ✅ |

### 2.3 Repository 层

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T2.3.1 | 创建基础 Repository | 创建 `repositories/base.py` | T1.2.1 | ✅ |
| T2.3.2 | 创建 User Repository | 创建 `repositories/user.py` | T2.3.1, T1.2.3 | ✅ |
| T2.3.3 | 创建 Skill Repository | 创建 `repositories/skill.py` | T2.3.1, T1.2.4 | ✅ |
| T2.3.4 | 创建 Token Repository | 创建 `repositories/token.py` | T2.3.1, T1.2.5 | ✅ |
| T2.3.5 | 创建 Repository 导出 | 创建 `repositories/__init__.py` | T2.3.1-T2.3.4 | ✅ |

### 2.4 Service 层

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T2.4.1 | 创建认证服务 | 创建 `services/auth.py` | T2.1.1, T2.1.2, T2.3.2 | ✅ |
| T2.4.2 | 创建用户服务 | 创建 `services/user.py` | T2.3.2 | ✅ |
| T2.4.3 | 创建 Token 服务 | 创建 `services/token.py` | T2.1.3, T2.3.4 | ✅ |
| T2.4.4 | 创建 Skill 服务 | 创建 `services/skill.py` | T2.3.3 | ✅ |
| T2.4.5 | 创建 Service 导出 | 创建 `services/__init__.py` | T2.4.1-T2.4.4 | ✅ |

---

## Phase 3: API 接口实现

### 3.1 依赖注入

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T3.1.1 | 创建依赖注入模块 | 创建 `api/deps.py` | T2.2.1, T2.2.2 | ✅ |

### 3.2 认证 API

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T3.2.1 | 实现注册接口 | POST /api/v1/auth/register | T2.4.1, T3.1.1 | ✅ |
| T3.2.2 | 实现登录接口 | POST /api/v1/auth/login | T2.4.1, T3.1.1 | ✅ |
| T3.2.3 | 实现刷新Token接口 | POST /api/v1/auth/refresh | T2.4.1, T3.1.1 | ✅ |
| T3.2.4 | 创建认证路由 | 创建 `api/v1/auth.py` | T3.2.1-T3.2.3 | ✅ |

### 3.3 用户 API

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T3.3.1 | 实现获取当前用户 | GET /api/v1/users/me | T2.4.2, T3.1.1 | ✅ |
| T3.3.2 | 实现更新用户信息 | PUT /api/v1/users/me | T2.4.2, T3.1.1 | ✅ |
| T3.3.3 | 实现删除账户 | DELETE /api/v1/users/me | T2.4.2, T3.1.1 | ✅ |
| T3.3.4 | 实现修改密码 | PUT /api/v1/users/me/password | T2.4.2, T3.1.1 | ✅ |
| T3.3.5 | 创建用户路由 | 创建 `api/v1/users.py` | T3.3.1-T3.3.4 | ✅ |

### 3.4 Token API

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T3.4.1 | 实现列出Token | GET /api/v1/tokens | T2.4.3, T3.1.1 | ✅ |
| T3.4.2 | 实现创建Token | POST /api/v1/tokens | T2.4.3, T3.1.1 | ✅ |
| T3.4.3 | 实现删除Token | DELETE /api/v1/tokens/{token_id} | T2.4.3, T3.1.1 | ✅ |
| T3.4.4 | 创建Token路由 | 创建 `api/v1/tokens.py` | T3.4.1-T3.4.3 | ✅ |

### 3.5 Skill API

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T3.5.1 | 创建 Skill 存储工具 | 创建 `core/utils/skill_storage.py` | T1.1.1 | ✅ |
| T3.5.2 | 实现列出Skills | GET /api/v1/skills | T2.4.4, T3.5.1, T3.1.1 | ✅ |
| T3.5.3 | 实现创建Skill | POST /api/v1/skills | T2.4.4, T3.5.1, T3.1.1 | ✅ |
| T3.5.4 | 实现获取Skill详情 | GET /api/v1/skills/{skill_uuid} | T2.4.4, T3.1.1 | ✅ |
| T3.5.5 | 实现更新Skill | PUT /api/v1/skills/{skill_uuid} | T2.4.4, T3.1.1 | ✅ |
| T3.5.6 | 实现删除Skill | DELETE /api/v1/skills/{skill_uuid} | T2.4.4, T3.1.1 | ✅ |
| T3.5.7 | 实现上传Skill文件 | POST /api/v1/skills/upload | T2.4.4, T3.5.1, T3.1.1 | ✅ |
| T3.5.8 | 实现列出Skill文件 | GET /api/v1/skills/{skill_uuid}/files | T2.4.4, T3.5.1, T3.1.1 | ✅ |
| T3.5.9 | 创建Skill路由 | 创建 `api/v1/skills.py` | T3.5.2-T3.5.8 | ✅ |

### 3.6 路由汇总

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T3.6.1 | 创建API路由汇总 | 创建 `api/router.py` | T3.2.4, T3.3.5, T3.4.4, T3.5.9 | ✅ |
| T3.6.2 | 创建API模块导出 | 创建 `api/__init__.py` | T3.6.1 | ✅ |
| T3.6.3 | 创建v1模块导出 | 创建 `api/v1/__init__.py` | T3.2.4, T3.3.5, T3.4.4, T3.5.9 | ✅ |

### 3.7 接口补齐（与当前实现对齐）

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T3.7.1 | 实现绑定邮箱接口 | POST `/api/v1/users/bind-email` | T3.2.1, T3.1.1 | ✅ |
| T3.7.2 | 实现身份更新接口 | PUT `/api/v1/users/{user_id}/identity`（需 `user.manage`） | T3.3.5 | ✅ |
| T3.7.3 | 实现缓存策略接口 | GET `/api/v1/skills/cache-policy` | T3.5.9 | ✅ |
| T3.7.4 | 实现文件内容读取接口 | GET `/api/v1/skills/{skill_uuid}/files/{file_path:path}` | T3.5.9 | ✅ |
| T3.7.5 | 创建 Dashboard 路由 | 创建 `api/v1/dashboard.py` | T3.6.1 | ✅ |
| T3.7.6 | 创建 Audit 路由 | 创建 `api/v1/audit.py` | T3.6.1 | ✅ |
| T3.7.7 | 扩展路由汇总 | 在 `api/router.py` 注册 dashboard/audit 路由 | T3.7.5, T3.7.6 | ✅ |

---

## Phase 4: MCP 服务集成

### 4.1 MCP 工具改造

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T4.1.1 | 改造 LoadSkillOp | 支持用户隔离 | T1.1.1 | ✅ |
| T4.1.2 | 改造 LoadSkillMetadataOp | 支持用户隔离 | T1.1.1 | ✅ |
| T4.1.3 | 改造 ReadReferenceFileOp | 支持用户隔离 | T1.1.1 | ✅ |
| T4.1.4 | 改造 RunShellCommandOp | 支持用户隔离 | T1.1.1 | ✅ |

### 4.2 MCP 服务

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T4.2.1 | 创建 MCP 服务 | 创建 `api/mcp/__init__.py` 并在其中初始化 MCP 服务 | T4.1.1-T4.1.4 | ✅ |
| T4.2.2 | 创建 HTTP MCP 处理器 | 创建 `api/mcp/http_handler.py` | T4.2.1, T2.2.2 | ✅ |
| T4.2.3 | 创建 SSE MCP 处理器 | 创建 `api/mcp/sse_handler.py` | T4.2.1, T2.2.2 | ✅ |
| T4.2.4 | 创建 MCP 模块导出 | 更新 `api/mcp/__init__.py`，导出并汇总 MCP 服务 | T4.2.2, T4.2.3 | ✅ |

---

## Phase 5: 应用入口与部署

### 5.1 FastAPI 应用

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T5.1.1 | 创建 FastAPI 应用入口 | 创建 `api_app.py`，包含应用工厂函数 `create_application()` | T3.6.1, T4.2.4 | ✅ |
| T5.1.2 | 添加 CORS 中间件 | 配置跨域支持 | T5.1.1 | ✅ |
| T5.1.3 | 添加健康检查端点 | GET /health | T5.1.1 | ✅ |
| T5.1.4 | 更新包版本号 | 更新 `__init__.py` 中的版本号 | T5.1.1 | ✅ |
| T5.1.5 | 更新 README | 添加多用户模式使用说明 | T5.1.1 | ✅ |
| T5.1.6 | 添加指标端点 | GET /metrics（资源与连接指标） | T5.1.1 | ✅ |
| T5.1.7 | 添加网关中间件 | 请求日志与限流中间件接入 | T5.1.1 | ✅ |

> **注意**: 现有 `main.py`（FlowLLM 入口）保持不变，用于 stdio/SSE 模式。

### 5.2 部署配置

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T5.2.1 | 创建 Dockerfile | Docker 镜像构建配置 | T5.1.1 | ✅ |
| T5.2.2 | 创建 docker-compose.yml | 完整部署配置 | T5.2.1 | ✅ |
| T5.2.3 | 创建 .dockerignore | Docker 构建忽略文件 | T5.2.1 | ✅ |
| T5.2.4 | 定义启动命令 | 在 Dockerfile CMD 中集成迁移 + 启动 | T5.1.1 | ✅ |

---

## Phase 6: 测试

### 6.1 测试配置

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T6.1.1 | 创建测试配置 | 创建 `tests/conftest.py` | T5.1.1 | ✅ |
| T6.1.2 | 创建测试数据库配置 | 配置内存 SQLite | T6.1.1 | ✅ |

### 6.2 单元测试

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T6.2.1 | 测试密码工具 | 测试 `core/security/password.py` | T2.1.1 | ✅ |
| T6.2.2 | 测试 JWT 工具 | 测试 `core/security/jwt_utils.py` | T2.1.2 | ✅ |
| T6.2.3 | 测试 Token 工具 | 测试 `core/security/token.py` | T2.1.3 | ✅ |
| T6.2.4 | 测试认证服务 | 测试 `services/auth.py` | T2.4.1 | ✅ |
| T6.2.5 | 测试用户服务 | 测试 `services/user.py` | T2.4.2 | ✅ |
| T6.2.6 | 测试 Skill 服务 | 测试 `services/skill.py` | T2.4.4 | ✅ |

### 6.3 集成测试

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T6.3.1 | 测试认证 API | 测试 `/api/v1/auth/*` | T3.2.4 | ✅ |
| T6.3.2 | 测试用户 API | 测试 `/api/v1/users/*` | T3.3.5 | ✅ |
| T6.3.3 | 测试 Token API | 测试 `/api/v1/tokens/*` | T3.4.4 | ✅ |
| T6.3.4 | 测试 Skill API | 测试 `/api/v1/skills/*` | T3.5.9 | ✅ |
| T6.3.5 | 测试 MCP API | 测试 `/mcp` 和 `/sse` | T4.2.4 | ✅ |

---

## Phase 7: 企业私有云 P0 落地

### 7.1 认证与组织模型

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T7.1.1 | 接入企业身份源 | 支持 LDAP/AD/SSO 认证 | 外部身份源 | ✅ |
| T7.1.2 | 组织/团队映射 | 用户、组、团队结构映射与同步 | T7.1.1 | 🔵 |

### 7.2 RBAC 与可见性

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T7.2.1 | RBAC 角色与权限矩阵 | 定义角色、权限点与策略 | T7.1.2 | ✅ |
| T7.2.2 | Skill 可见性控制 | 企业/团队/个人三级可见性与访问控制 | T7.2.1 | ✅ |

### 7.3 MCP/REST 接口契约

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T7.3.1 | MCP 资源接口 | `skill://list` 与 `skill://{id}@{version}` | T7.2.2 | ✅ |
| T7.3.2 | 执行工具契约 | `execute_skill` 工具与权限校验 | T7.3.1 | ✅ |
| T7.3.3 | 技能下载接口 | `skills/download` 加密传输 | T7.3.2 | ✅ |

### 7.4 审计日志

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T7.4.1 | 审计日志模型与采集 | 定义模型与采集点 | T7.2.2 | 🔵 |
| T7.4.2 | 审计日志查询与导出 | CSV/JSON 导出 | T7.4.1 | ✅ |

### 7.5 版本自动递增

| ID | 任务 | 描述 | 依赖 | 状态 |
|----|------|------|------|------|
| T7.5.1 | 版本自动递增策略 | SemVer 自动递增与冲突处理 | T7.3.3 | ✅ |

> 注：Phase 7 的 🔵 表示“主链路已落地但仍有契约或治理缺口”，详细差异以 `project-spec.md` 第 1.5 节为准。
>
> 术语口径：`skill://list` 的 `visible` 示例值统一为 `enterprise | team | private`；权限点示例统一复用 `project-spec.md` 中 RBAC 模板。

---

## 任务统计

| 阶段 | 任务数 | 描述 |
|------|--------|------|
| Phase 1 | 18 | 基础设施搭建 |
| Phase 2 | 18 | 安全与认证模块 |
| Phase 3 | 33 | API 接口实现 |
| Phase 4 | 8 | MCP 服务集成 |
| Phase 5 | 11 | 应用入口与部署 |
| Phase 6 | 13 | 测试 |
| Phase 7 | 10 | 企业私有云 P0 |
| **总计** | **111** | |

---

## 执行顺序建议

```
Phase 1 (基础设施)
    │
    ├── T1.1.x (配置) ──┬── T1.2.x (数据库)
    │                   │
    │                   └── T1.3.x (Schemas)
    │
Phase 2 (安全认证)
    │
    ├── T2.1.x (安全工具) ──┬── T2.2.x (中间件)
    │                       │
    │                       └── T2.3.x (Repository)
    │                                   │
    │                                   └── T2.4.x (Service，含 Skill Service)
    │
Phase 3 (API)
    │
    ├── T3.1.x (依赖注入)
    │       │
    │       ├── T3.2.x (认证API)
    │       ├── T3.3.x (用户API)
    │       ├── T3.4.x (TokenAPI)
    │       ├── T3.5.x (Skill API，依赖 T2.4.4)
    │       ├── T3.6.x (路由汇总)
    │       └── T3.7.x (Dashboard/Audit/补齐接口)
    │
Phase 4 (MCP集成)
    │
    ├── T4.1.x (工具改造)
    │       │
    │       └── T4.2.x (MCP服务)
    │
Phase 5 (部署)
    │
    ├── T5.1.x (FastAPI入口 api_app.py，保留 main.py)
    │       │
    │       └── T5.2.x (部署配置)
    │
Phase 6 (测试)
    │
    ├── T6.1.x (测试配置)
    │       │
    │       ├── T6.2.x (单元测试)
    │       └── T6.3.x (集成测试)
```

### 补充执行序列：Skill 下架后客户端强制失效（S 端可落地部分）

> 目标：Skill 下架（`is_active=false`）后，只要请求仍经过 S 端（API/MCP），就应被明确拒绝使用；客户端若有本地缓存，可通过 `cache_revoked_at` 做失效判断与清理。

1. **定义服务端强制失效语义（接口与错误码）**
   - 约定统一错误响应：`code`/`detail`/`timestamp`
   - 建议错误码：`SKILL_DEACTIVATED`；建议 HTTP：`410 Gone`（或 `403 Forbidden`，需统一）
2. **API 层增加“不可用”拦截点**
   - 在读取/列出 Skill 文件、读取指定版本等“内容访问类接口”前检查 `Skill.is_active`
   - 策略建议：下架后禁止读取与执行；允许上传新版本并显式激活（取决于产品策略）
3. **MCP 工具增加“不可用”拦截点**
   - 在 `load_skill` / `read_reference_file` / `run_shell_command` 等工具执行前校验 Skill 是否启用
   - 注意：当前 MCP 工具主要基于文件系统读取，需引入 DB 校验以避免绕过 `is_active`
4. **前端/客户端对接要点（供 C 端实现）**
   - 下架后：客户端缓存命中时若 `cached_at <= cache_revoked_at`，视为失效并重新拉取/禁止使用
5. **补齐测试（作为改代码时的验收项）**
   - API：下架 Skill 的文件读取/内容访问返回 `SKILL_DEACTIVATED`
   - MCP：下架 Skill 的工具调用返回 `SKILL_DEACTIVATED`
   - 数据：`cache_revoked_at` 有值且随下架更新

### 补充执行序列：更完整的依赖声明规范与多语言依赖生态适配（设计方案）

> 背景：当前依赖声明仅支持 `dependencies: [a, b]` 这类简化写法，且默认按 Python/pip 输出安装指引；当 Skill 涉及 Node/Conda/Poetry 等生态时缺少可表达、可校验、可扩展的统一模型。
>
> 目标：在不改变 CS 定位（S 端不执行安装）的前提下，S 端能“存得下/看得懂/给得出安装指引”，C 端/执行器能“按生态自动安装并运行”。

1. **定义依赖声明的统一数据模型（Schema v1）**
   - 引入 `dependency_spec`（JSON）作为权威结构，支持多生态并行声明
   - 推荐结构（示例）：
     - `schema_version: 1`
     - `python`: `{ manager: "pip"|"poetry"|"uv"|"conda", requirements: [...], files: [...] }`
     - `node`: `{ manager: "npm"|"pnpm"|"yarn", package_json: {...}, lockfile: "package-lock.json" }`
     - `system`: `{ packages: [...], notes: "..." }`
   - 兼容策略：原有 `dependencies: [..]` 视为 `python.manager="pip"` 的 requirements 简写
2. **定义 Skill 包内“依赖声明文件”的优先级与来源**
   - 来源优先级建议：`metadata` 表单 JSON > `SKILL.md` frontmatter > 依赖清单文件
   - 支持识别的文件（可选）：`requirements.txt`、`pyproject.toml`、`environment.yml`、`package.json`
   - 规则：S 端只解析与存储，不执行安装；必要时回填为 `dependency_spec`
3. **增强解析与校验（S 端）**
   - `SKILL.md` frontmatter 建议切换到标准 YAML 解析（否则复杂结构无法可靠表达）
   - 校验项：
     - `schema_version` 是否支持
     - 每个生态的字段完整性（例如 npm 必须有 `package_json.name` 或明确依赖列表）
     - 依赖条目长度/数量/字符集限制（避免滥用）
4. **后端数据落地（S 端）**
   - 在 SkillVersion 维度存储 `dependency_spec`（JSON）与 `dependency_spec_version`
   - 保留 `dependencies`（list[str]）作为向后兼容字段或派生字段（可选，逐步弃用）
5. **对外接口调整（仍为“指引/元数据”而非“安装执行”）**
   - `GET install-instructions` 按生态返回：
     - `strategy=client`
     - `ecosystem="python"|"node"|...`
     - `commands`：面向执行器的推荐命令（如 `pip install -r requirements.txt` / `npm ci`）
     - `manifests`：依赖清单原文或 JSON（用于执行器生成环境）
6. **客户端/执行器对接约定（C 端实现）**
   - 按 `dependency_spec` 选择隔离环境策略（venv/uv/conda/node_modules）
   - 以 `skill_id@version` 为粒度缓存环境；版本变更或策略变更需重建
7. **验收与测试（改代码时的检查项）**
   - ZIP 上传：不同生态依赖声明能被解析并持久化到 SkillVersion
   - install-instructions：能按生态输出稳定结构与可执行命令
   - 兼容性：旧版 `dependencies: [...]` 的 Skill 行为不变

---

## 状态说明

| 状态 | 符号 | 描述 |
|------|------|------|
| 未开始 | ⬜ | 任务尚未开始 |
| 进行中 | 🔵 | 任务正在进行 |
| 已完成 | ✅ | 任务已完成 |
| 已验证 | ✔️ | 任务已完成并通过验证 |
| 阻塞 | 🔴 | 任务被阻塞 |
| 已跳过 | ⏭ | 当前迭代范围外，不纳入本轮验收 |

补充说明：

- 本表与 `project-spec.md` 的状态标签口径保持一致；`✔️ 已验证` 作为任务维度补充状态，仅用于表示“已完成且已执行验证”
- 任务状态仅表示执行进度，不替代 `checklist.md` 的逐项验收结果
- 涉及可见性与权限的任务描述，字段示例统一复用 `project-spec.md` 中“术语与状态统一口径”的示例模板
- 状态变更规范：将任务标记为 `✅ 已完成` 或 `✔️ 已验证` 时，应在 [checklist.md](./checklist.md) 中同步勾选对应验收项，并按“勾选证据规范”记录验证证据
