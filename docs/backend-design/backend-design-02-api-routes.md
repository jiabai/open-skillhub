# Open SkillHub 后端设计与开发文档 — API 路由设计

> 本文档描述 REST API v1 路由、MCP 端点、传输层及路由权限矩阵。

---

## 1. REST API v1

所有 REST API 挂载在 `/api/v1/` 前缀下，通过 `api_router.py` 聚合。

### 1.1 路由聚合

```python
api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(audit_router, prefix="/audit", tags=["audit"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(tokens_router, prefix="/tokens", tags=["tokens"])
api_router.include_router(skills_router, prefix="/skills", tags=["skills"])
```

### 1.2 Auth 路由 — `/api/v1/auth`

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/verification-code` | 发送邮箱验证码 | 否 |
| POST | `/email/login` | 邮箱 + 验证码登录 | 否 |
| POST | `/email/register` | 邮箱注册 | 否 |
| POST | `/sso/login` | SSO JWT 登录 | 否 |
| POST | `/ldap/login` | LDAP 登录 | 否 |
| POST | `/token/refresh` | 刷新 Access Token | Refresh Token |
| POST | `/logout` | 登出 | Access Token |

**验证码用途**（`purpose`）：`login`、`register`、`bind_email`、`delete_account`

### 1.3 Users 路由 — `/api/v1/users`

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/me` | 获取当前用户信息 | 已认证 |
| PUT | `/me` | 更新当前用户信息 | 已认证 |
| POST | `/me/delete-request` | 请求删除账号（发验证码） | 已认证 |
| DELETE | `/me` | 确认删除账号 | 已认证 + 验证码 |
| POST | `/me/bind-email` | 绑定邮箱 | 已认证 |

### 1.4 Tokens 路由 — `/api/v1/tokens`

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/` | 列出当前用户的 API Token | 已认证 |
| POST | `/` | 创建新的 API Token | 已认证 |
| DELETE | `/{token_id}` | 撤销指定 Token | 已认证（自己的 Token） |

### 1.5 Skills 路由 — `/api/v1/skills`

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/` | 列出可见的 Skills | `skill.list` |
| GET | `/cache-policy` | 获取缓存策略 | `skill.read` |
| POST | `/` | 创建 Skill | `skill.create` |
| GET | `/{skill_uuid}` | 获取 Skill 详情 | `skill.read` |
| PUT | `/{skill_uuid}` | 更新 Skill 元信息 | `skill.update` |
| DELETE | `/{skill_uuid}` | 删除 Skill | `skill.delete` |
| POST | `/upload` | 上传 Skill 文件（multipart） | `skill.upload` |
| POST | `/download` | 下载 Skill 包 | `skill.download` |
| POST | `/{skill_uuid}/deactivate` | 停用 Skill | `skill.update` |
| POST | `/{skill_uuid}/activate` | 激活 Skill | `skill.update` |
| GET | `/{skill_uuid}/versions` | 列出版本 | `skill.read` |
| GET | `/{skill_uuid}/versions/{version}/install-instructions` | 获取安装指令 | `skill.read` |
| GET | `/{skill_uuid}/versions/diff` | 对比两个版本差异 | `skill.read` |
| POST | `/{skill_uuid}/versions/{version}/rollback` | 回滚到指定版本 | `skill.update` |
| GET | `/{skill_uuid}/files` | 列出 Skill 文件 | `skill.read` |
| GET | `/{skill_uuid}/files/{file_path:path}` | 读取 Skill 文件内容 | `skill.read` |

### 1.6 Audit 路由 — `/api/v1/audit`

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/logs` | 查询审计日志 | `audit.read` |
| POST | `/logs/export` | 导出审计日志 | `audit.export` |

**查询参数**： `actor_id`、`action`、`start`（ISO8601）、`end`（ISO8601）、`skip`、`limit`

### 1.7 Dashboard 路由 — `/api/v1/dashboard`

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/overview` | 获取仪表盘概览 | 已认证 |
| POST | `/metrics/cleanup` | 清理过期指标（仅超级用户） | 超级用户 |
| POST | `/metrics/reset-24h` | 重置 24 小时窗口指标 | 已认证 |

---

## 2. MCP 端点与传输层

### 2.1 端点挂载

FastAPI 应用挂载了两个 MCP 相关路径：

```python
application.mount("/mcp", McpAppProxy(get_http_app))   # HTTP 传输
application.mount("/sse", McpAppProxy(get_sse_app))   # SSE 传输
```

### 2.2 HTTP 传输（`/mcp`）

- 遵循 StreamableHTTP 规范
- 支持会话维持（`session_id` 参数）
- 通过 Bearer Token 认证

### 2.3 SSE 传输（`/sse`）

- 基于 Server-Sent Events
- 适合服务端推送场景
- 同样通过 Bearer Token 认证

### 2.4 MCP 请求认证流程

```
1. 从 Authorization Header 提取 Bearer Token
2. 验证 Token 格式（Bearer xxxxx）
3. 数据库查询 Token 是否存在且未过期
4. 提取用户上下文（user_id）并设置到 ContextVar
5. 将请求转发给底层 McpAppProxy
```

---

## 3. 路由权限矩阵

### 3.1 RBAC 权限定义

| 权限 | 说明 | 默认角色 |
|------|------|---------|
| `skill.list` | 列出 Skills | member, viewer |
| `skill.read` | 读取 Skill 详情 | member, viewer |
| `skill.create` | 创建 Skill | member |
| `skill.update` | 更新 Skill | member |
| `skill.delete` | 删除 Skill | member |
| `skill.upload` | 上传文件 | member |
| `skill.download` | 下载 Skill 包 | member |
| `skill.execute` | 执行 Skill | member |
| `audit.read` | 读取审计日志 | admin |
| `audit.export` | 导出审计日志 | admin |
| `token.*` | Token 管理 | 所有者 |

### 3.2 角色默认权限

| 角色 | 权限 |
|------|------|
| `admin` | `*`（所有权限） |
| `member` | skill.list, skill.read, skill.create, skill.update, skill.delete, skill.upload, skill.execute |
| `viewer` | skill.list, skill.read |

### 3.3 Skill 可见性规则

当 `ENABLE_SKILL_VISIBILITY=true` 时：

| visibility 值 | 可见范围 |
|---------------|---------|
| `private` | 仅所有者 |
| `team` | 同一企业 + 同一团队 |
| `enterprise` | 同一企业内所有团队 |

---

## 4. 全局中间件与特殊路由

### 4.1 中间件栈

```
请求 → CORSMiddleware → RequestLoggingMiddleware → RateLimitMiddleware → DeprecationMiddleware → 路由
```

### 4.2 全局端点

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| GET | `/health` | 健康检查（包含 DB 连接状态） | 否 |
| GET | `/metrics` | Prometheus 指标 | `ENABLE_METRICS=true` |

### 4.3 功能开关影响

| 配置项 | 受影响路由 |
|--------|-----------|
| `ENABLE_EMAIL_OTP_LOGIN=false` | `/auth/verification-code`、`/auth/email/login` 返回 403 |
| `ENABLE_AUDIT_LOG=false` | `/audit/*` 返回 403 |
| `ENABLE_AUDIT_EXPORT=false` | `POST /audit/logs/export` 返回 403 |
| `ENABLE_METRICS=false` | `GET /metrics` 返回 404 |
| `ENABLE_RATE_LIMIT=false` | 限流中间件禁用 |

---

## 5. 错误响应格式

所有 API 错误返回统一格式：

```json
{
  "detail": "错误描述",
  "code": "ERROR_CODE",
  "timestamp": "2026-03-20T10:00:00Z"
}
```

常见错误码：

| HTTP 状态码 | code | 说明 |
|------------|------|------|
| 400 | `BAD_REQUEST` | 请求格式错误 |
| 401 | `UNAUTHORIZED` | 未认证或 Token 无效 |
| 403 | `FORBIDDEN` | 无权限或功能禁用 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `CONFLICT` | 资源冲突（如邮箱已注册） |
| 422 | `VALIDATION_ERROR` | 请求参数校验失败 |
| 429 | `RATE_LIMITED` | 请求过于频繁 |
| 410 | `SKILL_DEACTIVATED` | Skill 已停用 |
| 500 | `INTERNAL_SERVER_ERROR` | 服务器内部错误 |

---

## 6. 指标端点详情

### 6.1 GET /metrics

返回系统运行指标（需要 `ENABLE_METRICS=true`）：

```json
{
  "db_connected": true,
  "disk_usage_percent": 45.2,
  "memory_usage_percent": 62.5,
  "cpu_usage_percent": 15.3
}
```

| 字段 | 说明 |
|------|------|
| `db_connected` | 数据库连接状态 |
| `disk_usage_percent` | Skill 存储磁盘使用率 |
| `memory_usage_percent` | 系统内存使用率 |
| `cpu_usage_percent` | CPU 使用率 |

### 6.2 指标保留与清理

- 指标数据默认保留 90 天（可通过 `METRICS_RETENTION_DAYS` 配置）
- 超级用户可调用 `POST /api/v1/dashboard/metrics/cleanup` 手动清理

---

## 7. 中间件特殊处理

### 7.1 路径尾部斜杠处理

系统对 `/mcp` 和 `/sse` 端点自动处理尾部斜杠：
- 请求 `/mcp` 会自动重定向到 `/mcp/`
- 请求 `/sse` 会自动重定向到 `/sse/`

### 7.2 中间件执行顺序

```
请求 → CORSMiddleware → RequestLoggingMiddleware → RateLimitMiddleware → DeprecationMiddleware → SlashPathMiddleware → 路由
```
