# SkillDrive API 参考手册

> 更新日期：2026-04-24 · 状态：Active  
> 本文档面向前端开发者、桌面客户端开发者以及需要集成 SkillDrive 的第三方开发者。

---

## 快速开始

### Base URL

所有业务接口统一以 `/api/v1` 为前缀，运维探针直接挂在根路径。

```
https://<your-domain>/api/v1
```

### 两种认证方式

SkillDrive 使用两套独立的认证体系，请根据场景选择：

| 场景 | 认证方式 | 请求头 |
|------|----------|--------|
| Web 控制台、普通用户操作 | **JWT 会话** | `Authorization: Bearer <access_token>` |
| CLI、CI、自动化脚本等程序化调用 | **API Token** | `Authorization: Bearer <api_token>` |

> 拿到 Token 后，所有需要认证的接口都通过 `Authorization: Bearer <token>` 传递。

### 错误处理

当请求失败时，服务端会返回统一格式的错误信息，方便你根据 `code` 做针对性处理：

```json
{
  "detail": "验证码已过期",
  "code": "VERIFICATION_EXPIRED",
  "timestamp": "2026-04-24T12:00:00Z"
}
```

常见 HTTP 状态码含义：

| 状态码 | 含义 | 典型场景 |
|--------|------|----------|
| `400` | 请求参数有误 | 字段缺失、格式不对 |
| `401` | 未认证或认证失效 | Token 过期、未携带 Token |
| `403` | 无权访问 | 功能开关关闭、RBAC 权限不足 |
| `404` | 资源不存在 | 技能、用户、Token 不存在 |
| `409` | 资源冲突 | 邮箱已被注册 |
| `429` | 请求过于频繁 | 验证码发送太频繁 |
| `503` | 服务暂不可用 | 数据库连接异常、SSO 配置错误 |

### 分页约定

列表接口默认支持分页，通过 URL 查询参数控制：

- `skip` — 跳过的记录数（默认 0）
- `limit` — 返回的最大条数（默认 100）

示例：`GET /api/v1/skills?skip=0&limit=20&q=search`

返回结构统一为：

```json
{
  "items": [...],
  "total": 256
}
```

---

## 目录

- [认证](#认证)
- [用户](#用户)
- [技能](#技能)
- [客户端技能（程序化接入）](#客户端技能)
- [API 令牌管理](#api-令牌管理)
- [仪表盘](#仪表盘)
- [审计日志](#审计日志)
- [运行时配置](#运行时配置)
- [运维探针](#运维探针)

---

## 认证

前缀：`/api/v1/auth`

### 发送验证码

```http
POST /auth/verification-code
```

用于邮箱 OTP 登录、注册、绑定邮箱或注销账号前的身份确认。服务端会向指定邮箱发送一次性验证码。

**请求体：**

```json
{
  "email": "user@example.com",
  "purpose": "login"
}
```

`purpose` 的可选值：

- `login` — 登录
- `register` — 注册
- `bind_email` — 绑定新邮箱
- `delete_account` — 注销账号

**响应：**

```json
{
  "sent": true,
  "expires_in": 300,
  "resend_interval": 60,
  "max_attempts": 5,
  "attempts_left": 4
}
```

> 需要管理员开启 `ENABLE_EMAIL_OTP_LOGIN` 功能开关。

---

### 注册账号

```http
POST /auth/register
```

新用户使用邮箱验证码注册。注册成功后会自动登录，返回 JWT 令牌对。

**请求体：**

```json
{
  "email": "user@example.com",
  "username": "alice",
  "code": "123456"
}
```

**响应：**

```json
{
  "access_token": "eyJhbGciOiJ...",
  "refresh_token": "eyJhbGciOiJ..."
}
```

> 需要开启 `ENABLE_PUBLIC_SIGNUP`。若邮箱已注册，返回 `409 Conflict`。

---

### 登录

```http
POST /auth/login
```

已注册用户通过邮箱验证码登录。如果用户不存在且允许公开注册，系统会自动创建账号。

**请求体：**

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**响应：** 同注册接口，返回 `TokenPair`。

---

### 刷新令牌

```http
POST /auth/refresh
```

`access_token` 即将过期时，用 `refresh_token` 换取新的令牌对，无需重新登录。

**请求体：**

```json
{
  "refresh_token": "eyJhbGciOiJ..."
}
```

**响应：** 新的 `TokenPair`。

---

### SSO 登录（OIDC）

```http
GET /auth/sso/authorize
```

发起单点登录流程。服务端会生成 `state` 和 `nonce` 防重放，然后 `302` 重定向到身份提供商（IdP）的授权页面。

> 需要开启 `ENABLE_SSO` 并正确配置 OIDC 参数。

```http
GET /auth/sso/callback?code=xxx&state=yyy
```

IdP 授权成功后回调此地址。服务端用授权码换取令牌，验证通过后再次 `302` 重定向回前端，并在 URL fragment 中携带 `access_token` 和 `refresh_token`：

```
https://frontend.example.com/callback#access_token=...&refresh_token=...
```

如果失败，错误信息会通过 URL query 参数带回：

```
https://frontend.example.com/callback?error=sso_error&error_description=...
```

---

### LDAP 登录

```http
POST /auth/ldap/login
```

企业内部用户可以通过 LDAP 账号密码直接登录。

**请求体：**

```json
{
  "username": "alice",
  "password": "secret"
}
```

**响应：** `TokenPair`

> 需要开启 `ENABLE_LDAP`。

---

### 登出

```http
POST /auth/logout
```

使当前用户所有已颁发的 JWT 立即失效（通过递增用户的 `jwt_token_version` 实现）。

**认证：** JWT 登录用户  
**响应：** `204 No Content`

---

## 用户

前缀：`/api/v1/users`

### 获取当前用户信息

```http
GET /users/me
```

返回当前登录用户的完整信息。

**响应：**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "alice@example.com",
  "username": "alice",
  "is_active": true,
  "is_superuser": false,
  "enterprise_id": null,
  "team_id": null,
  "role": "user",
  "status": "active",
  "created_at": "2026-04-01T00:00:00Z",
  "updated_at": "2026-04-01T00:00:00Z"
}
```

---

### 更新当前用户信息

```http
PUT /users/me
```

支持部分更新，只需传需要修改的字段。

**请求体：**

```json
{
  "username": "alice_new"
}
```

**响应：** 更新后的 `UserResponse`。

---

### 申请注销账号

```http
POST /users/me/delete-request
```

向当前用户邮箱发送注销确认验证码。拿到验证码后，再调用下面的删除接口完成注销。

**响应：** `204 No Content`

---

### 确认注销账号

```http
DELETE /users/me
```

**请求体：**

```json
{
  "code": "123456"
}
```

**响应：** `204 No Content`

> 注销后用户数据将被清理，操作不可恢复。

---

### 绑定新邮箱

```http
POST /users/bind-email
```

先调用发送验证码接口（`purpose=bind_email`），再用验证码绑定。

**请求体：**

```json
{
  "email": "new@example.com",
  "code": "123456"
}
```

**响应：**

```json
{
  "bound": true
}
```

> 如果新邮箱已被其他账号使用，返回 `409 Conflict`。

---

### 列出所有用户（管理员）

```http
GET /users?q=alice&skip=0&limit=20
```

**权限：** 管理员角色（`admin` 或 `superuser`）  
**响应：** `UserListResponse`

---

### 更新用户身份属性（管理员）

```http
PUT /users/{user_id}/identity
```

管理员可以修改指定用户的企业、团队、角色和状态。

**请求体：**

```json
{
  "enterprise_id": "ent-1",
  "team_id": "team-1",
  "role": "admin",
  "status": "active"
}
```

**响应：** 更新后的 `UserResponse`

---

## 技能

前缀：`/api/v1/skills`

> 以下接口主要面向 Web 控制台，使用 **JWT 会话认证**。权限通过 RBAC 控制。

### 工作区技能列表

```http
GET /skills?q=search&include_inactive=false
```

返回当前用户工作区内的技能，支持关键词搜索和是否包含已停用技能。

**权限：** `skill.list`  
**响应：** `SkillListResponse`

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "my-skill",
      "description": "A useful skill",
      "tags": ["tag1", "tag2"],
      "visible": "private",
      "current_version": "1.2.0",
      "is_active": true,
      "created_at": "2026-04-01T00:00:00Z",
      "updated_at": "2026-04-01T00:00:00Z"
    }
  ],
  "total": 42
}
```

---

### 公共技能库

```http
GET /skills/public?q=search
```

浏览平台公开的共享技能，可引用或克隆到自己的工作室。

**权限：** `skill.list`  
**响应：** `PublicSkillListResponse`

---

### 获取技能详情

```http
GET /skills/{skill_uuid}
```

查看某个技能的完整信息，包括当前版本、可见性、来源等。

**权限：** `skill.read`  
**响应：** `SkillConsoleResponse`

---

### 创建技能

```http
POST /skills
```

在工作室中创建一个空技能，后续可通过上传接口填充内容。

**请求体：**

```json
{
  "name": "my-skill",
  "description": "A useful skill",
  "tags": ["tag1", "tag2"],
  "visible": "private"
}
```

`visible` 可选值：

- `private` — 仅自己可见
- `team` — 团队内可见
- `enterprise` — 企业内可见

**权限：** `skill.create`  
**响应：** `SkillConsoleResponse`

---

### 更新技能

```http
PUT /skills/{skill_uuid}
```

支持部分更新，传什么改什么。

**请求体：**

```json
{
  "name": "new-name",
  "description": "Updated description",
  "tags": ["ai", "automation"],
  "visible": "team"
}
```

**权限：** `skill.update`  
**响应：** `SkillConsoleResponse`

---

### 删除技能

```http
DELETE /skills/{skill_uuid}?delete_archives=false
```

`delete_archives=true` 时，会同时删除技能的所有历史归档文件。

**权限：** `skill.delete`  
**响应：** `204 No Content`

---

### 引用公共技能

```http
POST /skills/{public_uuid}/reference
```

将公共库中的某个技能引用到自己的工作室。引用是轻量级的链接关系，不会复制代码，但可以固定使用某个版本。

**请求体：**

```json
{
  "name": "my-reference",
  "pinned_version": "1.0.0"
}
```

**权限：** `skill.create`  
**响应：** `SkillConsoleResponse`

---

### 克隆公共技能

```http
POST /skills/{public_uuid}/clone
```

将公共技能完整复制一份到自己的工作室，成为独立副本，可自由修改。

**请求体：**

```json
{
  "name": "my-clone",
  "visible": "private"
}
```

**权限：** `skill.create`  
**响应：** `SkillConsoleResponse`

---

### 固定 / 取消固定版本

```http
PUT /skills/{skill_uuid}/pin
```

对于引用类型的技能，固定到指定版本后，即使公共源技能更新，你的引用也不会自动跟随。

**请求体：**

```json
{
  "version": "1.2.0"
}
```

```http
PUT /skills/{skill_uuid}/unpin
```

取消固定，恢复自动跟随公共源的最新版本。

**权限：** `skill.update`  
**响应：** `SkillConsoleResponse`

---

### 上传技能文件

```http
POST /skills/upload
Content-Type: multipart/form-data
```

支持两种上传模式：

| 场景 | 表单字段 | 行为 |
|------|----------|------|
| 上传 ZIP 创建新技能 | `file` + `visibility` | 自动解析 ZIP 创建技能 |
| 上传 ZIP 更新现有技能 | `file` + `skill_uuid` | 为现有技能创建新版本 |
| 上传单个文件 | `file` + `skill_uuid` | 追加/覆盖技能内的文件 |

**表单字段：**

- `file`（必填）— 文件或 ZIP 包
- `skill_uuid`（可选）— 目标技能 ID
- `visibility`（可选）— 新建技能时的可见性，默认 `private`
- `metadata`（可选）— JSON 字符串，附加元数据

**权限：** `skill.upload`

---

### 激活与停用

```http
POST /skills/{skill_uuid}/deactivate
POST /skills/{skill_uuid}/activate
```

停用后技能不会被客户端拉取，但数据保留，可随时重新激活。

**权限：** `skill.update`  
**响应：** `SkillConsoleResponse`

---

### 版本管理

#### 列出所有版本

```http
GET /skills/{skill_uuid}/versions
```

**响应：**

```json
{
  "items": [
    {
      "version": "1.0.0",
      "description": "Initial release",
      "dependencies": ["requests"],
      "metadata": {},
      "created_at": "2026-04-01T00:00:00Z"
    }
  ]
}
```

#### 对比两个版本

```http
GET /skills/{skill_uuid}/versions/diff?from=1.0.0&to=1.1.0
```

**响应：**

```json
{
  "from_version": "1.0.0",
  "to_version": "1.1.0",
  "added": ["new_file.py"],
  "removed": ["old_file.py"],
  "modified": [
    {
      "path": "main.py",
      "diff": "@@ -1,3 +1,4 @@..."
    }
  ]
}
```

#### 获取版本详情

```http
GET /skills/{skill_uuid}/versions/{version}
```

#### 获取安装说明

```http
GET /skills/{skill_uuid}/versions/{version}/install-instructions
```

返回该版本的安装策略、依赖列表和安装命令，供客户端自动化安装使用。

**响应：**

```json
{
  "strategy": "pip",
  "dependencies": ["requests", "numpy"],
  "requirements_text": "requests>=2.0\nnumpy>=1.20",
  "commands": ["pip install -r requirements.txt"],
  "ecosystem": "python"
}
```

#### 回滚到指定版本

```http
POST /skills/{skill_uuid}/versions/{version}/rollback
```

将技能回滚到历史某个版本，会创建一个新版本（内容等同于目标版本）。

**权限：** `skill.update`  
**响应：** `SkillVersionResponse`

---

### 浏览技能文件

```http
GET /skills/{skill_uuid}/files
```

列出技能当前版本的所有文件路径。

```http
GET /skills/{skill_uuid}/files/{file_path}
```

获取单个文件的原始内容，返回 `text/plain; charset=utf-8`。

**权限：** `skill.read`

---

### 缓存策略

```http
GET /skills/cache-policy
```

返回客户端缓存技能的策略配置，包括缓存 TTL 和加密开关。

**响应：**

```json
{
  "cache_ttl_seconds": 3600,
  "encryption_enabled": true,
  "download_encryption_enabled": true
}
```

---

## 客户端技能

前缀：`/api/v1/client/skills`

> 这组接口面向 **程序化客户端**（CLI、CI、自动化脚本等），使用 **API Token** 认证。

### 列出可下载的技能

```http
GET /client/skills?q=search
```

返回当前 API Token 有权访问的技能列表，包含是否可下载标识和最新版本信息。

**权限：** API Token + `skill.read`  
**响应：** `ClientSkillListResponse`

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "my-skill",
      "is_downloadable": true,
      "latest_version": {
        "version": "1.2.0",
        "description": "Latest",
        "dependencies": [],
        "metadata": {},
        "created_at": "2026-04-01T00:00:00Z"
      }
    }
  ],
  "total": 5
}
```

---

### 下载技能包

```http
POST /client/skills/download
```

客户端通过此接口获取加密后的技能包，用于本地安装或缓存。

**请求体：**

```json
{
  "skill_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "version": "1.2.0"
}
```

`version` 可选，不传则下载最新版本。

**权限：** API Token + `skill.download`  
**响应：** `SkillDownloadResponse`

```json
{
  "skill_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "version": "1.2.0",
  "encrypted_code": "base64encoded...",
  "checksum": "sha256:abc123...",
  "expires_at": "2026-04-24T13:00:00Z",
  "cache_ttl_seconds": 3600,
  "archive_size_bytes": 10240,
  "encryption_enabled": true,
  "download_filename": "my-skill-1.2.0.zip",
  "decryption_hint": null
}
```

> `encrypted_code` 是加密后的技能包内容，客户端需根据 `encryption_enabled` 判断是否解密。

---

## API 令牌管理

前缀：`/api/v1/tokens`

API Token 是程序化接入的凭证。每个用户可以创建多个 Token，并设置有效期。

### 列出我的 Token

```http
GET /tokens
```

**响应：** `TokenListResponse`

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "cli-token",
      "token": null,
      "is_active": true,
      "expires_at": null,
      "last_used_at": null,
      "created_at": "2026-04-01T00:00:00Z"
    }
  ],
  "total": 3
}
```

> 列表接口出于安全考虑不返回 `token` 明文。

---

### 创建 Token

```http
POST /tokens
```

**请求体：**

```json
{
  "name": "ci-token",
  "expires_at": "2026-12-31T23:59:59Z"
}
```

`expires_at` 可选，不传则永久有效。

**响应：** `TokenResponse`（**仅创建时返回一次 `token` 明文，请务必保存**）

```json
{
  "id": "uuid",
  "name": "ci-token",
  "token": "sk_live_xxxxxxxxxxxx",
  "is_active": true,
  "expires_at": "2026-12-31T23:59:59Z",
  "created_at": "2026-04-24T00:00:00Z"
}
```

---

### 撤销 Token

```http
DELETE /tokens/{token_id}
```

撤销后该 Token 立即失效，无法继续使用。

**响应：** `204 No Content`

---

## 仪表盘

前缀：`/api/v1/dashboard`

### 概览数据

```http
GET /dashboard/overview
```

返回当前用户的技能、Token 和请求成功率等核心指标。

**权限：** `DASHBOARD_READ`  
**响应：**

```json
{
  "active_skills": 5,
  "available_tokens": 2,
  "success_rate": 98.5,
  "success_rate_window_hours": 24,
  "success_rate_total": 120
}
```

---

### 清理历史指标（管理员）

```http
POST /dashboard/metrics/cleanup
```

清理超过保留期限的历史请求指标数据。

**请求体：**

```json
{
  "retention_days": 30
}
```

不传则使用系统默认配置 `METRICS_RETENTION_DAYS`。

**权限：** 管理员角色  
**响应：**

```json
{
  "removed": 1000,
  "retention_days": 30,
  "cutoff": "2026-03-25T00:00:00Z"
}
```

---

### 重置 24 小时指标（管理员）

```http
POST /dashboard/metrics/reset-24h
```

清空最近 24 小时的指标记录，用于排查或重新统计。

**权限：** 管理员角色  
**响应：**

```json
{
  "removed": 42,
  "window_hours": 24,
  "window_start": "2026-04-23T12:00:00Z",
  "window_end": "2026-04-24T12:00:00Z"
}
```

---

## 审计日志

前缀：`/api/v1/audit`

> 需要开启 `ENABLE_AUDIT_LOG` 和 `ENABLE_AUDIT_EXPORT` 功能开关。

### 查询日志

```http
GET /audit/logs?action=skill.create&start=2026-04-01T00:00:00Z&limit=50
```

支持按操作人、操作类型、时间范围筛选。

**权限：** 管理员角色  
**响应：**

```json
{
  "items": [
    {
      "id": "uuid",
      "actor_id": "user-uuid",
      "action": "skill.create",
      "target": "skill-uuid",
      "result": "success",
      "timestamp": "2026-04-01T00:00:00Z",
      "ip": "192.168.1.1",
      "user_agent": "Mozilla/5.0",
      "details": {}
    }
  ]
}
```

---

### 导出日志

```http
POST /audit/logs/export
```

将审计日志导出为 JSON 或 CSV 格式。

**请求体：**

```json
{
  "format": "json",
  "filters": {
    "action": "skill.create",
    "start": "2026-04-01T00:00:00Z",
    "end": "2026-04-24T23:59:59Z"
  }
}
```

`format` 可选 `json` 或 `csv`。

**权限：** 管理员角色  
**响应：**

```json
{
  "format": "json",
  "content": "[{...}, {...}]"
}
```

---

## 运行时配置

前缀：`/api/v1/runtime-config`

### 获取能力配置

```http
GET /runtime-config
```

无需认证。返回当前服务端启用的功能开关，前端/客户端应在启动时获取，用于动态控制界面展示。

**响应：**

```json
{
  "capabilities": {
    "skill_visibility": true,
    "public_skills": true,
    "org_model": false,
    "public_signup": true,
    "email_otp_login": true,
    "sso": false,
    "ldap": false,
    "audit_log": true,
    "audit_export": true,
    "rbac": true,
    "no_rbac_mode": false
  }
}
```

---

## 运维探针

以下接口直接挂在根路径，用于负载均衡健康检查和监控。

### 存活探针

```http
GET /livez
```

进程是否存活。

**响应：**

```json
{ "status": "alive" }
```

---

### 就绪探针

```http
GET /readyz
GET /health
```

服务是否就绪（数据库连接正常）。

**正常响应：**

```json
{
  "status": "healthy",
  "db_connected": true
}
```

**异常响应：** `503 Service Unavailable`

```json
{
  "status": "unhealthy",
  "db_connected": false
}
```

---

### 系统指标

```http
GET /metrics
```

返回数据库连接状态、磁盘、内存、CPU 使用率。

> 需要开启 `ENABLE_METRICS`，否则返回 `404`。

**响应：**

```json
{
  "db_connected": true,
  "disk_usage_percent": 45.2,
  "memory_usage_percent": 62.1,
  "cpu_usage_percent": 12.0
}
```

---

## 附录

### 权限速查表

| 权限 | 适用场景 |
|------|----------|
| `skill.list` | 浏览技能列表（工作区 + 公共库） |
| `skill.read` | 查看技能详情、版本、文件内容 |
| `skill.create` | 创建技能、引用、克隆 |
| `skill.update` | 修改技能、固定版本、回滚、激活/停用 |
| `skill.delete` | 删除技能 |
| `skill.upload` | 上传技能文件或 ZIP 包 |
| `skill.download` | 客户端下载加密技能包 |
| `DASHBOARD_READ` | 查看个人仪表盘 |

### 认证方式速查

| 依赖函数 | 用途 | 认证方式 |
|----------|------|----------|
| `get_current_active_user` | 普通用户接口 | JWT Access Token |
| `require_permission(...)` | 需要 RBAC 权限的接口 | JWT Access Token |
| `require_management_access()` | 管理员专用接口 | JWT Access Token |
| `get_current_api_token_user` | API Token 基础认证 | API Token |
| `require_api_token_permission(...)` | API Token + 权限 | API Token |
| `require_api_token_skill_download_access()` | 技能下载专用 | API Token |

### 相关代码

- 路由注册：[backend/api/router.py](/d:/Github/open-skillhub/backend/api/router.py)
- 应用入口：[backend/api_app.py](/d:/Github/open-skillhub/backend/api_app.py)
- 认证与权限：[backend/core/deps.py](/d:/Github/open-skillhub/backend/core/deps.py)
- 数据模型：[backend/schemas/](/d:/Github/open-skillhub/backend/schemas/)
