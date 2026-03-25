# Open SkillHub 后端设计与开发文档 — 安全机制设计

> 本文档描述认证流程、JWT/Token 机制、RBAC 权限模型及审计日志。

---

## 1. 认证流程

### 1.1 登录方式概览

| 登录方式 | 配置开关 | 说明 |
|---------|---------|------|
| 邮箱 + 验证码 | `ENABLE_EMAIL_OTP_LOGIN` | 发送验证码到邮箱 |
| SSO JWT | `ENABLE_SSO` | 解析外部 IdP 的 JWT |
| LDAP | `ENABLE_LDAP` | LDAP 目录认证 |
| 公开注册 | `ENABLE_PUBLIC_SIGNUP` | 是否允许公开注册账号 |

### 1.2 邮箱验证码登录/注册流程

```
1. POST /api/v1/auth/verification-code
   - 传入 email + purpose（login/register/bind_email/delete_account）
   - 服务端生成 6 位验证码，存哈希（bcrypt）到数据库
   - 验证码 5 分钟内有效
   - 同一邮箱 + purpose 组合共用一条记录（UniqueConstraint）

2a. POST /api/v1/auth/login
   - 传入 email + code
   - 服务端验证：
     - 验证码存在
     - 未过期（expires_at）
     - 剩余尝试次数 &gt; 0（max_attempts - attempts_left）
     - 哈希匹配
   - 验证成功后删除验证码记录
   - 返回 TokenPair（access_token + refresh_token）

2b. POST /api/v1/auth/register
   - 传入 email + code + username
   - 需要 ENABLE_PUBLIC_SIGNUP=true
   - 验证验证码（purpose=register）
   - 自动生成随机密码（24字符 URL-safe）
   - 返回 TokenPair（access_token + refresh_token）
```

**防暴力破解**：
- 每个验证码最多尝试 5 次（`max_attempts`）
- 重发需等待 60 秒（`resend_available_at`）

### 1.3 SSO JWT 登录流程

```
1. 外部 IdP 签发 JWT，包含 claims：
   - email（由 SSO_EMAIL_CLAIM 指定 claim 名）
   - username（由 SSO_USERNAME_CLAIM 指定）
   - enterprise_id（由 SSO_ENTERPRISE_CLAIM 指定）
   - team_id（由 SSO_TEAM_CLAIM 指定）
   - role（由 SSO_ROLE_CLAIM 指定）
   - status（由 SSO_STATUS_CLAIM 指定，默认 active）

2. POST /api/v1/auth/sso/login
   - 服务端用 SSO_JWT_SECRET 解码验证
   - 验证 issuer / audience（如果配置了）
   - 查找或创建用户（自动注册）
   - 根据 ENABLE_ORG_MODEL 和 ENABLE_RBAC 决定是否写入 enterprise_id / role
   - 返回 TokenPair
```

### 1.4 LDAP 登录流程

```
1. POST /api/v1/auth/ldap/login
   - 动态导入 ldap3 库
   - 用提供的 username/password 连接 LDAP 服务器
   - 查询用户属性（邮箱、用户名、企业、团队、角色、状态）
   - 查找或创建用户
   - 返回 TokenPair
```

---

## 2. JWT 与 Token 机制

### 2.1 Access Token

- **用途**：API 认证（放在 `Authorization: Bearer <token>` Header）
- **过期时间**：`ACCESS_TOKEN_EXPIRE_MINUTES`（默认 30 分钟）
- **Payload**：
  ```json
  { "sub": "<user_id>", "type": "access", "exp": <timestamp> }
  ```

### 2.2 Refresh Token

- **用途**：换取新的 Access Token
- **过期时间**：`REFRESH_TOKEN_EXPIRE_DAYS`（默认 7 天）
- **Payload**：
  ```json
  { "sub": "<user_id>", "type": "refresh", "exp": <timestamp> }
  ```
- **刷新端点**：`POST /api/v1/auth/refresh`

### 2.3 API Token

- **用途**：MCP 请求认证（长期 Token）
- **格式**：`ask_live_` 前缀 + 64 字符随机 hex（共 73 字符）
- **特点**：
  - 用户自行创建，可设置过期时间
  - 数据库只存储 SHA256 哈希（`token_hash`），不存储明文
  - 支持多 Token 并存（每个有独立 name）
  - 可随时撤销

### 2.4 Token 安全设计

| Token 类型 | 存储 | 传输 | 过期机制 |
|-----------|------|------|---------|
| Access Token | 不存储（无状态 JWT） | Header Bearer | 自动过期 |
| Refresh Token | 不存储（无状态 JWT） | 请求体 | 自动过期 |
| API Token | SHA256 哈希 | Header Bearer / MCP | 可选过期、可撤销 |

---

## 3. RBAC 权限模型

### 3.1 权限定义

| 权限 | 说明 |
|------|------|
| `skill.list` | 列出 Skills |
| `skill.read` | 读取 Skill 详情 |
| `skill.create` | 创建 Skill |
| `skill.update` | 更新 Skill |
| `skill.delete` | 删除 Skill |
| `skill.upload` | 上传文件 |
| `skill.download` | 下载 Skill 包 |
| `skill.execute` | 执行 Skill |
| `audit.read` | 读取审计日志 |
| `audit.export` | 导出审计日志 |

### 3.2 角色与权限

| 角色 | 默认权限 |
|------|---------|
| `admin` | `*`（所有权限） |
| `member` | skill.list, skill.read, skill.create, skill.update, skill.delete, skill.upload, skill.execute |
| `viewer` | skill.list, skill.read |

**配置覆盖**：可通过 `RBAC_ROLE_PERMISSIONS` 环境变量覆盖默认权限。

### 3.3 权限检查逻辑

```python
def has_permission(user: User, permission: str) -> bool:
    if not settings.ENABLE_RBAC:
        return True  # RBAC 禁用时全部放行
    if user.is_superuser:
        return True
    role = user.role or settings.DEFAULT_ROLE
    permissions = get_role_permissions().get(role, set())
    return "*" in permissions or permission in permissions
```

### 3.4 Skill 可见性

| visibility 值 | 可见条件 |
|---------------|---------|
| `private` | `skill.user_id == current_user.id` |
| `team` | 同一 enterprise_id **且** 同一 team_id |
| `enterprise` | 同一 enterprise_id |

当 `ENABLE_SKILL_VISIBILITY=false` 时，所有 Skill 强制为 private。

---

## 4. 审计日志

### 4.1 审计事件

以下操作会记录审计日志（`ENABLE_AUDIT_LOG=true`）：

| 事件 | action | 触发时机 |
|------|--------|---------|
| 发送验证码 | `auth.verification_code.send` | 验证码发送成功 |
| 登录成功 | `auth.login` | 登录成功 |
| 登录失败 | `auth.login.failed` | 登录失败 |
| 注册成功 | `auth.register` | 注册成功 |
| SSO 登录 | `auth.sso.login` | SSO 登录成功 |
| LDAP 登录 | `auth.ldap.login` | LDAP 登录成功 |
| Token 刷新 | `auth.refresh` | Token 刷新成功 |
| Token 刷新失败 | `auth.refresh.failed` | Token 刷新失败 |
| 创建 Token | `token.create` | API Token 创建 |
| 创建 Skill | `skill.create` | Skill 创建 |
| 更新 Skill | `skill.update` | Skill 更新 |
| 删除 Skill | `skill.delete` | Skill 删除 |
| 上传文件 | `skill.upload` | 文件上传 |
| 下载 Skill | `skill.download` | Skill 下载 |
| 停用 Skill | `skill.deactivate` | Skill 停用 |
| 激活 Skill | `skill.activate` | Skill 激活 |
| 版本回滚 | `skill.rollback` | 版本回滚 |

### 4.2 审计字段

| 字段 | 说明 |
|------|------|
| `actor_id` | 操作者用户 ID |
| `action` | 操作类型 |
| `target` | 目标资源 ID |
| `result` | 结果：`success` / `failure` |
| `timestamp` | 操作时间（服务器时间） |
| `ip` | 客户端 IP |
| `user_agent` | User-Agent |
| `details` | 额外详情（JSON） |

### 4.3 审计查询与导出

- **查询**：`GET /api/v1/audit/logs`
  - 按 `actor_id`、`action`、`start`、`end` 过滤
  - 支持分页（`skip`/`limit`）
- **导出**：`POST /api/v1/audit/logs/export`
  - 将查询结果导出为文件（需要 `ENABLE_AUDIT_EXPORT=true`）
  - 支持格式：JSON、CSV

---

## 5. 中间件安全

### 5.1 中间件链

| 中间件 | 功能 |
|--------|------|
| `CORSMiddleware` | 跨域控制（`CORS_ORIGINS` 配置） |
| `RequestLoggingMiddleware` | 请求日志 |
| `RateLimitMiddleware` | 限流（`RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW`） |
| `DeprecationMiddleware` | 废弃 API 提醒（返回 `Deprecation` Header） |
| `SlashPathMiddleware` | 路径尾部斜杠处理（`/mcp`、`/sse`） |

### 5.2 限流配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `ENABLE_RATE_LIMIT` | true | 是否启用限流 |
| `RATE_LIMIT_REQUESTS` | 100 | 时间窗口内最大请求数 |
| `RATE_LIMIT_WINDOW` | 60 | 时间窗口（秒） |

---

## 6. 密码安全

- **哈希算法**：bcrypt（通过 passlib）
- **密码来源**：自动生成随机密码（SSO/LDAP 自动注册场景）
- **验证**：`verify_password(plain, hashed) → bool`
- **安全处理**：bcrypt 有 72 字节限制，超过 72 字节的密码会被安全截断

---

## 7. 额外安全配置项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `ENABLE_SANDBOX_EXECUTION` | false | 是否启用沙箱执行环境 |
| `ENABLE_RESOURCE_QUOTA` | false | 是否启用资源配额限制 |
| `ENABLE_NETWORK_EGRESS_CONTROL` | false | 是否启用网络出站控制 |
| `ENABLE_SKILL_DOWNLOAD_ENCRYPTION` | true | 是否启用 Skill 下载加密 |
| `ENABLE_LOCAL_CACHE_ENCRYPTION` | true | 是否启用本地缓存加密 |
| `ENABLE_CACHE_OFFLINE_FALLBACK` | true | 是否启用缓存离线回退 |
