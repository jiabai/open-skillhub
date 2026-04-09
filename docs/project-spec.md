# Open SkillHub 多用户Web服务改造规范

> 本文档定义了 Open SkillHub 多用户 Web 服务的技术规范。当前代码库已生成并集成后端 Python 侧的核心能力（多用户隔离、API Token 认证、私有 Skill 空间等），并已补齐前端控制台实现。
>
> 本文档中也包含少量“可选扩展/参考实现”的示例片段，未必在仓库中默认启用；如与实际实现不一致，以代码为准。

---

## 📖 文档阅读指南

> **本文档较长**，建议按以下方式阅读：

### 快速导航

| 章节 | 内容 | 适用场景 |
|------|------|---------|
| [1. 项目概述](#1-项目概述) | 改造目标、技术选型 | 了解项目背景 |
| [2. 系统架构](#2-系统架构) | 分层架构、用户隔离 | 理解整体设计 |
| [3. 数据模型](#3-数据模型) | User/Skill/APIToken 模型 | 实现数据库层 |
| [4. API 接口规范](#4-api-接口规范) | RESTful API 设计 | 实现接口层 |
| [5. 认证机制](#5-认证机制) | JWT/API Token 认证 | 实现安全模块 |
| [6. MCP工具改造](#6-mcp工具改造) | 工具改造方案 | 改造现有工具 |
| [7. 项目结构](#7-项目结构) | 目录结构、启动方式 | 创建项目骨架 |
| [8. 依赖清单](#8-依赖清单) | 第三方依赖 | 配置开发环境 |
| [9. 配置规范](#9-配置规范) | 环境变量、Settings | 配置管理 |
| [10. 安全要求](#10-安全要求) | 密码、Token、文件安全 | 安全加固 |
| [11. 错误处理](#11-错误处理) | 标准错误格式 | 统一错误处理 |
| [12. 测试要求](#12-测试要求) | 测试策略、覆盖率 | 编写测试 |
| [13. 部署要求](#13-部署要求) | Docker、迁移、监控 | 部署上线 |
| [14. 常见问题](#14-常见问题) | 迁移、Token、分布式 | 问题排查 |

### 代码示例说明

文档中包含大量代码示例，用于说明实现细节：

- 多数代码片段为“参考示例”，需要结合当前仓库结构与依赖调整
- 若某段实现属于“可选扩展/未来增强”，文中会明确注明“可选”或“当前仓库未实现”
- 与当前仓库实现一致的关键代码片段，以仓库源码为准

### 配套文档

| 文档 | 用途 |
|------|------|
| [task_list.md](./task_list.md) | 任务分解和执行顺序 |
| [checklist.md](./checklist.md) | 验证检查清单 |
| [tools.md](./tools.md) | MCP 工具文档 |
| [deployment.md](./deployment.md) | 部署说明与运维 |

### 命令示例说明

文档中的命令示例使用 Bash 风格展示。Windows 环境下请使用等价的 PowerShell 命令或按目录结构手动创建。

### 文档基线与适用范围

- 当前仓库的实现与验收以以下文档为准：`project-spec.md`、`task_list.md`、`checklist.md`、`deployment.md`、`tools.md`
- 历史蓝图与阶段计划文档仅作背景参考，不作为当前仓库落地验收依据
- 文档冲突时采用统一优先级：代码实现与测试结果 > `project-spec.md` > `checklist.md` / `task_list.md` > 其他说明文档
- 更新 `checklist.md` 时建议遵循“证据优先”原则：在将状态标记为完成（由 `- [ ]` 改为 `- [x]`）时，应同时记录验证日期、验证命令与结果摘要；若缺乏验证证据，应保持未完成状态并标注“（需确认）”

### 术语与状态统一口径

为避免跨文档语义漂移，本文档作为术语与状态口径的统一来源：

- **可见性层级**：统一使用“企业级 / 团队级 / 个人级”（英文字段对应 `enterprise/team/private`）
- **权限判定**：使用 RBAC 权限点与可见性规则双重控制。权限点采用`resource.action`（资源.操作）格式命名（如 `skill.download` 表示下载技能，`audit.read` 表示读取审计日志）
- **接口契约字段**：`skill://list` 与 REST 返回中的可见性字段统一使用 `visible`
- **状态标签**：
  - ✅ 已实现：代码与测试覆盖完整，可进入验收通过
  - 🔵 部分实现：主链路可用但仍有契约/覆盖缺口
  - ⬜ 未实现：需求已明确但尚无可验收实现
  - ⏭ 已跳过：当前迭代范围外，仅保留说明，不纳入本轮验收

其他文档（`task_list.md`、`checklist.md`、`deployment.md`）中的术语与状态说明均应与本节保持一致。

**统一示例模板（跨文档复用）**

```json
{
  "skill_id": "8b3b0f59-72ce-4f5f-9d30-4f6ae4f0f9ab",
  "name": "china-stock-analysis",
  "version": "1.2.0",
  "visible": "enterprise",
  "updated_at": "2026-03-06T12:00:00Z"
}
```

```env
DEFAULT_SKILL_VISIBILITY=private
RBAC_ROLE_PERMISSIONS={"admin":["*"],"member":["skill.list","skill.read","skill.create","skill.update","skill.delete","skill.upload","skill.execute"],"viewer":["skill.list","skill.read"]}
```

---

## 1. 项目概述

### 1.1 改造目标

将现有的单用户MCP服务改造为支持多用户的Web服务平台，实现以下核心功能：

| 功能模块 | 描述 | 优先级 |
|---------|------|--------|
| 用户账户管理 | 注册、登录、认证、账户删除 | P0 |
| 私有Skill空间 | 每个用户独立管理自己的Agent Skills | P0 |
| MCP服务认证 | 通过私有Token访问MCP服务 | P0 |

### 1.2 核心改动点

| 改动类型 | 描述 | 影响范围 |
|---------|------|---------|
| 新增模块 | 用户系统、认证系统、API层 | 大量新代码 |
| 改造模块 | MCP工具支持用户隔离 | 4个Op文件 |
| 保留模块 | FlowLLM框架、配置解析 | 无改动 |
| 扩展模块 | 配置系统、存储系统 | 小量改动 |

### 1.3 技术选型

| 层级 | 技术栈 | 版本要求 |
|------|--------|---------|
| Web框架 | FastAPI | >=0.109.0 |
| ORM | SQLAlchemy 2.0 | >=2.0.0 |
| 数据库 | PostgreSQL（生产推荐） | >=14.0；代码兼容 async SQLAlchemy URL |
| 认证 | PyJWT + passlib | 最新版 |
| 文件存储 | 本地文件系统 + 可选 S3/MinIO 归档 | 本地默认，S3 需 boto3 |
| MCP框架 | FlowLLM | >=0.2.0.7 |
| 异步支持 | asyncio + asyncpg | 最新版 |
| 加密能力 | cryptography | >=42.0.0 |
| 元数据解析 | PyYAML | >=6.0 |

### 1.4 兼容性要求

- 保持现有MCP工具核心逻辑不变
- 保持对现有Skill格式的完全兼容
- 支持stdio/SSE/HTTP三种传输模式

| 场景 | 处理方式 |
|------|---------|
| 现有 Skill 格式 | 完全兼容，无需修改 |
| FlowLLM stdio 传输模式 | 保持支持，无用户隔离 |
| FlowLLM SSE 传输模式 | 保持支持，无用户隔离 |
| FastAPI HTTP/SSE 传输模式 | 新增认证，支持用户隔离 |
| 现有配置文件 | 扩展而非替换 |
| 跨平台路径 | 使用 `pathlib.Path` 自动处理 |

#### 1.4.1 三种传输模式的区分机制

系统支持三种传输模式，通过不同的启动入口、认证机制和用户上下文进行区分：

| 模式           | 启动方式                                                             | 代码入口                                        | 认证                                   | 用户隔离 | Skill 路径                                      |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------- | ------------------------------------ | ---- | --------------------------------------------- |
| **stdio**    | `python -m skillhub.main`<br>`skillhub-mcp`            | [main.py](../backend/main.py)       | ❌ 无                                  | ❌    | `{skill_dir}/{skill_name}/SKILL.md`           |
| **单用户 SSE**  | `skillhub-mcp config=default mcp.transport=sse`               | [main.py](../backend/main.py)       | ❌ 无                                  | ❌    | `{skill_dir}/{skill_name}/SKILL.md`           |
| **HTTP API** | `uvicorn skillhub.api_app:app --host 0.0.0.0 --port 8000` | [api_app.py](../backend/api_app.py) | ✅ API Token（优先），JWT Access Token（兼容） | ✅    | `{skill_dir}/{user_id}/{skill_name}/SKILL.md` |

**核心区分逻辑：**

1. **用户上下文判断**
   - 通过 `get_current_user_id()` 获取当前请求的用户 ID
   - 返回 `None` → stdio/SSE 单用户模式（使用全局目录）
   - 返回有效值 → HTTP API 多用户模式（使用用户私有目录）

   ```python
   # 示例：load_skill_op.py
   user_id = get_current_user_id()
   skill_path = (
       skill_dir / user_id / skill_name / "SKILL.md" 
       if user_id 
       else skill_dir / skill_name / "SKILL.md"
   )
   ```

2. **HTTP API 认证流程**
   - 通过 `McpAppProxy` 代理所有 MCP 请求
   - 在 [`McpAppProxy.__call__`](../backend/api/mcp/__init__.py#L183) 中调用 `_authorize_mcp_request` 进行认证
   - 认证成功后通过 `set_current_user_id()` 设置用户上下文
   - 请求结束后自动清理用户上下文

3. **特殊处理**
   - `skill://list` 资源在无用户时直接返回空列表（向后兼容）
   - stdio/SSE 模式保持现有 MCP 工具核心逻辑不变
   - HTTP API 模式强制要求认证，确保多用户环境下的数据隔离

**技术实现：**
- 用户上下文使用 `contextvars.ContextVar` 实现请求级别隔离
- 认证机制基于 Bearer Token 和 JWT
- 路径构建通过 `pathlib.Path` 自动处理跨平台兼容性

### 1.5 企业私有云 P0 落地范围（说明性规范）

> 本节将企业私有云 P0 需求并入项目说明文档，作为实现与验收的统一基线；如与实际代码实现不一致，以代码为准。
> 维护口径：企业私有云能力状态、差异判断与落地优先级统一维护在本文件。

#### 范围与目标

- 企业认证与身份映射：LDAP/AD/SSO 接入，支持企业/团队结构映射
- RBAC 与可见性控制：企业/团队/个人三级可见性并在 API 与 MCP 一致生效
- MCP/REST 接口契约：`skill://list`、`skill://{id}@{version}`、`execute_skill`、`skills/download`
- 审计日志：采集、查询、导出（CSV/JSON）
- 技能版本：自动递增策略与冲突校验

#### 设计要点

**认证与组织映射**
- 最小字段集合：`enterprise_id`、`user_id`、`team_id`、`role`、`status`
- 身份源映射：LDAP/AD 组或 SSO Claim 映射到 `role` 与 `team_id`
- 组织变更：支持用户团队变更时的权限同步与可见性重算

**RBAC 与可见性**
- 可见性层级：企业级、团队级、个人级
- 访问规则：企业 > 团队 > 个人，仅允许收窄，不允许越级放大
- 统一校验：API 与 MCP 入口共用同一权限判定逻辑

**MCP/REST 接口契约**
- `skill://list`：返回可见技能列表（最小字段含 `skill_id`〈UUID〉、`name`〈可读稳定标识〉、`version`、`visible`、`updated_at`；实现中还返回 `description`、`author`、`created_at`、`tags`）
- `skill://{id}@{version}`：返回技能元数据、依赖与参数定义
- `execute_skill`：按版本执行技能，权限按可见性与 RBAC 双重校验
- `skills/download`：仅对授权用户提供，默认加密传输

**审计日志**
- 采集点：认证、权限变更、技能上传/下架/回滚/执行/下载、导出
- 核心字段：`id`、`actor_id`、`action`、`target`、`result`、`timestamp`、`ip`、`user_agent`、`details`
- 查询导出：支持按用户/时间/操作过滤，导出 CSV/JSON

**审计采集点覆盖详情**

| 类别 | Action | 状态 | 代码位置（参考） |
|------|--------|------|----------|
| **认证** | `auth.verification_code.send` | ✅ 已覆盖 | api/v1/auth.py:60 |
| | `auth.register` | ✅ 已覆盖 | api/v1/auth.py:95 |
| | `auth.login` | ✅ 已覆盖 | api/v1/auth.py:128 |
| | `auth.login.failed` | ✅ 已覆盖 | api/v1/auth.py:114 |
| | `auth.refresh` | ✅ 已覆盖 | api/v1/auth.py:157 |
| | `auth.refresh.failed` | ✅ 已覆盖 | api/v1/auth.py:145 |
| | `auth.sso.login` | ✅ 已覆盖 | api/v1/auth.py:175 |
| | `auth.ldap.login` | ✅ 已覆盖 | api/v1/auth.py:193 |
| **技能** | `skill.create` | ✅ 已覆盖 | api/v1/skills.py:94 |
| | `skill.upload` | ✅ 已覆盖 | api/v1/skills.py:176, 190 |
| | `skill.download` | ✅ 已覆盖 | api/v1/skills.py:220 |
| | `skill.deactivate` | ✅ 已覆盖 | api/v1/skills.py:244 |
| | `skill.activate` | ✅ 已覆盖 | api/v1/skills.py:268 |
| | `skill.rollback` | ✅ 已覆盖 | api/v1/skills.py:348 |
| | `skill.execute` | ✅ 已覆盖 | core/tools/execute_skill_op.py:184 |
| | `skill.update` | ✅ 已覆盖 | api/v1/skills.py:120 |
| | `skill.delete` | ✅ 已覆盖 | api/v1/skills.py:152 |
| **用户** | `user.identity.update` | ✅ 已覆盖 | api/v1/users.py:123 |
| | `user.password.change` | ⏭ 已跳过 | 密码登录已移除，无修改密码功能 |
| | `user.delete` | ✅ 已覆盖 | api/v1/users.py:62 |
| **令牌** | `token.create` | ✅ 已覆盖 | api/v1/tokens.py:38 |
| | `token.revoke` | ✅ 已覆盖 | api/v1/tokens.py:63 |

**版本自动递增**
- 默认策略：SemVer patch 递增（可通过 `SKILL_VERSION_BUMP_STRATEGY` 配置 `patch/minor`）
- 冲突处理：指定版本已存在时自动 bump 并返回最终版本

#### 当前实现边界（截至 2026-03）

- 已实现：`skill_list_resource` 的 `visible` 字段已与真实可见性对齐，并有测试覆盖。
- 已实现：审计采集点已全覆盖核心链路（认证、技能创建/上传/下载/激活/下架/回滚/执行/更新/删除、用户删除/身份更新、令牌创建/删除）。
- 已实现：版本自动递增策略支持 `patch/minor` 配置并包含冲突处理。
- 已实现：客户端缓存过期清理（`SKILL_CACHE_TTL_SECONDS`）与离线降级（`ENABLE_CACHE_OFFLINE_FALLBACK`），并有测试覆盖。
- 部分实现：技能归档文件支持 S3 对象存储，但技能主文件（SKILL.md 等）仍为本地存储。
- 未实现：MFA、WORM 审计。

**未实现功能详情**

| 功能 | 状态 | 说明 | 相关配置/代码 |
|------|------|------|---------------|
| **MFA（多因素认证）** | ⬜ 未实现 | 代码库中无 MFA/2FA 相关实现，无 TOTP、短信验证码等二次认证机制 | - |
| **WORM 审计** | ⬜ 未实现 | 审计日志无不可变保护机制，支持删除和修改，不满足合规要求 | models/audit_log.py |
| **技能主文件对象存储** | 🔵 部分实现 | 技能归档文件（.zip）支持 S3 存储，但 SKILL.md 等主文件仍为本地存储 | core/utils/skill_archive.py |

**已实现但文档曾标记为未实现的功能**

| 功能 | 状态 | 说明 | 相关配置 |
|------|------|------|----------|
| **客户端缓存过期清理** | ✅ 已实现 | 通过 `SKILL_CACHE_TTL_SECONDS` 配置 TTL，过期自动清理 | settings.py:37, skill_archive.py:44-54 |
| **离线降级** | ✅ 已实现 | S3 不可用时自动回退到本地缓存，通过 `ENABLE_CACHE_OFFLINE_FALLBACK` 控制 | settings.py:77, skill_archive.py:141 |
| **测试覆盖** | ✅ 已实现 | 有专门测试用例验证缓存过期清理和离线降级 | tests/test_skill_archive_storage.py:53, 73 |

#### 差距闭环与验收门槛

| 差距项 | 当前状态 | 对应清单项 | 验收门槛 |
|------|---------|-----------|---------|
| `skill://list.visible` 与真实可见性对齐 | 已完成 | checklist 17.3 第 1 项 | API 与 MCP 返回可见性一致，且含企业/团队/个人三层校验用例 |
| 审计采集全覆盖 | 部分完成 | checklist 17.4 第 1 项 | 认证、权限、技能上传/下架/回滚/执行/下载均产生日志并可查询 |
| 版本自动递增策略配置化 | 已完成 | checklist 17.5 第 1 项 | 可按环境配置策略（至少 patch/minor），冲突处理可预测且有测试 |

#### 维护与判定规则（统一口径）

**状态标签定义**

- ✅ 已实现：代码与测试均已覆盖，且 checklist 对应项可勾选通过
- 🔵 部分实现：主链路可用，但契约一致性、治理能力或覆盖率仍有缺口
- ⬜ 未实现：需求已明确，但当前仓库尚无可验收实现
- ⏭ 已跳过：当前迭代范围外，仅保留方案说明，不作为本仓库验收项

**判定优先级与证据来源**

- 第一优先级：代码实现与可执行测试结果
- 第二优先级：本文件（`project-spec.md`）中的约束与契约
- 第三优先级：`checklist.md` 与 `task_list.md` 的执行记录
- 范围外参考：历史蓝图与阶段计划文档（仅背景，不参与验收判定）

**当前缺口优先级（建议）**

| 优先级 | 事项 | 目标 | 完成判据 |
|------|------|------|---------|
| P0 | 审计采集全覆盖 | 满足合规审计完整性 | 认证、权限变更、技能上传/下架/回滚/执行/下载均产生日志并可按条件检索 |
| P1 | 自动递增策略配置化 | 提升版本治理可控性 | 支持按环境选择策略（至少 patch/minor），并有冲突处理回归测试 |

#### 交付物与验收

- MCP/REST 接口对齐说明与示例请求
- RBAC 与可见性模型设计与落地
- 审计日志查询与导出能力
- 版本自动递增实现与测试用例
- 验收标准：API 与 MCP 入口可见性一致生效，审计日志可查询导出，版本策略不产生冲突

---

## 2. 系统架构

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                         │
│  Middleware: CORS | Rate Limit | Logging | Deprecation      │
│  Auth: Route-level Dependency Injection                      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  AuthService | UserService | SkillService | AuditService    │
│  TokenService | VerificationCodeService | MCPService(FlowLLM)│
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Layer                         │
│  SQLAlchemy ORM + Async Engine + Repositories               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                             │
│  PostgreSQL (Metadata) + File System/S3 (Skill Files)       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 用户Skill隔离

```
/data/skills/
├── {user_id_1}/
│   ├── pdf/
│   │   ├── SKILL.md
│   │   ├── reference.md
│   │   └── _versions/              # 历史版本目录
│   │       ├── v1.0.0/
│   │       └── v1.1.0/
│   └── xlsx/
│       ├── SKILL.md
│       └── _versions/
├── {user_id_2}/
│   └── pdf/
│       ├── SKILL.md
│       └── _versions/
├── _archives/                      # 归档存储目录
│   └── {user_id}/
│       └── {skill_name}/
│           ├── v1.0.0.zip
│           └── v1.1.0.zip
├── _local_cache/                   # 本地缓存目录
│   └── {user_id}/
│       └── {skill_name}/
│           └── {version}.cache
└── ...
```

| 目录 | 说明 |
|------|------|
| `{user_id}/{skill_name}/` | 用户私有 Skill 目录，存放 SKILL.md 及相关文件 |
| `{user_id}/{skill_name}/_versions/` | Skill 历史版本目录，每个版本一个子目录 |
| `_archives/{user_id}/{skill_name}/` | 归档存储，每个版本打包为 `.zip` 文件 |
| `_local_cache/{user_id}/{skill_name}/` | 本地缓存，用于加速 Skill 加载 |

> **路径风格说明**: 文档中的路径示例使用 Linux/POSIX 风格（正斜杠 `/`）。在 Windows 环境下开发时：
> - 配置文件中的路径可使用正斜杠或反斜杠
> - Python 的 `pathlib.Path` 会自动处理跨平台路径
> - 环境变量 `SKILL_STORAGE_PATH` 示例：`/data/skills` 或 `/var/lib/backend/skills`

### 2.3 性能注意事项

| 场景 | 优化建议 |
|------|---------|
| 数据库查询 | 使用索引、避免 N+1 查询、使用分页 |
| 文件存储 | 大文件使用对象存储（MinIO/S3） |
| 并发处理 | 使用异步 I/O、连接池 |
| 缓存 | 评估引入 Redis 缓存热点数据 |

---

## 3. 数据模型

> **一致性说明**: 本章代码片段展示推荐实现。实际代码使用 Mixin 模式（`UUIDPrimaryKeyMixin`, `TimestampMixin`）减少重复定义，ORM 层配置 `cascade="all, delete-orphan"` 实现级联删除，数据库层通过迁移脚本添加 `ondelete="CASCADE"` 约束确保数据一致性。

### 3.1 User 模型

```python
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from backend.models.base import generate_uuid

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)
    is_superuser: Mapped[bool] = mapped_column(default=False)
    enterprise_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    team_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(50), default="member")
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 关系定义
    skills: Mapped[List["Skill"]] = relationship(
        "Skill",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    tokens: Mapped[List["APIToken"]] = relationship(
        "APIToken",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
```

### 3.2 Skill 模型

```python
from datetime import datetime
from typing import List
from sqlalchemy import JSON, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from backend.models.base import generate_uuid

class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500), default="")
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    visibility: Mapped[str] = mapped_column(String(20), default="private")
    enterprise_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    team_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    skill_dir: Mapped[str] = mapped_column(String(500))
    current_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    cache_revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 关系定义
    user: Mapped["User"] = relationship("User", back_populates="skills")
    versions = relationship(
        "SkillVersion",
        back_populates="skill",
        cascade="all, delete-orphan",
        order_by="SkillVersion.created_at.desc()",
    )

    # 表级约束
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uix_user_skill_name"),
    )
```

### 3.2.1 SkillVersion 模型（版本归档）

> 用于记录每次 ZIP 上传解析到的版本元数据，并与文件系统 `_versions/{version}` 归档目录对应。

```python
from datetime import datetime
from sqlalchemy import JSON, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from backend.models.base import generate_uuid

class SkillVersion(Base):
    __tablename__ = "skill_versions"
    __table_args__ = (UniqueConstraint("skill_id", "version", name="uix_skill_versions"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    version: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(String(500), default="")
    dependencies: Mapped[list[str]] = mapped_column(JSON, default=list)
    dependency_spec: Mapped[dict] = mapped_column(JSON, default=dict)
    dependency_spec_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    skill: Mapped["Skill"] = relationship("Skill", back_populates="versions")
```

> **API 字段口径说明**：SkillVersion 内部属性使用 `metadata_json`，数据库列名为 `metadata`；对外 Schema 仍保持字段名 `metadata`（通过别名与序列化配置统一口径）。

### 3.3 APIToken 模型

```python
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from backend.models.base import generate_uuid

class APIToken(Base):
    __tablename__ = "api_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # 关系定义
    user: Mapped["User"] = relationship("User", back_populates="tokens")

    # 索引
    __table_args__ = (
        Index("ix_api_tokens_user_id", "user_id"),
    )
```

---

## 4. API 接口规范

### API 版本策略

- **版本标识**: 通过 URL 路径标识（`/api/v1/`）
- **版本升级规则**:
  - 重大变更（不兼容）时发布新版本（v2, v3...）
  - 旧版本保持至少 6 个月的兼容期
  - 小型变更（新增字段、新增接口）在当前版本迭代
- **弃用流程**:
  1. 在响应头添加 `Deprecation: true` 和 `Sunset` 日期
  2. 在文档中标注弃用时间
  3. 提前 3 个月通知用户迁移

#### API 版本弃用实现方案

> **已实现**：本节代码已在仓库中落地，参见 `core/middleware/deprecation.py`、`core/decorators/deprecation.py`、`services/deprecation_notification.py`。配置项已集成到 `config/settings.py`，并已支持启动时通知扫描开关。

**含义说明**

- **弃用中间件**：在网关层统一识别已弃用的端点或版本前缀，并自动附加 `Deprecation: true` 与 `Sunset` 响应头，明确“该接口已弃用”以及“预计移除日期”。
- **弃用装饰器**：对单个端点进行更细粒度标记，可附带替代端点的指引信息，方便生成文档与提示迁移路径。
- **通知机制**：按时间节点（默认 90/30/7 天前，可配置）主动推送即将下线的提醒，支持启动时扫描或通过定时任务/CI 调度执行。
- **MCP 可见性增强**：`skill://list` 资源可返回 `deprecation_info`，便于 Agent/客户端在非 HTTP 场景感知弃用状态。

**意义与价值**

- **兼容性承诺清晰**：客户端可在响应头中直接获知弃用状态和日落日期，降低升级不确定性。
- **治理成本降低**：集中式中间件统一处理弃用标识，减少遗漏与多处重复实现。
- **用户迁移可预期**：通知机制提前触达用户，避免接口突然下线导致的生产事故。
- **标准化可集成**：与 RFC 8594 的 `Sunset` 语义一致，便于网关、监控与外部工具识别。
- **版本演进可控**：为“旧版本至少 6 个月兼容期”的策略提供可执行支撑。

使用纯 ASGI 中间件实现自动添加弃用响应头（避免 `BaseHTTPMiddleware` 的弃用问题）：

```python
# core/middleware/deprecation.py
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
    from backend.config.settings import settings

    return DeprecationMiddleware(
        app,
        deprecated_endpoints=settings.DEPRECATED_ENDPOINTS,
        deprecated_versions=settings.DEPRECATED_VERSIONS,
        version_sunset_date=settings.DEPRECATED_VERSION_SUNSET_DATE,
    )
```

**配置项**（在 `config/settings.py` 中）：

```python
class Settings(BaseSettings):
    # ... 其他配置 ...

    ENABLE_DEPRECATION_HEADERS: bool = True
    ENABLE_DEPRECATION_NOTIFIER_ON_STARTUP: bool = False

    # 弃用端点配置：路径 -> 完全移除日期（ISO 8601格式）
    # 环境变量示例：DEPRECATED_ENDPOINTS='{"\/api\/v1\/legacy\/endpoint": "2026-12-31"}'
    DEPRECATED_ENDPOINTS: dict = {}

    # 已弃用的整个版本前缀
    # 环境变量示例：DEPRECATED_VERSIONS='["/api/v1"]'
    DEPRECATED_VERSIONS: set = set()

    # 版本级别的日落日期
    DEPRECATED_VERSION_SUNSET_DATE: str = ""
    DEPRECATION_NOTIFY_OFFSETS_DAYS: List[int] = [90, 30, 7]
```

**在 api_app.py 中集成**：

```python
from backend.core.middleware.deprecation import DeprecationMiddleware

def create_application() -> FastAPI:
    # ... 其他中间件 ...
    if settings.ENABLE_DEPRECATION_HEADERS:
        application.add_middleware(
            DeprecationMiddleware,
            deprecated_endpoints=settings.DEPRECATED_ENDPOINTS,
            deprecated_versions=settings.DEPRECATED_VERSIONS,
            version_sunset_date=settings.DEPRECATED_VERSION_SUNSET_DATE,
        )
    # ...
```

```python
from contextlib import asynccontextmanager

from backend.db.session import get_async_session
from backend.repositories.audit_log import AuditLogRepository
from backend.services.deprecation_notification import DeprecationNotifier

@asynccontextmanager
async def lifespan(_application: FastAPI):
    # ... 其他初始化逻辑 ...
    if settings.ENABLE_DEPRECATION_NOTIFIER_ON_STARTUP:
        async for session in get_async_session():
            notifier = DeprecationNotifier(
                AuditLogRepository(session),
                day_offsets=list(settings.DEPRECATION_NOTIFY_OFFSETS_DAYS),
            )
            await notifier.notify_upcoming_deprecation()
            break
    yield
```

#### 端点级别的弃用装饰器（可选）

对于单个端点的弃用，可以使用装饰器。**注意**：推荐在路由函数中声明 `response: Response` 以确保稳定注入响应头；未声明时装饰器也可工作，但仅在运行时可获取到 `Response` 对象时写入响应头：

```python
# core/decorators/deprecation.py
from functools import wraps
from inspect import signature
from typing import Callable, Optional

from fastapi import Response


def deprecated(
    sunset_date: Optional[str] = None,
    alternative: Optional[str] = None,
) -> Callable:
    """
    标记端点为已弃用的装饰器

    注意：推荐配合 FastAPI 的 Response 依赖注入使用。
    当路由函数未声明 `response: Response` 时，装饰器会尝试在运行时参数中查找 Response 对象并写入响应头。

    Args:
        sunset_date: 端点完全移除的日期（ISO 8601格式，如 "2026-12-31"）
        alternative: 替代端点的路径
    """

    def decorator(func: Callable) -> Callable:
        accepts_response = "response" in signature(func).parameters

        @wraps(func)
        async def wrapper(*args, response: Optional[Response] = None, **kwargs):
            target_response = response
            if target_response is None:
                value = kwargs.get("response")
                if isinstance(value, Response):
                    target_response = value
            if target_response is None:
                for item in args:
                    if isinstance(item, Response):
                        target_response = item
                        break
            if target_response is not None:
                target_response.headers["Deprecation"] = "true"
                if sunset_date:
                    target_response.headers["Sunset"] = sunset_date
                if alternative:
                    target_response.headers["Link"] = f'<{alternative}>; rel="successor-version"'

            if accepts_response and "response" not in kwargs and response is not None:
                kwargs["response"] = response
            return await func(*args, **kwargs)

        setattr(wrapper, "_deprecated", True)
        setattr(wrapper, "_sunset_date", sunset_date)
        setattr(wrapper, "_alternative", alternative)

        return wrapper

    return decorator


def get_deprecation_metadata(func: Callable) -> dict:
    """
    获取函数的弃用元数据，用于文档生成

    Returns:
        dict: 包含 deprecated, sunset_date, alternative 的字典
    """
    return {
        "deprecated": getattr(func, "_deprecated", False),
        "sunset_date": getattr(func, "_sunset_date", None),
        "alternative": getattr(func, "_alternative", None),
    }
```

**使用示例**：

```python
from fastapi import APIRouter, Response
from backend.core.decorators.deprecation import deprecated

router = APIRouter()

@router.get("/legacy/endpoint")
@deprecated(sunset_date="2026-12-31", alternative="/api/v1/new/endpoint")
async def legacy_endpoint(response: Response):
    '''
    已弃用的端点

    **弃用说明**: 该端点将于 2026-12-31 移除，请迁移到 `/api/v1/new/endpoint`
    '''
    return {"message": "This endpoint is deprecated"}
```

#### 版本弃用通知机制（已实现）

通知服务已与审计系统集成，记录弃用通知事件（`action=deprecation_notice`）：

```python
# services/deprecation_notification.py
from datetime import datetime, timezone

from backend.config.settings import settings
from backend.repositories.audit_log import AuditLogRepository
from backend.services.audit import AuditService


class DeprecationNotifier:
    """弃用通知服务"""

    def __init__(self, audit_repo: AuditLogRepository, day_offsets: list[int] | None = None):
        self.audit_repo = audit_repo
        self.day_offsets = day_offsets if day_offsets is not None else list(settings.DEPRECATION_NOTIFY_OFFSETS_DAYS)

    @staticmethod
    def _parse_sunset_date(value: str) -> datetime | None:
        raw = str(value or "").strip()
        if not raw:
            return None
        normalized = raw.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    async def notify_upcoming_deprecation(self, deprecated_endpoints: dict[str, str] | None = None) -> list[dict]:
        """
        提前通知即将弃用的端点
        建议在 CI/CD 或定时任务中执行
        """
        notifications = []
        source = deprecated_endpoints if deprecated_endpoints is not None else settings.DEPRECATED_ENDPOINTS
        today = datetime.now(timezone.utc).date()
        service = AuditService(self.audit_repo)

        for endpoint, sunset_date_str in source.items():
            sunset_date = self._parse_sunset_date(str(sunset_date_str))
            if sunset_date is None:
                continue
            days_until_removal = (sunset_date.date() - today).days

            if days_until_removal in self.day_offsets:
                notification = {
                    "endpoint": endpoint,
                    "sunset_date": sunset_date.date().isoformat(),
                    "days_remaining": days_until_removal,
                    "severity": "warning" if days_until_removal > 7 else "critical",
                }
                notifications.append(notification)

                await service.create_event(
                    actor_id="system",
                    action="deprecation_notice",
                    target=str(endpoint),
                    result="pending",
                    metadata=notification,
                )

        await self._send_notifications(notifications)
        return notifications

    async def _send_notifications(self, notifications: list[dict]) -> None:
        """实际发送通知（邮件、Slack、Webhook 等）"""
        return None
```

`skill://list` 资源中可返回弃用可见性信息（用于非 HTTP 客户端）：

```json
{
  "skills": [
    {
      "skill_id": "ef4f9d90-2f50-4ef0-8dbe-8d0d0f9db3d4",
      "name": "example-skill",
      "version": "1.0.0",
      "visible": "team",
      "deprecation_info": {
        "deprecated": true,
        "sunset": "2026-12-31"
      }
    }
  ]
}
```

### 4.1 认证模块 `/api/v1/auth`

| 端点 | 方法 | 认证 | 描述 |
|------|------|------|------|
| `/verification-code` | POST | 否 | 发送邮箱验证码（login/register/bind_email） |
| `/register` | POST | 否 | 用户注册 |
| `/login` | POST | 否 | 用户登录，返回JWT（邮箱验证码模式） |
| `/refresh` | POST | 否（需 refresh_token） | 刷新Access Token（请求体提供 refresh_token） |
| `/sso/login` | POST | 否（企业配置） | SSO 登录，开启 `ENABLE_SSO` 时可用 |
| `/ldap/login` | POST | 否（企业配置） | LDAP 登录，开启 `ENABLE_LDAP` 时可用 |
| `/logout` | POST | 是 | 登出（可选能力，当前仓库未实现该端点；且未实现 Token 黑名单） |

#### 登录模式与开关矩阵

| 登录模式 | 入口 | 必要开关 | 企业私有化建议 |
|------|------|---------|---------|
| 邮箱验证码登录 | `/verification-code` + `/login` | `ENABLE_EMAIL_OTP_LOGIN=true` | 按需开启（常与企业邮箱体系配套） |
| 公共注册 | `/verification-code` + `/register` | `ENABLE_PUBLIC_SIGNUP=true` | 默认关闭（仅在受控场景开启） |
| SSO 登录 | `/sso/login` | `ENABLE_SSO=true` | 推荐开启 |
| LDAP 登录 | `/ldap/login` | `ENABLE_LDAP=true` | 推荐开启 |

> 设计约束：同一环境可并存多种入口，但应在部署层明确“主入口”，避免用户端出现并行身份体系导致的账户归属混乱。

#### 邮箱验证码登录说明

- 登录不使用密码，使用邮箱验证码完成登录
- 注册与邮箱绑定复用同一套验证码发送与校验流程
- 邮箱绑定接口位于用户模块：`POST /api/v1/users/bind-email`（详见 4.2 用户模块）

#### POST `/api/v1/auth/verification-code`

**用途**

- 发送验证码（登录、注册、邮箱绑定共用）

**请求体**

```json
{
  "email": "user@example.com",
  "purpose": "login"
}
```

**请求字段**

- `email`: 邮箱地址
- `purpose`: 业务场景，取值 `login` / `register` / `bind_email` / `delete_account`

**响应**

```json
{
  "sent": true,
  "expires_in": 300,
  "resend_interval": 60,
  "max_attempts": 5,
  "attempts_left": 5
}
```

**验证码约束与字段命名**

- `code_length`: 验证码长度（默认 6）
- `expires_in`: 验证码有效期（秒，默认 300）
- `resend_interval`: 重发间隔（秒，默认 60）
- `max_attempts`: 单次验证码最多尝试次数（默认 5）
- `attempts_left`: 当前剩余尝试次数

**错误码示例**

- `CODE_EXPIRED`：验证码过期
- `CODE_INVALID`：验证码错误
- `TOO_MANY_ATTEMPTS`：错误次数超限
- `RESEND_TOO_FREQUENT`：重发过于频繁

#### POST `/api/v1/auth/login`

**请求体**

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**校验失败返回示例**

```json
{
  "detail": "验证码已过期",
  "code": "CODE_EXPIRED"
}
```

**响应**

```json
{
  "access_token": "jwt-access",
  "refresh_token": "jwt-refresh"
}
```

#### POST `/api/v1/auth/register`

**请求体**

```json
{
  "email": "user@example.com",
  "username": "user",
  "code": "123456"
}
```

**校验失败返回示例**

```json
{
  "detail": "验证码错误",
  "code": "CODE_INVALID"
}
```

**响应**

```json
{
  "access_token": "jwt-access",
  "refresh_token": "jwt-refresh"
}
```

#### POST `/api/v1/users/bind-email`

**请求体**

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**校验失败返回示例**

```json
{
  "detail": "尝试次数过多，请稍后再试",
  "code": "TOO_MANY_ATTEMPTS"
}
```

**响应**

```json
{
  "bound": true
}
```

### 4.2 用户模块 `/api/v1/users`

| 端点 | 方法 | 认证 | 描述 |
|------|------|------|------|
| `/me` | GET | 是 | 获取当前用户信息 |
| `/me` | PUT | 是 | 更新用户信息 |
| `/me` | DELETE | 是 | 删除账户（需邮箱验证码确认） |
| `/me/delete-request` | POST | 是 | 发送账户删除验证码 |
| `/bind-email` | POST | 是 | 绑定邮箱（验证码校验） |
| `/{user_id}/identity` | PUT | 是（需 `user.manage`） | 管理员更新用户身份字段（enterprise/team/role/status） |

### 4.3 Token模块 `/api/v1/tokens`

| 端点 | 方法 | 认证 | 描述 |
|------|------|------|------|
| `/` | GET | 是 | 列出用户的所有API Token |
| `/` | POST | 是 | 创建新的API Token |
| `/{token_id}` | DELETE | 是 | 删除指定API Token |

### 4.4 Skill模块 `/api/v1/skills`

| 端点 | 方法 | 认证 | 描述 |
|------|------|------|------|
| `/` | GET | 是 | 列出用户的Skills（分页，支持 include_inactive） |
| `/` | POST | 是 | 创建新Skill |
| `/cache-policy` | GET | 是 | 获取客户端缓存策略（TTL/是否加密） |
| `/{skill_uuid}` | GET | 是 | 获取Skill详情 |
| `/{skill_uuid}` | PUT | 是 | 更新Skill信息 |
| `/{skill_uuid}` | DELETE | 是 | 删除Skill |
| `/upload` | POST | 是 | 上传Skill文件（multipart，支持 zip 与 metadata） |
| `/download` | POST | 是 | 下载指定版本Skill压缩包（加密传输） |
| `/{skill_uuid}/files` | GET | 是 | 列出Skill文件 |
| `/{skill_uuid}/files/{file_path:path}` | GET | 是 | 读取指定文件内容（文本） |
| `/{skill_uuid}/deactivate` | POST | 是 | 下架Skill（写入 cache_revoked_at） |
| `/{skill_uuid}/activate` | POST | 是 | 启用Skill |
| `/{skill_uuid}/versions` | GET | 是 | 列出Skill版本 |
| `/{skill_uuid}/versions/{version}/rollback` | POST | 是 | 回滚到指定版本 |
| `/{skill_uuid}/versions/{version}/install-instructions` | GET | 是 | 获取客户端依赖安装指引 |
| `/{skill_uuid}/versions/diff` | GET | 是 | 比较两个版本的文件差异 |

**当前实现状态（已落地到代码）**

- [x] ZIP 上传与版本创建（解析 `SKILL.md` frontmatter：version/dependencies）
- [x] 版本归档到 `_versions/{version}` 并覆盖为当前版本文件集
- [x] 未显式提供 version 时自动递增（默认策略：SemVer patch + 1）
- [x] 版本列表与回滚
- [x] 下架/启用与缓存失效标记 `cache_revoked_at`
- [x] 依赖安装指引（策略：客户端安装，返回 dependencies + pip 命令）
- [x] 版本差异对比（added/removed/modified，小文本 unified diff）
- [x] Skill 下载（加密传输）：`POST /api/v1/skills/download` 返回 `encrypted_code` + `checksum` + `expires_at`

#### 4.4.1 依赖声明契约（多生态兼容）

为兼容 Python/Node 等多生态技能依赖，同时保持向后兼容，版本元数据采用“简写 + 结构化”双轨模型：

- 兼容字段：`dependencies: list[str]`（历史简写，默认按 Python/pip 解释）
- 结构化字段：`dependency_spec: object`（推荐，支持多生态声明）
- 版本字段：`dependency_spec.schema_version`（当前为 `1`）

推荐结构示例：

```json
{
  "schema_version": 1,
  "python": {
    "manager": "pip",
    "requirements": ["requests>=2.32.0"],
    "files": ["requirements.txt"]
  },
  "node": {
    "manager": "npm",
    "package_json": {
      "name": "example-skill",
      "dependencies": {
        "lodash": "^4.17.21"
      }
    },
    "lockfile": "package-lock.json"
  }
}
```

兼容策略：

- 若仅存在 `dependencies`，服务端按 `python.manager="pip"` 语义解释
- 若同时存在 `dependencies` 与 `dependency_spec`，以 `dependency_spec` 为准，`dependencies` 作为兼容输出
- `install-instructions` 输出应与 `dependency_spec` 保持一致，避免“声明生态”与“安装指引”不一致

### 4.5 Dashboard模块 `/api/v1/dashboard`

| 端点 | 方法 | 认证 | 描述 |
|------|------|------|------|
| `/overview` | GET | 是 | 获取控制台概览统计 |
| `/metrics/cleanup` | POST | 是（管理员） | 清理历史调用统计 |
| `/metrics/reset-24h` | POST | 是（管理员） | 清零过去 24h 调用统计 |

#### GET `/api/v1/dashboard/overview`

**响应**

```json
{
  "active_skills": 3,
  "available_tokens": 2,
  "success_rate": 92.3,
  "success_rate_window_hours": 24,
  "success_rate_total": 120
}
```

**统计口径**

- `success_rate` / `success_rate_total` 统计 tool 调用结果（按小时桶聚合）

#### POST `/api/v1/dashboard/metrics/cleanup`

**请求体**

```json
{
  "retention_days": 30
}
```

- `retention_days` 可选，范围 1–3650，省略时使用服务端配置 `METRICS_RETENTION_DAYS`
- 清理范围为历史聚合桶数据（`request_metrics`），清理过小的保留天数可能影响“过去 24h”窗口边界的数据展示

**响应**

```json
{
  "removed": 120,
  "retention_days": 30,
  "cutoff": "2026-03-04T05:00:00Z"
}
```

**权限说明**

- 仅 `is_superuser=true` 的用户可调用，非管理员返回 403

#### POST `/api/v1/dashboard/metrics/reset-24h`

**响应**

```json
{
  "removed": 42,
  "window_hours": 24,
  "window_start": "2026-03-03T05:00:00Z",
  "window_end": "2026-03-04T05:00:00Z"
}
```

**权限说明**

- 仅 `is_superuser=true` 的用户可调用，非管理员返回 403
- 当前实现按 `current_user.id` 清理窗口内指标，适用于“管理员自有账户”的近 24h 指标重置场景

### 4.6 MCP模块

| 端点 | 方法 | 认证 | 描述 |
|------|------|------|------|
| `/mcp` | POST | API Token（主）/ JWT（兼容） | HTTP MCP端点 |
| `/sse` | GET | API Token（主）/ JWT（兼容） | SSE MCP端点 |

#### MCP 资源与工具契约（对齐企业 P0）

> MCP 模式下除基础 4 个工具外，还提供 `skill://` 资源描述与 `execute_skill` 工具，用于对齐企业私有云技能服务的接口契约。

| 能力 | 形式 | 名称/URI | 说明 |
|------|------|----------|------|
| 技能列表 | Tool（返回 Resource Payload） | `skill_list_resource` → `skill://list` | 返回可用技能列表（支持可见性过滤；`visible` 字段已标准化并有测试覆盖，且包含 `deprecation_info`） |
| 技能详情 | Tool（返回 Resource Payload） | `skill_detail_resource` → `skill://{id}@{version}` | 返回技能元数据、依赖与参数定义（来自版本归档的 `SKILL.md`） |
| 技能执行 | Tool | `execute_skill` | 根据 `SKILL.md` 中的 `command` 或 `entrypoint` 执行技能（受命令白名单限制） |
| 技能元数据扫描 | Tool | `load_skill_metadata` | 扫描 Skill 目录读取 `SKILL.md` frontmatter |
| 技能说明加载 | Tool | `load_skill` | 读取指定技能的 `SKILL.md` |
| 参考文件读取 | Tool | `read_reference_file` | 读取技能目录下的参考文件 |
| 脚本执行 | Tool | `run_shell_command` | 在技能目录执行命令（白名单限制） |

### 4.7 企业私有云 P0 补充接口（实现对齐）

#### POST `/api/v1/skills/download`

**说明**：按授权与可见性控制下载技能包，默认启用加密传输。

**请求体**

```json
{
  "skill_uuid": "8b3b0f59-72ce-4f5f-9d30-4f6ae4f0f9ab",
  "version": "1.2.0"
}
```

**响应**

```json
{
  "skill_uuid": "8b3b0f59-72ce-4f5f-9d30-4f6ae4f0f9ab",
  "version": "1.2.0",
  "encrypted_code": "base64(...)",
  "expires_at": "2026-03-06T12:00:00Z",
  "checksum": "sha256:...",
  "cache_ttl_seconds": 604800
}
```

**权限说明**

- 仅对具备可见性权限的用户开放
- 需要 RBAC 权限：`skill.download`
- **安全提示**：`skill.download` 默认仅授予 `admin` 角色。此权限允许下载完整技能源码，属于高敏感权限，建议仅在确有需要时通过 `RBAC_ROLE_PERMISSIONS` 配置单独授予。
- **RBAC 关闭时的特例**：不再按角色矩阵判断，但也不会向所有已登录用户开放。当前实现仅允许下载**自己名下的 Skill 记录**，以保留私有空间自助下载能力。

#### GET `/api/v1/audit/logs`

**说明**：审计日志查询接口，支持按用户/时间/操作过滤。

**查询参数**

```json
{
  "actor_id": "user_123",
  "action": "skill.execute",
  "start": "2026-03-01T00:00:00Z",
  "end": "2026-03-06T00:00:00Z",
  "skip": 0,
  "limit": 20
}
```

**响应**

```json
{
  "items": [{
    "id": "evt_001",
    "actor_id": "user_123",
    "action": "skill.execute",
    "target": "china-stock-analysis@1.2.0",
    "result": "success",
    "timestamp": "2026-03-06T10:12:00Z",
    "ip": "10.0.0.5",
    "user_agent": "OpenClaw/1.0",
    "details": {}
  }]
}
```

**权限说明**

- 仅管理员或具备 `audit.read` 权限的角色可调用

#### POST `/api/v1/audit/logs/export`

**说明**：按过滤条件导出审计日志，支持 CSV/JSON。

**请求体**

```json
{
  "format": "csv",
  "filters": {
    "actor_id": "user_123",
    "start": "2026-03-01T00:00:00Z",
    "end": "2026-03-06T00:00:00Z"
  }
}
```

**响应**

```json
{
  "format": "csv",
  "content": "id,actor_id,action,..."
}
```

**权限说明**

- 仅管理员或具备 `audit.export` 权限的角色可调用

---

## 5. 认证机制

### 5.1 JWT认证（Web API）

- **Access Token**: 默认有效期 30 分钟（`ACCESS_TOKEN_EXPIRE_MINUTES`），用于 API 访问
- **Refresh Token**: 默认有效期 7 天（`REFRESH_TOKEN_EXPIRE_DAYS`），用于刷新 Access Token
- **算法**: 默认 `HS256`（可通过 `ALGORITHM` 配置）
- **Header**: `Authorization: Bearer {access_token}`

### 5.2 API Token认证（MCP服务）

- **格式**: `ask_live_{64字符十六进制串}`，总长度73字符
  - 前缀: `ask_live_`（9字符）
  - 随机部分: 32字节（256位）随机数，使用 `secrets.token_hex(32)` 生成64个十六进制字符
- **存储**: 仅存储SHA256哈希值
- **Header**: `Authorization: Bearer {api_token}`
- **过期**: 可选设置过期时间
- **认证策略**: MCP 入口优先校验 API Token；若失败再尝试 JWT Access Token（兼容模式）

### 5.3 Token生成示例

```python
import secrets

# API Token 生成
prefix = "ask_live_"
random_part = secrets.token_hex(32)  # 生成64个十六进制字符（32字节）
token = prefix + random_part
# 示例: ask_live_a1b2c3d4e5f67890...（共73字符：9 + 64）

# Token 哈希存储
import hashlib
token_hash = hashlib.sha256(token.encode()).hexdigest()
```

### 5.4 API Token 验证流程

#### 完整验证流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      MCP 请求验证流程                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. 从请求头提取 Token                                            │
│     Header: Authorization: Bearer ask_live_xxx...                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. 验证 Token 格式                                               │
│     - 检查前缀是否为 "ask_live_"                                   │
│     - 检查总长度是否为 73 字符                                     │
│     - 检查随机部分是否为有效的十六进制字符串                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. 计算 Token 哈希                                               │
│     token_hash = SHA256(token)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. 数据库查询                                                    │
│     SELECT * FROM api_tokens WHERE token_hash = ? AND is_active  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. 检查 Token 状态                                               │
│     - is_active == True ?                                        │
│     - expires_at > now() ? (如果设置了过期时间)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. 更新最后使用时间                                               │
│     UPDATE api_tokens SET last_used_at = now()                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. 设置用户上下文                                                 │
│     set_current_user_id(user.id)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. 若 API Token 失败，则尝试 JWT Access Token 兼容校验              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  9. 返回用户信息，继续处理请求                                       │
└─────────────────────────────────────────────────────────────────┘
```

#### 实现代码示例

```python
# backend/api/mcp/auth.py（FastMCP TokenVerifier 版本）
import re
from datetime import timezone

from mcp.server.auth.provider import AccessToken

from backend.core.utils.user_context import set_current_user_id
from backend.db.session import get_async_session
from backend.repositories.token import TokenRepository
from backend.repositories.user import UserRepository
from backend.services.token import TokenService

_token_pattern = re.compile(r"^ask_live_[0-9a-f]{64}$")


class ApiTokenVerifier:
    async def verify_token(self, token: str) -> AccessToken | None:
        if not _token_pattern.match(token):
            return None

        async for session in get_async_session():
            token_repo = TokenRepository(session)
            user_repo = UserRepository(session)
            service = TokenService(token_repo, user_repo)

            try:
                api_token = await service.validate_token(token)
            except ValueError:
                return None

            user = await user_repo.get_by_id(api_token.user_id)
            if not user or not user.is_active:
                return None

            set_current_user_id(str(user.id))

            expires_at = None
            if api_token.expires_at:
                expires_at = int(api_token.expires_at.replace(tzinfo=timezone.utc).timestamp())

            return AccessToken(token=token, client_id=str(user.id), scopes=[], expires_at=expires_at)
```

```python
# backend/api/mcp/__init__.py（MCP 入口兼容校验）
async def _authorize_mcp_request(scope: Scope, receive: Receive, send: Send) -> bool:
    token = _extract_bearer_token(scope)
    verifier = ApiTokenVerifier()
    access_token, error = await verifier.verify_token_with_error(token)
    if access_token:
        return True
    payload = decode_token(token)
    if payload.get("type") != "access":
        await _send_error(scope, receive, send, "Invalid token type", "INVALID_TOKEN_TYPE")
        return False
    # ... 省略用户查询与上下文注入 ...
```

#### 错误响应

| 错误码 | 描述 | HTTP 状态码 |
|--------|------|------------|
| `INVALID_TOKEN_FORMAT` | Token 格式不正确 | 401 |
| `TOKEN_NOT_FOUND` | Token 不存在 | 401 |
| `TOKEN_REVOKED` | Token 已被撤销 | 401 |
| `TOKEN_EXPIRED` | Token 已过期 | 401 |
| `INVALID_TOKEN_TYPE` | JWT 不是 access 类型 | 401 |
| `INVALID_TOKEN` | JWT 无效（缺少必要字段等） | 401 |
| `USER_NOT_FOUND` | JWT 对应用户不存在或已禁用 | 401 |

---

## 6. MCP工具改造

### 6.1 改造原则

现有MCP工具需要支持用户隔离，核心改动：

1. 从上下文获取 `user_id`
2. 根据用户ID构建Skill路径
3. 保持向后兼容（仅用于 stdio/SSE 模式，无用户认证时使用全局路径）

> **重要说明**: 向后兼容仅适用于 **stdio 模式** 或 **单用户 SSE 模式**。在 HTTP API 模式下，MCP 端点强制要求 API Token 认证，不允许无用户身份的访问。这是为了确保多用户环境下的数据隔离和安全性。

### 6.2 并发安全机制

> **重要**: FlowLLM 的 `C` 是全局上下文对象，在多用户并发场景下需要特殊处理以确保用户隔离的安全性。

#### 实现方案

使用 `contextvars` 实现请求级别的用户上下文隔离：

```python
# core/utils/user_context.py
from contextvars import ContextVar
from typing import Optional
from uuid import UUID

# 定义请求级别的用户上下文变量
_current_user_id: ContextVar[Optional[str]] = ContextVar("current_user_id", default=None)

def set_current_user_id(user_id: Optional[str]) -> None:
    """设置当前请求的用户ID"""
    _current_user_id.set(user_id)

def get_current_user_id() -> Optional[str]:
    """获取当前请求的用户ID"""
    return _current_user_id.get()
```

#### MCP 工具中的使用方式

```python
from backend.core.utils.user_context import get_current_user_id

async def async_execute(self):
    user_id = get_current_user_id()  # 从请求级上下文获取
    skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()

    if user_id:
        skill_path = skill_dir / user_id / skill_name / "SKILL.md"
    else:
        skill_path = skill_dir / skill_name / "SKILL.md"
```

#### MCP 认证中间件中的注入

```python
# api/mcp/auth.py
from backend.core.utils.user_context import set_current_user_id

async def get_current_user_from_token(token: str) -> User:
    """从 API Token 获取用户并设置上下文"""
    user = await validate_api_token(token)
    set_current_user_id(str(user.id))  # 设置请求级用户ID
    return user
```

#### 为什么这样设计？

| 方案 | 优点 | 缺点 |
|------|------|------|
| **contextvars** (推荐) | 线程安全、协程安全、无需修改 FlowLLM | 需要在中间件中显式设置 |
| 修改 C.service_config | 简单直接 | 全局状态，并发不安全 |
| 传递 user_id 参数 | 最安全 | 需要修改所有工具签名 |

### 6.3 LoadSkillOp 改造

```python
from backend.core.utils.user_context import get_current_user_id

async def async_execute(self):
    skill_name = self.input_dict["skill_name"]
    user_id = get_current_user_id()  # 使用请求级上下文
    skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()

    if user_id:
        # HTTP API 模式：使用用户私有目录
        skill_path = skill_dir / user_id / skill_name / "SKILL.md"
    else:
        # stdio/SSE 单用户模式：使用全局目录（向后兼容）
        skill_path = skill_dir / skill_name / "SKILL.md"

    # ... 其余逻辑不变
```

实现补充：

- 返回内容为 `SKILL.md` 原文（当前实现不裁剪 frontmatter）
- 在用户上下文存在时，会检查技能激活状态；已下架技能返回 `SKILL_DEACTIVATED`
- 非法技能名返回 `INVALID_SKILL_NAME`

### 6.4 LoadSkillMetadataOp 改造

```python
from backend.core.utils.user_context import get_current_user_id

async def async_execute(self):
    user_id = get_current_user_id()  # 使用请求级上下文
    skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()

    if user_id:
        search_dir = skill_dir / user_id
    else:
        search_dir = skill_dir

    # ... 其余逻辑不变
```

### 6.5 ReadReferenceFileOp 改造

```python
from backend.core.utils.user_context import get_current_user_id

async def async_execute(self):
    skill_name = self.input_dict["skill_name"]
    file_name = self.input_dict["file_name"]
    user_id = get_current_user_id()  # 使用请求级上下文
    skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()

    if user_id:
        file_path = skill_dir / user_id / skill_name / file_name
    else:
        file_path = skill_dir / skill_name / file_name

    # ... 其余逻辑不变
```

实现补充：

- `file_name` 会进行路径安全校验，非法路径返回 `INVALID_FILE_PATH`
- 文件不存在返回 `FILE_NOT_FOUND`
- 在用户上下文存在时会检查技能状态，下架技能返回 `SKILL_DEACTIVATED`

### 6.6 RunShellCommandOp 改造

```python
from backend.core.utils.user_context import get_current_user_id
from backend.core.utils.command_whitelist import validate_command
from backend.core.utils.skill_storage import tool_error_payload

async def async_execute(self):
    skill_name = self.input_dict["skill_name"]
    command = self.input_dict["command"]
    user_id = get_current_user_id()  # 使用请求级上下文
    skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()

    # 安全检查：验证命令是否在白名单中
    is_valid, error_msg = validate_command(command)
    if not is_valid:
        self.set_output(tool_error_payload(error_msg, "COMMAND_BLOCKED"))
        return

    if user_id:
        work_dir = skill_dir / user_id / skill_name
    else:
        work_dir = skill_dir / skill_name

    # ... 其余逻辑不变
```

实现补充：

- 命令必须通过白名单校验，不通过返回 `COMMAND_BLOCKED`
- 目录不存在返回 `SKILL_DIR_NOT_FOUND`
- 资源配额开启时，受并发槽位与工作目录配额约束（`CONCURRENCY_LIMIT` / `QUOTA_EXCEEDED`）
- 执行超时按 `SKILL_EXECUTION_TIMEOUT_SECONDS` 控制，输出按 `SKILL_MAX_OUTPUT_BYTES` 截断

### 6.7 Skill 资源接口（`skill://`）补齐

为对齐企业 P0 的 `skill://list` 与 `skill://{id}@{version}` 资源契约，提供两个 Tool 来返回符合 MCP Resource 结构的 payload：

- `skill_list_resource`：返回 `skill://list`
- `skill_detail_resource`：返回 `skill://{id}@{version}`

资源数据来源：
- 技能集合：数据库 `skills`（按当前用户过滤，且默认不含已下架技能）
- 技能元数据：版本归档目录 `_versions/{version}/SKILL.md` 的 frontmatter
- 弃用信息：由配置 `DEPRECATED_ENDPOINTS` / `DEPRECATED_VERSIONS` / `DEPRECATED_VERSION_SUNSET_DATE` 计算并注入 `deprecation_info`

### 6.8 ExecuteSkillOp（企业执行契约）

为对齐企业 P0 的 `execute_skill` 工具契约，提供 `execute_skill` Tool：

- 输入：`skill_uuid`（UUID）、可选 `version`、可选 `parameters`
- 执行：从目标版本的 `SKILL.md` 解析 `command` 或 `entrypoint` 推导命令
- 安全：命令执行受白名单限制，拒绝危险命令
- 参数：通过环境变量 `SKILL_PARAMS` 传入 JSON 字符串
- 授权：执行前同时校验 RBAC（`skill.execute`）与可见性（`is_skill_visible`）
- 审计：开启审计时写入 `skill.execute` 事件（含版本与执行耗时）

---

## 7. 项目结构

> **说明**: 项目根目录为 `skillhub-mcp/`，Python 包名为 `skillhub`。
>
> **注意**: 以下结构为当前仓库后端与前端控制台的实际结构。`core/security/`、`core/middleware/`、`models/`、`schemas/`、`repositories/`、`services/`、`api/`、`db/` 等目录为多用户改造引入的模块，已在仓库中创建。现有 `core/tools/` 和 `core/utils/` 目录将保留并扩展。

### 7.1 双模式架构

项目同时支持两种运行模式：

| 模式 | 入口 | 用途 | 传输方式 |
|------|------|------|---------|
| **FlowLLM 模式** | `main.py` (现有) | MCP 服务 | stdio/SSE |
| **FastAPI 模式** | `api_app.py` (新增) | Web API + MCP | HTTP/SSE |

```
skillhub-mcp/
├── backend/
│   ├── __init__.py
│   ├── main.py
│   ├── api_app.py
│   ├── config/
│   │   ├── config_parser.py
│   │   ├── default.yaml
│   │   └── settings.py
│   ├── api/
│   │   ├── router.py
│   │   ├── deps.py
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── tokens.py
│   │   │   ├── skills.py
│   │   │   ├── dashboard.py
│   │   │   └── audit.py
│   │   └── mcp/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── http_handler.py
│   │       └── sse_handler.py
│   ├── core/
│   │   ├── decorators/
│   │   │   └── deprecation.py
│   │   ├── middleware/
│   │   │   ├── auth.py
│   │   │   ├── deprecation.py
│   │   │   ├── logging.py
│   │   │   └── rate_limit.py
│   │   ├── security/
│   │   │   ├── jwt_utils.py
│   │   │   ├── password.py
│   │   │   ├── token.py
│   │   │   └── rbac.py
│   │   ├── metrics/tool_call_metrics.py
│   │   ├── tools/
│   │   │   ├── load_skill_metadata_op.py
│   │   │   ├── load_skill_op.py
│   │   │   ├── read_reference_file_op.py
│   │   │   ├── run_shell_command_op.py
│   │   │   ├── execute_skill_op.py
│   │   │   └── skill_resource_ops.py
│   │   └── utils/
│   │       ├── command_whitelist.py
│   │       ├── service_runner.py
│   │       ├── skill_archive.py
│   │       ├── skill_storage.py
│   │       └── user_context.py
│   ├── models/
│   │   ├── base.py
│   │   ├── user.py
│   │   ├── token.py
│   │   ├── skill.py
│   │   ├── skill_version.py
│   │   ├── enterprise.py
│   │   ├── team.py
│   │   ├── audit_log.py
│   │   ├── request_metric.py
│   │   ├── verification_code.py
│   │   └── email_delivery_log.py
│   ├── repositories/
│   │   ├── user.py
│   │   ├── token.py
│   │   ├── skill.py
│   │   ├── skill_version.py
│   │   ├── enterprise.py
│   │   ├── team.py
│   │   ├── audit_log.py
│   │   └── request_metric.py
│   ├── services/
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── token.py
│   │   ├── skill.py
│   │   ├── audit.py
│   │   ├── deprecation_notification.py
│   │   ├── verification_code.py
│   │   └── email_sender.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── token.py
│   │   ├── skill.py
│   │   ├── skill_version.py
│   │   ├── skill_lifecycle.py
│   │   ├── skill_download.py
│   │   ├── metrics.py
│   │   ├── metrics_reset.py
│   │   ├── audit.py
│   │   ├── verification.py
│   │   └── response.py
│   └── db/
│       ├── session.py
│       └── migrations/
├── tests/
├── frontend/
├── docs/
├── pyproject.toml
└── README.md
```

### 7.2 启动方式

```bash
# FlowLLM 模式（stdio/SSE，无用户认证）
skillhub-mcp
# 或直接指定模块入口
python -m skillhub.main

# FastAPI 模式（HTTP API，多用户认证）
uvicorn skillhub.api_app:app --host 0.0.0.0 --port 8000
```

### 7.3 入口文件说明

#### main.py（保留）

```python
import sys

from backend.core.app import OpenSkillHubMcpApp


def main() -> None:
    with OpenSkillHubMcpApp(*sys.argv[1:]) as app:
        app.run_service()
```

#### api_app.py（新增）

```python
from contextlib import AsyncExitStack, asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.mcp import McpAppProxy, ensure_mcp_initialized, get_http_app, get_sse_app, shutdown_mcp
from backend.api.router import api_router
from backend.config.settings import settings
from backend.core.middleware.deprecation import DeprecationMiddleware
from backend.core.middleware.logging import RequestLoggingMiddleware, configure_loguru
from backend.core.middleware.rate_limit import RateLimitMiddleware
from backend.db.session import get_async_session, init_db
from backend.repositories.audit_log import AuditLogRepository
from backend.services.deprecation_notification import DeprecationNotifier

@asynccontextmanager
async def lifespan(_application: FastAPI):
    await init_db()
    await ensure_mcp_initialized()
    if settings.ENABLE_DEPRECATION_NOTIFIER_ON_STARTUP:
        async for session in get_async_session():
            notifier = DeprecationNotifier(
                AuditLogRepository(session),
                day_offsets=list(settings.DEPRECATION_NOTIFY_OFFSETS_DAYS),
            )
            await notifier.notify_upcoming_deprecation()
            break
    async with AsyncExitStack() as stack:
        for mcp_app in (get_http_app(), get_sse_app()):
            router = getattr(mcp_app, "router", None)
            lifespan_context = getattr(router, "lifespan_context", None) if router else None
            if lifespan_context:
                await stack.enter_async_context(lifespan_context(mcp_app))
        yield
    await shutdown_mcp()

def create_application() -> FastAPI:
    configure_loguru()
    application = FastAPI(lifespan=lifespan, redirect_slashes=False)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(RequestLoggingMiddleware)
    application.add_middleware(RateLimitMiddleware)
    if settings.ENABLE_DEPRECATION_HEADERS:
        application.add_middleware(
            DeprecationMiddleware,
            deprecated_endpoints=settings.DEPRECATED_ENDPOINTS,
            deprecated_versions=settings.DEPRECATED_VERSIONS,
            version_sunset_date=settings.DEPRECATED_VERSION_SUNSET_DATE,
        )
    application.include_router(api_router, prefix="/api/v1")
    application.mount("/mcp", McpAppProxy(get_http_app))
    application.mount("/sse", McpAppProxy(get_sse_app))
    return application

app = create_application()
```

---

### 7.4 前端控制台

前端控制台位于 `frontend/`，使用 Next.js App Router + Tailwind + shadcn/ui，提供登录、注册、Dashboard、Skills、Tokens、Profile、Security 等页面，并与后端 API 进行联调。

访问流程：
- 未登录访问任意控制台页面时自动进入 `/login`
- `/login` 与 `/register` 页面无需鉴权
- 登录成功后进入 Dashboard、Skills、Profile、Security 等页面

启动方式：

```bash
cd frontend
npm install
npm run dev
```

环境变量：

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## 8. 依赖清单

### 8.1 核心依赖

| 依赖包 | 版本要求 | 用途 |
|--------|---------|------|
| `fastapi` | >=0.109.0 | Web 框架 |
| `uvicorn[standard]` | >=0.27.0 | ASGI 服务器 |
| `sqlalchemy[asyncio]` | >=2.0.0 | ORM |
| `asyncpg` | >=0.29.0 | PostgreSQL 异步驱动 |
| `alembic` | 未固定（按安装解析） | 数据库迁移 |
| `pydantic` | >=2.5.0 | 数据验证 |
| `pydantic-settings` | >=2.1.0 | 配置管理 |
| `PyJWT` | 未固定（按安装解析） | JWT 处理 |
| `passlib[bcrypt]` | 未固定（按安装解析） | 密码哈希 |
| `python-multipart` | 未固定（按安装解析） | 文件上传 |
| `cryptography` | >=42.0.0 | 下载加密与摘要 |
| `PyYAML` | >=6.0 | YAML/frontmatter 解析 |
| `flowllm` | >=0.2.0.7 | MCP 框架 |
| `loguru` | >=0.7.0 | 日志 |
| `httpx` | 未固定（按安装解析） | HTTP 客户端 |
| `psutil` | >=5.9.0 | 系统监控 |
| `boto3` | >=1.34.0 | S3/MinIO 归档后端 |
| `ldap3` | >=2.9.1 | LDAP/AD 登录 |
| `uv` | 未固定（按安装解析） | Python 依赖管理与执行 |

### 8.2 开发依赖

| 依赖包 | 版本要求 | 用途 |
|--------|---------|------|
| `pytest` | >=8.4.2 | 测试框架 |
| `pytest_asyncio` | >=1.2.0 | 异步测试支持 |
| `pytest-cov` | >=4.1.0 | 测试覆盖率 |
| `aiosqlite` | >=0.19.0 | SQLite 异步驱动（测试用） |
| `ruff` | >=0.1.0 | 代码格式化 |
| `mypy` | >=1.8.0 | 类型检查 |
| `types-PyYAML` | 最新版 | PyYAML 类型提示 |
| `types-passlib` | 最新版 | passlib 类型提示 |
| `types-psutil` | 最新版 | psutil 类型提示 |
| `mkdocs-shadcn` | 最新版 | 文档主题/站点构建 |

### 8.3 pyproject.toml 示例

```toml
[project]
name = "open-skillhub"
dynamic = ["version"]
requires-python = ">=3.10"

dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.29.0",
    "alembic>=1.13.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "PyJWT>=2.8.0",
    "passlib[bcrypt]>=1.7.4",
    "python-multipart>=0.0.6",
    "cryptography>=42.0.0",
    "PyYAML>=6.0",
    "flowllm>=0.2.0.7",
    "loguru>=0.7.0",
    "httpx>=0.26.0",
    "psutil>=5.9.0",
    "boto3>=1.34.0",
    "ldap3>=2.9.1",
    "uv",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.4.2",
    "pytest_asyncio>=1.2.0",
    "pytest-cov>=4.1.0",
    "aiosqlite>=0.19.0",
    "ruff>=0.1.0",
    "mypy>=1.8.0",
    "types-PyYAML",
    "types-passlib",
    "types-psutil",
    "mkdocs-shadcn",
]
```

---

## 9. 配置规范

### 9.1 环境变量

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/skillhub
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10
DATABASE_POOL_TIMEOUT=30
DATABASE_POOL_RECYCLE=1800

# JWT
SECRET_KEY=your-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# 应用
DEBUG=false
CORS_ORIGINS=["http://localhost:3000"]

# 日志
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=/var/log/backend/app.log

# 存储
SKILL_STORAGE_PATH=/data/skills
SKILL_ARCHIVE_BACKEND=local
SKILL_ARCHIVE_S3_BUCKET=
SKILL_ARCHIVE_S3_REGION=
SKILL_ARCHIVE_S3_ENDPOINT=
SKILL_ARCHIVE_S3_ACCESS_KEY_ID=
SKILL_ARCHIVE_S3_SECRET_ACCESS_KEY=
SKILL_ARCHIVE_S3_FORCE_PATH_STYLE=true
SKILL_EXECUTION_TIMEOUT_SECONDS=300
SKILL_MAX_CONCURRENT_EXECUTIONS_PER_USER=4
SKILL_MAX_CONCURRENT_EXECUTIONS_PER_TEAM=16
SKILL_MAX_WORKDIR_BYTES=1073741824
SKILL_MAX_OUTPUT_BYTES=1048576

# 限流配置
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
METRICS_RETENTION_DAYS=90

# 邮件（DEBUG 使用 SMTP 备选，生产使用阿里云邮件推送）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=your-sender@example.com
SMTP_USE_TLS=true
ALIYUN_DM_ACCESS_KEY_ID=your-aliyun-access-key-id
ALIYUN_DM_ACCESS_KEY_SECRET=your-aliyun-access-key-secret
ALIYUN_DM_ACCOUNT_NAME=sender@your-domain.com
ALIYUN_DM_FROM_ALIAS=Open SkillHub
ALIYUN_DM_REPLY_TO_ADDRESS=true
ALIYUN_DM_ENDPOINT=https://dm.aliyuncs.com/

# LLM（可选：仅在需要调用 LLM Provider 时配置）
FLOW_LLM_API_KEY=your-api-key
FLOW_LLM_BASE_URL=https://api.openai.com/v1

# 企业能力与功能开关（公网/私有化差异化部署）
ENABLE_PUBLIC_SIGNUP=true
ENABLE_EMAIL_OTP_LOGIN=true
ENABLE_SSO=false
ENABLE_LDAP=false
ENABLE_ORG_MODEL=false
ENABLE_RBAC=false
ENABLE_SKILL_VISIBILITY=false
ENABLE_AUDIT_LOG=false
ENABLE_AUDIT_EXPORT=false
ENABLE_SKILL_DOWNLOAD_ENCRYPTION=true
ENABLE_LOCAL_CACHE_ENCRYPTION=true
ENABLE_CACHE_OFFLINE_FALLBACK=true
ENABLE_SANDBOX_EXECUTION=false
ENABLE_RESOURCE_QUOTA=false
ENABLE_NETWORK_EGRESS_CONTROL=false
ENABLE_RATE_LIMIT=true
ENABLE_METRICS=true
ENABLE_DEPRECATION_HEADERS=true
ENABLE_DEPRECATION_NOTIFIER_ON_STARTUP=false

# API 弃用配置
DEPRECATED_ENDPOINTS={"\/api\/v1\/legacy\/endpoint":"2026-12-31"}
DEPRECATED_VERSIONS=["/api/v1"]
DEPRECATED_VERSION_SUNSET_DATE=2026-12-31
DEPRECATION_NOTIFY_OFFSETS_DAYS=[90,30,7]

# 企业默认策略
DEFAULT_SKILL_VISIBILITY=private
DEFAULT_ROLE=member
DEFAULT_USER_STATUS=active

# RBAC 权限矩阵（JSON 字符串）
RBAC_ROLE_PERMISSIONS={"admin":["*"],"member":["skill.list","skill.read","skill.create","skill.update","skill.delete","skill.upload","skill.execute"],"viewer":["skill.list","skill.read"]}

# SSO Claims 映射
SSO_JWT_SECRET=
SSO_JWT_ISSUER=
SSO_JWT_AUDIENCE=
SSO_JWT_ALGORITHM=HS256
SSO_EMAIL_CLAIM=email
SSO_USERNAME_CLAIM=username
SSO_ENTERPRISE_CLAIM=enterprise_id
SSO_TEAM_CLAIM=team_id
SSO_ROLE_CLAIM=role
SSO_STATUS_CLAIM=status

# LDAP 映射
LDAP_URL=
LDAP_USER_DN_TEMPLATE=
LDAP_SEARCH_BASE=
LDAP_SEARCH_FILTER=(uid={username})
LDAP_EMAIL_ATTR=mail
LDAP_USERNAME_ATTR=uid
LDAP_ENTERPRISE_ATTR=enterprise_id
LDAP_TEAM_ATTR=team_id
LDAP_ROLE_ATTR=role
LDAP_STATUS_ATTR=status

# 技能下载与缓存 TTL
SKILL_DOWNLOAD_TTL_SECONDS=3600
SKILL_CACHE_TTL_SECONDS=604800
SKILL_VERSION_BUMP_STRATEGY=patch
```

### 9.2 Settings类

```python
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, model_validator, ValidationInfo


class Settings(BaseSettings):
    # 数据库
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_POOL_RECYCLE: int = 1800

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # 应用
    DEBUG: bool = False
    CORS_ORIGINS: List[str] = []

    # 时区配置（用于统一处理时间戳）
    # 建议使用 UTC 时区，确保 datetime.now(timezone.utc) 调用的一致性
    TIMEZONE: str = "UTC"

    # 日志
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_FILE: str = "/var/log/backend/app.log"

    # 存储
    SKILL_STORAGE_PATH: str = "/data/skills"

    # 限流配置
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60

    # 邮件发送
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    ALIYUN_DM_ACCESS_KEY_ID: str = ""
    ALIYUN_DM_ACCESS_KEY_SECRET: str = ""
    ALIYUN_DM_ACCOUNT_NAME: str = ""
    ALIYUN_DM_FROM_ALIAS: str = ""
    ALIYUN_DM_REPLY_TO_ADDRESS: bool = True
    ALIYUN_DM_ENDPOINT: str = "https://dm.aliyuncs.com/"

    # LLM
    FLOW_LLM_API_KEY: str = ""
    FLOW_LLM_BASE_URL: str = ""

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            raw = v.strip()
            if raw.startswith("[") and raw.endswith("]"):
                try:
                    import json

                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in raw.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def validate_cors_origins(self):
        # 生产环境 CORS 安全配置
        if not self.DEBUG and (not self.CORS_ORIGINS or "*" in self.CORS_ORIGINS):
            raise ValueError(
                "生产环境 CORS_ORIGINS 必须显式配置且不能包含通配符 '*'"
            )
        return self

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v):
        if len(v) < 32:
            raise ValueError("SECRET_KEY 长度必须至少 32 字符")
        return v

    @field_validator("DATABASE_POOL_SIZE", "DATABASE_MAX_OVERFLOW")
    @classmethod
    def validate_pool_settings(cls, v, info: ValidationInfo):
        field_name = info.field_name
        if v < 1:
            raise ValueError(f"{field_name} 必须至少为 1")
        if v > 100:
            raise ValueError(f"{field_name} 不能超过 100")
        return v

    @field_validator("DATABASE_POOL_TIMEOUT", "DATABASE_POOL_RECYCLE")
    @classmethod
    def validate_timeout_settings(cls, v, info: ValidationInfo):
        field_name = info.field_name
        if v < 1:
            raise ValueError(f"{field_name} 必须至少为 1 秒")
        if v > 3600:
            raise ValueError(f"{field_name} 不能超过 3600 秒")
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True
    )


settings = Settings()
```

### 9.2.1 Settings 补充说明（与当前实现对齐）

上方代码片段用于说明主要校验逻辑，未完整展开全部配置项。企业私有云相关开关与映射字段以仓库实际实现为准（`backend/config/settings.py`），重点包括：

- 公网/私有化能力开关：`ENABLE_*`
- API 弃用治理：`ENABLE_DEPRECATION_HEADERS`、`ENABLE_DEPRECATION_NOTIFIER_ON_STARTUP`、`DEPRECATED_*`
- 权限与默认策略：`DEFAULT_SKILL_VISIBILITY`、`DEFAULT_ROLE`、`RBAC_ROLE_PERMISSIONS`
- 身份映射：`SSO_*_CLAIM`、`LDAP_*_ATTR`
- 下载与缓存时效：`SKILL_DOWNLOAD_TTL_SECONDS`、`SKILL_CACHE_TTL_SECONDS`
- 版本策略：`SKILL_VERSION_BUMP_STRATEGY`

### 9.3 邮件验证码发送与运维要求

#### 当前实现与可行性
- 发送入口为 `/api/v1/auth/verification-code`，登录/注册/邮箱绑定共用
- 使用 FastAPI BackgroundTasks 异步触发发送，避免阻塞主请求
- DEBUG=true 使用 SMTP；DEBUG=false 使用阿里云邮件推送
- 验证码存储在数据库表（verification_codes），发送日志写入 email_delivery_logs
- 支持有效期、重发间隔、错误次数限制与错误码映射
- 发送失败会重试并记录失败原因
- 若 SMTP/阿里云配置缺失会直接报错，需要在环境变量中配置

#### 仍需补充的生产能力（建议）
- 引入独立任务队列/Worker，统一设置超时、并发与重试策略
- 增加按 IP/邮箱/设备的全局频控与风控策略（可与限流中间件联动）
- 增加发送渠道故障时的降级或备用通道
- 明确验证码与邮件日志的保留周期与清理任务
- 模板与品牌配置参数化（标题/发件别名/多语言开关）并记录模板版本

#### 前端交互规范（验证码）
- 登录/注册页均提供“发送验证码”入口，未填写邮箱或处于冷却时间时禁用按钮
- 发送成功后展示有效期提示，并启动重发倒计时（按钮显示剩余秒数）
- 发送失败或校验失败需展示错误提示，文案与后端错误码一致
- 登录成功跳转至控制台首页；注册成功提示后引导跳转登录页
- 同一套交互规则复用于登录、注册与邮箱绑定

#### 发送通道策略
- DEBUG=true：使用 SMTP + 业务邮箱的备选方案
- DEBUG=false：使用阿里云邮件推送服务

#### 发送任务异步化
- 邮件发送应放入任务队列或后台任务执行，避免阻塞用户请求
- 建议为验证码发送设置独立队列与并发限制，避免高峰期影响主链路

#### 验证码持久化存储
- 生产环境应使用 Redis 或数据库存储验证码记录，避免多实例与重启导致校验失效
- 存储字段至少包含：email、purpose、code、expires_at、resend_available_at、attempts_left

#### 模板与内容管理
- 邮件模板需包含验证码、有效期与重发间隔提示
- 提供品牌文案与多语言扩展能力（至少支持中英模板切换）
- 模板变更需记录版本与发布时间，支持回滚

#### 配置与密钥管理
- SMTP 账号、阿里云 AccessKey 只能通过环境变量或密钥管理系统注入
- 生产环境严禁在代码与配置文件中硬编码密钥

#### 监控与审计
- 记录发送成功率、失败原因分布与重试次数
- 发送失败需触发重试与告警（短信/IM/邮箱）
- 审计日志需包含请求来源、目的邮箱、purpose、发送通道与结果

# 数据库连接池配置示例（db/session.py）
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# 创建异步引擎，使用连接池配置
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,          # 连接池大小
    max_overflow=settings.DATABASE_MAX_OVERFLOW,    # 超出池大小的额外连接数
    pool_timeout=settings.DATABASE_POOL_TIMEOUT,    # 获取连接的超时时间（秒）
    pool_recycle=settings.DATABASE_POOL_RECYCLE,    # 连接回收时间（秒）
    pool_pre_ping=True,                             # 使用前检测连接是否有效
    echo=settings.DEBUG,                            # 调试模式下打印SQL
)

# 创建异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    '''获取数据库会话的依赖函数'''
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    '''初始化数据库（创建所有表）'''
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
"""
```

---

## 10. 安全要求

### 10.1 密码安全

- 使用bcrypt进行密码哈希
- 最小密码长度8位（`schemas/user.py` 中通过 `Field(min_length=8)` 强制）
- 建议包含大小写字母、数字、特殊字符（当前实现为建议项，未做复杂度强制校验）

### 10.2 Token安全

- API Token仅在创建时显示一次
- 存储SHA256哈希值而非明文
- 支持Token过期和撤销
- MCP 网关优先校验 API Token；失败后兼容校验 JWT Access Token

### 10.3 文件上传安全

- **文件类型验证**: 仅允许以下扩展名
  - `.md` - Markdown 文档
  - `.py` - Python 脚本
  - `.js` - JavaScript 脚本
  - `.sh` - Shell 脚本
  - `.txt` - 纯文本
  - `.json` - JSON 文件
  - `.yaml`, `.yml` - YAML 配置文件
- **ZIP 包策略**:
  - `/api/v1/skills/upload` 在入口层单独识别 `.zip`
  - ZIP 解包后仍按白名单校验每个文件，且执行路径安全校验
- **大小限制**:
  - 单文件大小: 10MB
  - 总上传大小: 100MB
  - 单个 Skill 文件总数: 50个
- **路径安全**:
  - 禁止 `..` 路径遍历
  - 禁止绝对路径
  - 文件名仅允许字母、数字、下划线、连字符和点
- **上传行为差异**:
  - 普通文件上传（`upload_file`）仅接收单文件名，不支持子目录路径
  - ZIP 上传（`upload_zip`）支持子目录，但每个条目都执行路径与扩展名校验

#### 路径遍历防护实现

```python
# core/utils/skill_storage.py
import re
from pathlib import Path
from typing import Optional

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {".md", ".py", ".js", ".sh", ".txt", ".json", ".yaml", ".yml"}

# 文件名安全正则：仅允许字母、数字、下划线、连字符和点
SAFE_FILENAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\.]+$")


def validate_file_path(file_path: str) -> tuple[bool, str]:
    """验证文件路径安全性

    Args:
        file_path: 待验证的文件路径

    Returns:
        tuple[bool, str]: (是否安全, 错误信息)
    """
    # 1. 检查空路径
    if not file_path or not file_path.strip():
        return False, "File path cannot be empty"

    # 2. 检查路径遍历攻击
    if ".." in file_path:
        return False, "Path traversal detected: '..' is not allowed"

    # 3. 检查绝对路径
    if file_path.startswith("/") or (len(file_path) > 1 and file_path[1] == ":"):
        return False, "Absolute paths are not allowed"

    # 4. 检查路径分隔符（仅允许正斜杠）
    if "\\" in file_path:
        return False, "Backslashes are not allowed in file path"

    # 5. 检查每个路径组件
    parts = file_path.split("/")
    for part in parts:
        if not part:
            continue
        if not SAFE_FILENAME_PATTERN.match(part):
            return False, f"Invalid filename component: '{part}'"

    # 6. 检查文件扩展名
    ext = Path(file_path).suffix.lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        return False, f"File extension '{ext}' is not allowed"

    return True, "OK"


def get_safe_skill_path(base_dir: Path, user_id: str, skill_name: str, file_path: str) -> Optional[Path]:
    """获取安全的 Skill 文件路径

    Args:
        base_dir: 基础目录
        user_id: 用户 ID
        skill_name: Skill 名称
        file_path: 相对文件路径

    Returns:
        Optional[Path]: 安全的完整路径，如果验证失败则返回 None
    """
    # 验证文件路径
    is_valid, error = validate_file_path(file_path)
    if not is_valid:
        return None

    # 验证 skill_name
    is_valid, _ = validate_skill_name(skill_name)
    if not is_valid:
        return None

    base_path = (base_dir / user_id / skill_name).resolve()
    full_path = (base_path / file_path).resolve()
    if not full_path.is_relative_to(base_path):
        return None
    return full_path


def validate_filename(filename: str) -> tuple[bool, str]:
    """验证文件名安全性

    Args:
        filename: 待验证的文件名

    Returns:
        tuple[bool, str]: (是否安全, 错误信息)
    """
    if not filename or not filename.strip():
        return False, "Filename cannot be empty"

    if len(filename) > 255:
        return False, "Filename too long (max 255 characters)"

    if not SAFE_FILENAME_PATTERN.match(filename):
        return False, "Filename contains invalid characters"

    ext = Path(filename).suffix.lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        return False, f"File extension '{ext}' is not allowed"

    return True, "OK"
```

#### 使用示例

```python
# 在 API 端点中使用
from backend.core.utils.skill_storage import get_safe_skill_path, validate_filename
from backend.db.session import get_async_session
from backend.repositories.skill import SkillRepository
from backend.services.skill import SkillService

@app.post("/api/v1/skills/upload")
async def upload_skill_file(
    skill_id: str,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    session=Depends(get_async_session),
):
    # 验证文件名
    is_valid, error = validate_filename(file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # skill_id 是数据库记录 ID；目录名使用 skill.name（与 /data/skills/{user_id}/{skill_name}/ 结构一致）
    service = SkillService(SkillRepository(session))
    skill = await service.get_skill(current_user, skill_id)

    # 获取安全路径
    safe_path = get_safe_skill_path(
        base_dir=Path(settings.SKILL_STORAGE_PATH),
        user_id=str(current_user.id),
        skill_name=skill.name,
        file_path=file.filename,
    )

    if not safe_path:
        raise HTTPException(status_code=400, detail="Invalid file path")

    # 写入文件
    safe_path.parent.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    safe_path.write_bytes(content)
```

### 10.4 API安全

- 所有用户API需要JWT认证
- MCP API优先使用API Token认证，并兼容JWT Access Token
- 实现请求限流

### 10.5 RunShellCommandOp 安全增强建议

| 风险类型 | 描述 | 严重程度 |
|---------|------|---------|
| 跨用户访问 | 用户可能通过命令访问他人文件 | 高 |
| 系统命令注入 | 恶意命令影响服务器安全 | 高 |
| 资源耗尽 | 脚本消耗大量 CPU/内存 | 中 |
| 敏感信息泄露 | 命令读取环境变量或配置文件 | 中 |

**推荐策略**:
- 命令白名单与危险模式拦截（生产环境必需）
- 目录配额与并发限制（可选）
- 环境变量收缩（可选）
- 网络关键字拦截（可选）

| 环境 | 推荐方案 | 说明 |
|------|---------|------|
| 开发环境 | 无限制 | 方便调试 |
| 测试环境 | 命令白名单 | 基本安全 |
| 生产环境 | 白名单 + 目录配额/并发 + 环境变量收缩 + 网络关键字拦截 | 轻量安全 |

当前仓库默认启用“命令白名单 + 危险模式拦截”，可通过 `ENABLE_RESOURCE_QUOTA`、`ENABLE_SANDBOX_EXECUTION`、`ENABLE_NETWORK_EGRESS_CONTROL` 启用目录配额、环境变量收缩、网络关键字拦截；且不区分开发/测试/生产环境。`COMMAND_SECURITY_LEVEL`、`COMMAND_TIMEOUT`、`COMMAND_MAX_*` 等配置项暂未提供。

---

## 11. 错误处理

### 11.1 标准错误响应格式

```json
{
  "detail": "错误描述信息",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

对齐当前实现：
- `HTTPException` 会统一转换为上述结构；若 `detail` 已是 `{detail, code, ...}` 则保留并补齐 `timestamp`
- 请求体验证错误（422）统一返回 `{"detail":"Validation error","code":"VALIDATION_ERROR",...}`
- 未处理异常统一返回 `500` + `INTERNAL_SERVER_ERROR`
- MCP Tool 场景也复用同字段语义（通常以 JSON 字符串作为 tool output 返回）

### 11.2 HTTP状态码规范

| 状态码 | 场景 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 204 | 删除成功（无返回内容） |
| 400 | 请求参数错误 |
| 401 | 未认证或Token无效 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如邮箱已存在） |
| 429 | 触发限流 |
| 422 | 请求体验证失败 |
| 503 | 服务不可用（如健康检查数据库不可达） |
| 500 | 服务器内部错误 |

### 11.3 默认错误码映射

| HTTP 状态码 | 默认 `code` |
|------------|-------------|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `VALIDATION_ERROR` |
| 500 | `INTERNAL_SERVER_ERROR` |

说明：业务层可返回更细粒度错误码（如 `INVALID_TOKEN_FORMAT`、`SKILL_DEACTIVATED`、`COMMAND_BLOCKED`），全局异常处理会透传该业务错误码。

---

## 12. 测试要求

### 12.1 测试覆盖率

- 当前仓库已接入 `pytest` 与 `pytest-cov` 依赖，但未在配置中强制覆盖率阈值
- 建议以 CI 规则补充覆盖率门槛（如 `--cov-fail-under`）

### 12.2 测试类型

- 单元测试：Services、Repositories、Security、Utils、MCP Tool Ops
- 集成测试：REST API（auth/users/skills/tokens/dashboard/audit）与 MCP 鉴权/资源/工具链路
- 端到端脚本：仓库提供 `run_project_http.py`、`run_project_sse.py`、`run_skill_agent.py` 用于联调验证

### 12.3 测试数据库

默认使用内存 SQLite（`conftest.py` 通过环境变量注入）：
```python
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
```

> **兼容性注意事项**: PostgreSQL 和 SQLite 在某些 SQL 语法上有差异：
> - **UUID 类型**: PostgreSQL 原生支持 UUID 类型，SQLite 使用 TEXT 存储。SQLAlchemy 会自动处理，但原生 SQL 需要注意。
> - **JSON 操作**: PostgreSQL 支持丰富的 JSON 操作符，SQLite 支持有限。
> - **自增主键**: PostgreSQL 使用 SERIAL/IDENTITY，SQLite 使用 AUTOINCREMENT。
> - **布尔类型**: PostgreSQL 有原生 BOOLEAN，SQLite 使用 0/1 整数。
>
> **建议**:
> - 优先使用 SQLAlchemy ORM 方法，避免原生 SQL
> - 当前仓库主键 UUID 由应用层生成（uuid4），迁移脚本不依赖 PostgreSQL 的 gen_random_uuid()
> - 如需使用 PostgreSQL 特有特性，建议在测试环境中使用 `pytest-postgresql` 启动真实 PostgreSQL 实例
> - 或者在代码中使用条件判断兼容两种数据库

---

## 13. 部署要求

### 13.1 Docker支持

- 提供Dockerfile
- 提供docker-compose.yml（包含PostgreSQL）
- Dockerfile 默认镜像为 `python:3.11-slim`，容器启动时先执行 `alembic upgrade head` 再启动 API
- docker-compose 默认拆分为 `db` / `migrate` / `api` 三服务，`api` 依赖迁移成功后启动

### 13.2 数据库迁移

- 使用Alembic进行数据库迁移
- 提供初始化迁移脚本
- 迁移目录已初始化为 `backend/db/migrations`，包含 `env.py` 与多个 `versions/*.py`

#### Alembic 异步配置

由于使用 SQLAlchemy 2.0 + asyncpg，需要特殊配置异步支持：

**env.py 配置示例**:

```python
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from backend.db.session import Base
from backend.config.settings import settings

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**迁移命令**:

```bash
# 创建新迁移
alembic revision --autogenerate -m "description"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

### 13.3 健康检查

- 提供 `/health` 端点
- 检查数据库连接状态
- 提供 `/metrics` 端点（资源与连接指标，受 `ENABLE_METRICS` 开关控制）

---

## 14. 常见问题

### Q1: 如何处理现有用户的迁移？

当前实现已采用用户模型与私有技能目录（`/data/skills/{user_id}/{skill_name}`）：
- 新建/上传技能默认写入用户私有目录
- MCP Tool 在无用户上下文场景下仍保留全局目录回退逻辑（向后兼容）
- 若历史数据在全局目录，建议提供一次性迁移脚本复制到目标用户目录并回填数据库记录

### Q2: 如何实现 Token 黑名单？

可选方案：
- 当前实现：数据库字段 `is_active=false` 即视为撤销，校验失败返回 Token revoked
- Redis 方案：存储 revoked token ID，适合多实例高并发场景
- 强化方案：叠加短有效期与轮换策略，降低泄露窗口

### Q3: 如何扩展为分布式部署？

建议考虑：
- 数据库：使用托管 PostgreSQL
- 文件存储：启用 `SKILL_ARCHIVE_BACKEND=s3` 并配置对象存储（S3/MinIO）
- 缓存：按需引入 Redis（当前仓库未强依赖）
- 负载均衡：Nginx 或云负载均衡器

---

## 附录

### A. MCP客户端配置示例

```json
{
  "mcpServers": {
    "skillhub-mcp": {
      "type": "http",
      "url": "https://your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer ask_live_xxx..."
      }
    }
  }
}
```

### B. 文件命名规范

- 模型文件：`models/{name}.py`
- Schema文件：`schemas/{name}.py`
- Repository文件：`repositories/{name}.py`
- Service文件：`services/{name}.py`
- API文件：`api/v1/{name}.py`

### C. 代码风格

- 使用ruff进行代码格式化
- 使用mypy进行类型检查
- 具体规则以仓库当前 Ruff/Mypy 配置为准
