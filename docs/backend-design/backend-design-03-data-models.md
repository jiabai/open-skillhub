# Open SkillHub 后端设计与开发文档 — 数据模型设计

> 本文档描述数据库 Schema、核心数据模型、ER 关系及版本与缓存策略。

---

## 1. 核心数据模型

### 1.1 Base Mixin

所有模型继承两个 Mixin：

```python
# UUIDPrimaryKeyMixin — 主键为 UUID 字符串（36字符）
class UUIDPrimaryKeyMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)

# TimestampMixin — 自动时间戳
class TimestampMixin:
    created_at: Mapped[datetime]  # 创建时间
    updated_at: Mapped[datetime]  # 更新时间
```

### 1.2 User

用户模型，支持企业/团队隔离：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String(36) PK | UUID |
| `email` | String(320) UNIQUE | 邮箱 |
| `username` | String(64) UNIQUE | 用户名 |
| `hashed_password` | String(255) | bcrypt 哈希 |
| `is_active` | Boolean | 账号是否激活 |
| `is_superuser` | Boolean | 超级用户标志 |
| `enterprise_id` | String(100) NULL | 所属企业 ID |
| `team_id` | String(100) NULL | 所属团队 ID |
| `role` | String(50) | 角色：`admin`、`member`、`viewer` |
| `status` | String(32) | 状态：`active`、`pending`、`disabled` |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

**关系**：
- `tokens` → `APIToken[]`（级联删除）
  - 一对多关系，一个用户可拥有多个 API Token
  - 级联删除：删除 User 时自动删除所有关联的 APIToken 记录
- `skills` → `Skill[]`（级联删除）
  - 一对多关系，一个用户可拥有多个 Skill
  - 级联删除：删除 User 时自动删除所有关联的 Skill 记录

### 1.3 Skill

Agent Skill 主实体：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String(36) PK | UUID |
| `user_id` | String(36) FK→users | 所有者 |
| `name` | String(100) | Skill 名称 |
| `description` | String(500) | 描述 |
| `tags` | JSON List | 标签列表 |
| `visibility` | String(20) | `private` / `team` / `enterprise` |
| `enterprise_id` | String(100) NULL | 所属企业 |
| `team_id` | String(100) NULL | 所属团队 |
| `skill_dir` | String(500) | 文件系统路径 |
| `current_version` | String(50) NULL | 当前版本 |
| `is_active` | Boolean | 是否激活 |
| `cache_revoked_at` | DateTime NULL | 缓存撤销时间 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

**唯一约束**：`user_id + name`（同一用户下 Skill 名不可重复）

**关系**：
- `user` → `User`（双向关联）
  - 通过 `user_id` 外键关联到用户表
  - 支持双向查询：从 Skill 可获取所属 User，从 User 可获取所有 Skills
- `versions` → `SkillVersion[]`（级联删除）
  - 一对多关系，一个 Skill 可拥有多个版本
  - 级联删除：删除 Skill 时自动删除所有关联的 SkillVersion 记录

### 1.4 SkillVersion

Skill 版本记录：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String(36) PK | UUID |
| `skill_id` | String(36) FK→skills | 所属 Skill |
| `version` | String(50) | 版本号（semver） |
| `description` | String(500) | 版本描述 |
| `dependencies` | JSON List | 依赖列表 |
| `dependency_spec` | JSON Dict | 依赖规格 |
| `dependency_spec_version` | String(20) NULL | 依赖规格版本 |
| `metadata` | JSON Dict | 元数据 |
| `created_at` | DateTime | 创建时间 |

**唯一约束**：`skill_id + version`

### 1.5 APIToken

API Token：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String(36) PK | UUID |
| `user_id` | String(36) FK→users | 所属用户 |
| `name` | String(100) | Token 名称 |
| `token_hash` | String(255) UNIQUE | Token 哈希（数据库只存哈希） |
| `is_active` | Boolean | 是否有效 |
| `expires_at` | DateTime NULL | 过期时间 |
| `last_used_at` | DateTime NULL | 最后使用时间 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

**关系**：
- `user` → `User`（双向关联）
  - 通过 `user_id` 外键关联到用户表
  - 支持双向查询：从 APIToken 可获取所属 User，从 User 可获取所有 APITokens

### 1.6 AuditLog

审计日志：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String(36) PK | UUID |
| `actor_id` | String(36) | 操作者用户 ID |
| `action` | String(100) | 操作类型（如 `skill.create`） |
| `target` | String(200) | 目标资源 ID |
| `result` | String(50) | 结果：`success` / `failure` |
| `timestamp` | DateTime | 操作时间（默认索引） |
| `ip` | String(64) | 客户端 IP |
| `user_agent` | String(200) | User-Agent |
| `details` | JSON Dict | 额外详情 |

### 1.7 Enterprise / Team

组织架构模型：

**Enterprise**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String(36) PK | UUID |
| `external_id` | String(100) UNIQUE | 外部 ID（SSO/LDAP） |
| `name` | String(200) | 企业名称 |
| `status` | String(32) | 状态 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

**Team**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String(36) PK | UUID |
| `external_id` | String(100) UNIQUE | 外部 ID |
| `enterprise_id` | String(100) | 所属企业 |
| `name` | String(200) | 团队名称 |
| `status` | String(32) | 状态 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

### 1.8 VerificationCode

邮箱验证码：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String(36) PK | UUID |
| `email` | String(320) | 目标邮箱 |
| `purpose` | String(32) | 用途：`login`、`register`、`bind_email`、`delete_account` |
| `code_hash` | String(64) | 验证码哈希 |
| `expires_at` | DateTime | 过期时间 |
| `resend_available_at` | DateTime | 允许重发时间 |
| `max_attempts` | Integer | 最大尝试次数（默认5） |
| `attempts_left` | Integer | 剩余尝试次数 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

**唯一约束**：`email + purpose`

### 1.9 EmailDeliveryLog

邮件投递日志：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String(36) PK | UUID |
| `email` | String(320) | 目标邮箱 |
| `purpose` | String(32) | 用途：`login`、`register`、`bind_email`、`delete_account` |
| `channel` | String(20) | 投递渠道 |
| `status` | String(20) | 投递状态 |
| `attempts` | Integer | 投递次数（默认1） |
| `error_message` | String(500) NULL | 错误信息 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

### 1.10 RequestMetric

请求指标（按小时桶聚合）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String(36) PK | UUID |
| `user_id` | String(36) FK→users | 用户 ID |
| `bucket_start` | DateTime | 时间桶起点（小时对齐） |
| `total_count` | Integer | 总请求数 |
| `success_count` | Integer | 成功次数 |
| `failure_count` | Integer | 失败次数 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

**唯一约束**：`user_id + bucket_start`

**关系**：
- `user` → `User`（级联删除）
  - 通过 `user_id` 外键关联到用户表
  - 级联删除：删除 User 时自动删除所有关联的 RequestMetric 记录

---

## 2. ER 关系

```
User (1) ──── (N) APIToken
User (1) ──── (N) Skill
User (1) ──── (N) AuditLog
User (1) ──── (N) RequestMetric

Skill (1) ──── (N) SkillVersion

Enterprise (1) ──── (N) Team
Enterprise (1) ──── (N) User
Team (1) ──── (N) User
```

---

## 3. 数据库 Schema（SQLAlchemy 模型 vs 前端 TypeScript 类型对照）

### 3.1 Skill 字段对照

| 后端 (snake_case) | 前端 TypeScript | 类型 |
|-------------------|-----------------|------|
| `uuid` | `uuid` | `string` |
| `user_id` | `userId` | `string` |
| `name` | `name` | `string` |
| `description` | `description` | `string` |
| `tags` | `tags` | `string[]` |
| `visibility` | `visibility` | `'private' \| 'team' \| 'enterprise'` |
| `current_version` | `currentVersion` | `string \| null` |
| `is_active` | `isActive` | `boolean` |
| `created_at` | `createdAt` | `string (ISO8601)` |
| `updated_at` | `updatedAt` | `string (ISO8601)` |

### 3.2 User 字段对照

| 后端 (snake_case) | 前端 TypeScript | 类型 |
|-------------------|-----------------|------|
| `id` | `id` | `string` |
| `email` | `email` | `string` |
| `username` | `username` | `string` |
| `is_active` | `isActive` | `boolean` |
| `is_superuser` | `isSuperuser` | `boolean` |
| `enterprise_id` | `enterpriseId` | `string \| null` |
| `team_id` | `teamId` | `string \| null` |
| `role` | `role` | `string` |

---

## 4. 版本与缓存策略

### 4.1 Skill 版本策略

- **版本号格式**：semver（`major.minor.patch`）
- **自动提升策略**：通过 `SKILL_VERSION_BUMP_STRATEGY` 配置（默认 `patch`）
- **版本元数据**：
  - `dependencies`：依赖 Skill 列表
  - `dependency_spec`：依赖详细规格
  - `metadata`：用户自定义元数据

### 4.2 缓存策略

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SKILL_CACHE_TTL_SECONDS` | 604800（7天） | 缓存有效期 |
| `SKILL_DOWNLOAD_TTL_SECONDS` | 3600（1小时） | 下载链接有效期 |
| `ENABLE_LOCAL_CACHE_ENCRYPTION` | true | 本地缓存加密 |
| `ENABLE_SKILL_DOWNLOAD_ENCRYPTION` | true | 下载内容加密 |
| `ENABLE_CACHE_OFFLINE_FALLBACK` | true | 离线回退 |

### 4.3 缓存撤销

当以下操作发生时，缓存会被撤销：
- Skill 文件更新（`upload_file`）
- Skill 激活/停用（`activate` / `deactivate`）
- 手动调用 `revoke_cache`

撤销时设置 `cache_revoked_at` 时间戳，客户端据此判断缓存是否过期。

---

## 5. 文件存储限制

### 5.1 存储常量

| 常量 | 值 | 说明 |
|------|-----|------|
| `MAX_FILE_SIZE` | 10MB | 单文件最大大小 |
| `MAX_TOTAL_SIZE` | 100MB | 单个 Skill 总大小上限 |
| `MAX_FILES_PER_SKILL` | 50 | 单个 Skill 最大文件数 |

### 5.2 目录结构

```
{SKILL_STORAGE_PATH}/
├── {user_id}/
│   └── {skill_name}/
│       ├── SKILL.md
│       ├── ...（其他文件）
│       └── _versions/
│           ├── 1.0.0/
│           ├── 1.0.1/
│           └── ...（版本归档）
```

### 5.3 Skill 名称验证规则

- 长度不超过 100 字符
- 仅允许字母、数字、下划线、连字符和点
- 禁止路径分隔符（`/`、`\`）
- 禁止以 `.` 开头
