# Open SkillHub 后端设计与开发文档 — 服务层设计

> 本文档描述业务服务层架构、Email/通知服务、缓存策略及配置管理。

---

## 1. 服务架构

### 1.1 分层设计

```
API Routes (api/v1/*.py)
    ↓ 依赖注入
Services (services/*.py)      # 业务逻辑
    ↓ 依赖注入
Repositories (repositories/*.py)  # 数据访问
    ↓
Database (SQLAlchemy ORM)
```

### 1.2 Service 类列表

| Service | 职责 |
|---------|------|
| `AuthService` | 认证（登录、注册、SSO、LDAP、Token 签发） |
| `UserService` | 用户信息更新、账号删除 |
| `TokenService` | API Token 的创建、验证、撤销 |
| `SkillService` | Skill CRUD、上传、下载、版本管理 |
| `AuditService` | 审计日志记录与查询 |
| `VerificationCodeService` | 验证码生成、验证、重发控制 |
| `EmailSender` | 邮件发送（纯文本 + HTML） |
| `DeprecationNotifier` | 废弃功能通知 |

---

## 2. AuthService

### 2.1 核心方法

| 方法 | 说明 |
|------|------|
| `register(email, username, password)` | 邮箱注册 |
| `login_sso(id_token)` | SSO JWT 登录 |
| `login_ldap(username, password)` | LDAP 登录 |
| `issue_token(user)` | 签发 TokenPair（access + refresh） |

### 2.2 SSO 字段映射

| JWT Claim | 用户字段 |
|----------|---------|
| `SSO_EMAIL_CLAIM`（默认 `email`） | `email` |
| `SSO_USERNAME_CLAIM`（默认 `username`） | `username` |
| `SSO_ENTERPRISE_CLAIM`（默认 `enterprise_id`） | `enterprise_id` |
| `SSO_TEAM_CLAIM`（默认 `team_id`） | `team_id` |
| `SSO_ROLE_CLAIM`（默认 `role`） | `role` |
| `SSO_STATUS_CLAIM`（默认 `status`） | `status` |

### 2.3 LDAP 集成

- 动态导入 `ldap3`（仅在 `ENABLE_LDAP=true` 时可用）
- LDAP 属性映射与 SSO 类似（通过 `LDAP_*_ATTR` 配置）

---

## 3. SkillService

### 3.1 核心方法

| 方法 | 说明 |
|------|------|
| `list_skills(user, ...)` | 列出可见的 Skills（按 visibility 过滤） |
| `get_skill(user, skill_id)` | 获取 Skill 详情（校验可见性） |
| `create_skill(user, name, ...)` | 创建 Skill |
| `update_skill(user, skill_id, **fields)` | 更新 Skill |
| `delete_skill(user, skill_id)` | 删除 Skill（含文件清理） |
| `upload_file(user, skill_id, filename, content)` | 上传单文件 |
| `upload_zip(user, skill_id, filename, content, metadata)` | 上传 ZIP 包 |
| `download_skill(user, skill_id, version)` | 下载 Skill 包 |
| `activate_skill(user, skill_id)` | 激活 Skill |
| `deactivate_skill(user, skill_id)` | 停用 Skill |
| `list_versions(user, skill_id)` | 列出版本 |
| `get_install_instructions(user, skill_id, version)` | 获取安装指令 |
| `diff_versions(user, skill_id, from, to)` | 版本差异对比 |
| `rollback_version(user, skill_id, version)` | 回滚版本 |

### 3.2 文件存储

- **存储路径**：`{SKILL_STORAGE_PATH}/{user_id}/{skill_name}/`
- **版本目录**：`{skill_dir}/versions/{version}/`
- **元数据存储**：SQLAlchemy 模型（不存储在文件系统）

---

## 4. TokenService

### 4.1 核心方法

| 方法 | 说明 |
|------|------|
| `create_token(user, name, expires_at)` | 创建 Token（返回 token 对象） |
| `create_token_with_value(user, name, expires_at)` | 创建 Token（返回 token 对象 + 明文值） |
| `list_tokens(user)` | 列出用户所有 Token |
| `revoke_token(user, token_id)` | 撤销 Token |
| `validate_token(token_value)` | 验证 API Token（用于 MCP 认证） |

### 4.2 Token 验证流程（MCP）

```
1. hash_token(token_value) → token_hash
2. TokenRepository.get_by_hash(token_hash)
3. 检查 is_active == True
4. 检查 expires_at 未过期（如果设置了）
5. 更新 last_used_at
6. 返回 APIToken 对象
```

---

## 5. AuditService

### 5.1 核心方法

| 方法 | 说明 |
|------|------|
| `create_event(actor_id, action, target, ...)` | 记录审计事件 |
| `list_events(actor_id, action, start, end, skip, limit)` | 查询审计日志 |
| `export_events(filters)` | 导出审计日志 |

### 5.2 审计日志记录时机

通过 `ENABLE_AUDIT_LOG` 开关控制。开启后，所有关键操作自动记录：

- 认证相关（登录、注册、验证码发送）
- Token 管理（创建、撤销）
- Skill 生命周期（创建、更新、删除、上传、下载）
- 管理员操作（指标清理、重置）

---

## 6. Email 与通知服务

### 6.1 EmailSender 接口

```python
class EmailSender(Protocol):
    def send_verification_code(
        self,
        email: str,
        code: str,
        expires_in: int,
        resend_interval: int,
        purpose: str,
    ) -> None: ...
```

### 6.2 实现类

| 实现类 | 配置项 | 说明 |
|--------|--------|------|
| `SmtpEmailSender` | `SMTP_*` | 标准 SMTP 发送 |
| `AliyunDmEmailSender` | `ALIYUN_DM_*` | 阿里云邮件推送 |

### 6.3 验证码邮件内容

- **主题**：`{brand} 验证码`
- **内容**：6 位数字验证码 + 有效期 + 重发间隔
- **格式**：纯文本 + HTML 双版本

---

## 7. 配置管理

### 7.1 配置加载方式

所有配置通过 `Pydantic Settings` 从环境变量加载：

```python
class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # ... 80+ 字段
```

### 7.2 配置分类

#### 数据库

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `DATABASE_URL` | — | PostgreSQL 连接字符串（必填） |
| `DATABASE_POOL_SIZE` | 20 | 连接池大小 |
| `DATABASE_MAX_OVERFLOW` | 10 | 最大溢出连接数 |
| `DATABASE_POOL_TIMEOUT` | 30 | 获取连接超时（秒） |
| `DATABASE_POOL_RECYCLE` | 1800 | 连接回收时间（秒） |

#### JWT

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SECRET_KEY` | — | JWT 签名密钥（必填） |
| `ALGORITHM` | HS256 | 签名算法 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | Access Token 有效期 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 7 | Refresh Token 有效期 |

#### Email（STMP）

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SMTP_HOST` | — | SMTP 服务器地址 |
| `SMTP_PORT` | 587 | SMTP 端口 |
| `SMTP_USERNAME` | — | SMTP 用户名 |
| `SMTP_PASSWORD` | — | SMTP 密码 |
| `SMTP_FROM` | — | 发件人地址 |
| `SMTP_USE_TLS` | true | 是否启用 TLS |

#### Email（阿里云 DM）

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `ALIYUN_DM_ACCESS_KEY_ID` | — | AccessKey ID |
| `ALIYUN_DM_ACCESS_KEY_SECRET` | — | AccessKey Secret |
| `ALIYUN_DM_ACCOUNT_NAME` | — | 账户名 |
| `ALIYUN_DM_FROM_ALIAS` | — | 发件人别名 |
| `ALIYUN_DM_ENDPOINT` | dm.aliyuncs.com | API Endpoint |

#### 功能开关

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `ENABLE_PUBLIC_SIGNUP` | true | 允许公开注册 |
| `ENABLE_EMAIL_OTP_LOGIN` | true | 邮箱验证码登录 |
| `ENABLE_SSO` | false | SSO 登录 |
| `ENABLE_LDAP` | false | LDAP 登录 |
| `ENABLE_ORG_MODEL` | false | 企业组织模型 |
| `ENABLE_RBAC` | false | RBAC 权限控制 |
| `ENABLE_SKILL_VISIBILITY` | false | Skill 可见性 |
| `ENABLE_AUDIT_LOG` | false | 审计日志 |
| `ENABLE_AUDIT_EXPORT` | false | 审计导出 |
| `ENABLE_METRICS` | true | 请求指标 |
| `ENABLE_RATE_LIMIT` | true | 限流 |

#### Skill 执行

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SKILL_STORAGE_PATH` | /data/skills | 存储路径 |
| `SKILL_VERSION_BUMP_STRATEGY` | patch | 版本提升策略（仅支持 `patch` 或 `minor`） |
| `SKILL_EXECUTION_TIMEOUT_SECONDS` | 300 | 执行超时 |
| `SKILL_MAX_CONCURRENT_EXECUTIONS_PER_USER` | 4 | 用户并发上限 |
| `SKILL_MAX_CONCURRENT_EXECUTIONS_PER_TEAM` | 16 | 团队并发上限 |
| `SKILL_MAX_WORKDIR_BYTES` | 1GB | 工作目录大小限制 |
| `SKILL_MAX_OUTPUT_BYTES` | 1MB | 输出大小限制 |
| `SKILL_CACHE_TTL_SECONDS` | 604800（7天） | 缓存 TTL |
| `SKILL_DOWNLOAD_TTL_SECONDS` | 3600（1小时） | 下载 TTL |
| `ENABLE_LOCAL_CACHE_ENCRYPTION` | true | 本地缓存加密 |
| `ENABLE_SKILL_DOWNLOAD_ENCRYPTION` | true | 下载加密 |
| `ENABLE_SANDBOX_EXECUTION` | false | 沙箱执行 |
| `ENABLE_NETWORK_EGRESS_CONTROL` | false | 网络出口控制 |
| `ENABLE_RESOURCE_QUOTA` | false | 资源配额 |

#### Skill 归档存储

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SKILL_ARCHIVE_BACKEND` | local | 归档后端（`local` / `s3`） |
| `SKILL_ARCHIVE_S3_BUCKET` | — | S3 Bucket 名称 |
| `SKILL_ARCHIVE_S3_REGION` | — | S3 Region |
| `SKILL_ARCHIVE_S3_ENDPOINT` | — | S3 Endpoint（兼容 MinIO 等） |
| `SKILL_ARCHIVE_S3_ACCESS_KEY_ID` | — | S3 AccessKey ID |
| `SKILL_ARCHIVE_S3_SECRET_ACCESS_KEY` | — | S3 AccessKey Secret |
| `SKILL_ARCHIVE_S3_FORCE_PATH_STYLE` | true | 是否强制路径风格 |

#### FlowLLM 集成

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `FLOW_LLM_API_KEY` | — | FlowLLM API Key |
| `FLOW_LLM_BASE_URL` | — | FlowLLM API Base URL |

#### 指标与监控

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `METRICS_RETENTION_DAYS` | 90 | 指标数据保留天数（1-3650） |

---

## 8. Deprecation 机制

### 8.1 废弃提醒中间件

当 `ENABLE_DEPRECATION_HEADERS=true` 时，对以下废弃端点的响应会包含 `Deprecation` Header：

```http
Deprecation: true
Sunset: Sat, 01 Mar 2025 00:00:00 GMT
Link: <https://docs.example.com/migration>; rel="deprecation"
```

### 8.2 废弃通知服务

当 `ENABLE_DEPRECATION_NOTIFIER_ON_STARTUP=true` 时，应用启动时扫描即将废弃的 Skill 并通知所有者。

通知时间偏移量通过 `DEPRECATION_NOTIFY_OFFSETS_DAYS` 配置，默认 `[90, 30, 7]`（即提前 90/30/7 天通知）。
