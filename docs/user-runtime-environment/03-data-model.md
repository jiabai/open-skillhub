---
status: draft
ai_read: true
last_updated: 2026-04-03
parent: user-runtime-environment
---

## 数据模型

### User 模型扩展

在 `users` 表添加以下字段：

```python
# backend/models/user.py

class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    # 现有字段...

    # 新增字段 - 运行时环境
    venv_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    installed_dependencies: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    venv_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    venv_last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # 新增字段 - 运行时操作锁（并发安全）
    runtime_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    runtime_lock_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    runtime_locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    runtime_temp_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `venv_path` | `str \| None` | 虚拟环境的绝对路径，未创建时为 `None` |
| `installed_dependencies` | `dict[str, str]` | 已安装依赖清单，格式：`{"package_name": "version"}` |
| `venv_created_at` | `datetime \| None` | 虚拟环境创建时间 |
| `venv_last_used_at` | `datetime \| None` | 最后使用时间，用于空闲超时判断 |
| `runtime_locked` | `bool` | 运行时操作锁，`True` 表示正在部署/执行 |
| `runtime_lock_reason` | `str \| None` | 锁定原因，如 "Deploying dependencies" |
| `runtime_locked_at` | `datetime \| None` | 锁定开始时间，用于估算等待时长 |
| `runtime_temp_path` | `str \| None` | 上传会话临时目录路径。用途：**安全审查等待期间**存储解压后的文件，超时/取消时清理；上传成功后迁移到正式 skill_dir 并清空此字段 |

### installed_dependencies 格式示例

```json
{
  "requests": "2.28.0",
  "playwright": "1.40.0",
  "pydantic": "2.5.0"
}
```

> **格式规范**：字典的键（包名）应**保持原始大小写**存储。PyPI 不允许发布仅大小写不同的包名，因此无需强制小写化。由于 Python 字典键区分大小写，在进行依赖冲突检测、版本比较等操作时，应保持一致的大小写处理方式。

### Skill 模型扩展

在 `skills` 表添加以下字段：

```python
# backend/models/skill.py

class Skill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skills"

    # 现有字段（已在代码中实现）
    # id: Mapped[str]                           # UUID，主键
    # user_id: Mapped[str]                      # 外键关联用户
    # name: Mapped[str]                         # Skill 名称
    # created_at: Mapped[datetime]              # 创建时间
    # updated_at: Mapped[datetime]              # 更新时间
    # skill_dir: Mapped[str]                    # Skill 目录路径

    # 新增字段 - 脚本执行相关
    script_file: Mapped[str] = mapped_column(String(100), default="main.py")
    dependencies: Mapped[list[str]] = mapped_column(JSON, default=list)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)

    # 新增字段 - 部署状态（上传与部署分离设计）
    install_status: Mapped[str] = mapped_column(String(20), default="pending")
    # 状态值: pending | installing | ready | failed
    install_error: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # 现有字段 - 版本管理
    # current_version: Mapped[str]              # 当前激活版本号
```

#### Skill 新增字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `script_file` | `str` | 脚本入口文件名，默认 `main.py`，可从 SKILL.md metadata 解析覆盖 |
| `dependencies` | `list` | 当前激活版本的依赖声明列表，格式：`["requests>=2.28.0", "playwright>=1.40.0"]` |
| `metadata_json` | `dict` | SKILL.md 解析的元数据（DB 列名 `metadata`），可包含 `script_entry` 等自定义配置 |
| `install_status` | `str` | **部署状态**，值域：`pending` / `installing` / `ready` / `failed` |
| `install_error` | `str \| None` | 部署失败时的错误信息，`install_status=failed` 时有值 |

#### install_status 状态流转

```
上传完成 ──→ pending ──→ installing ──→ ready
                              │
                              ↓
                         failed ←── 安装失败
                              │
                              └─── 用户重试 ──→ installing
```

| 状态 | 触发条件 | 可执行 | 可操作 |
|------|---------|--------|--------|
| `pending` | 上传完成时设置（首次创建） | 否 | 首次部署 |
| `installing` | 用户触发部署时设置 | 否 | -（进行中） |
| `ready` | 依赖安装成功时设置 | 是 | -（已就绪） |
| `failed` | 依赖安装失败时设置 | 否 | 重试部署 |

> **设计说明**：
> - `Skill.dependencies`：当前激活版本的依赖声明（冗余字段，方便查询）
> - `SkillVersion.dependencies`：每个版本的独立依赖声明（权威来源）
> - 版本切换时，`Skill.dependencies` 同步更新为对应版本的依赖声明
>
> **路径层级关系**：
> - 用户 Skill 根目录 = `{SKILL_STORAGE_PATH}/{user_id}` （通过配置 + user_id 拼接）
> - `Skill.skill_dir` = `{SKILL_STORAGE_PATH}/{user_id}/{skill_name}`
> - `SkillVersion.storage_path` = `{SKILL_STORAGE_PATH}/{user_id}/{skill_name}/_versions/{version}`

### SkillVersion 模型

在现有 `skill_versions` 表基础上**新增**以下字段：

> **注意**：以下仅列出需要新增或修改的字段，现有字段保持不变。现有字段包括 `dependencies`（JSON，依赖声明列表）、`dependency_spec`（JSON，依赖解析结果）、`dependency_spec_version`（str，解析器版本）、`description`（str）、`metadata_json`（JSON，列名 `metadata`）。

```python
# backend/models/skill_version.py

class SkillVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skill_versions"

    # 现有字段（保持不变）
    # skill_id: Mapped[str]                    # 外键关联
    # version: Mapped[str]                     # 版本号
    # description: Mapped[str]                 # 版本描述
    # dependencies: Mapped[list[str]]          # 依赖声明列表
    # dependency_spec: Mapped[dict]            # 依赖解析结果
    # dependency_spec_version: Mapped[str | None]  # 解析器版本
    # metadata_json: Mapped[dict]              # SKILL.md 元数据（列名 metadata）

    # 新增字段 - 脚本配置
    script_file: Mapped[str] = mapped_column(String(100), default="main.py")

    # 新增字段 - 存储路径
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

> **版本号格式规范**：版本号采用语义版本号（SemVer），格式为 `major.minor.patch`，如 `1.0.0`、`2.1.3`。

#### SkillVersion 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `skill_id` | `str` | 关联的 Skill ID |
| `version` | `str` | 版本号，如 "1.0.0" |
| `dependencies` | `list` | 该版本的依赖声明列表 |
| `dependency_spec` | `dict` | 依赖解析结果 |
| `description` | `str` | 版本描述 |
| `metadata_json` | `dict` | SKILL.md 解析的元数据（列名 `metadata`） |
| `script_file` | `str` | 该版本的脚本入口文件名，默认 `main.py` |
| `storage_path` | `str \| None` | 该版本文件的存储路径 |

### DependencySnapshot 模型

用于保存依赖变更前的快照，支持依赖恢复功能。每次依赖安装前自动保存快照，出问题时用户可一键恢复。

```python
# backend/models/dependency_snapshot.py

class DependencySnapshot(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "dependency_snapshots"

    # 外键关联（级联删除：用户删除时自动删除其所有快照）
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # 快照内容：依赖字典的完整拷贝
    dependencies: Mapped[dict] = mapped_column(JSON)

    # 变更原因，如 "pre_deploy:my-skill:v2.0.0"
    reason: Mapped[str] = mapped_column(String(200))

    # 是否为自动快照（部署前自动保存）
    is_auto: Mapped[bool] = mapped_column(Boolean, default=True)
```

> **级联删除说明**：当用户账户被删除时，其所有依赖快照记录将自动被数据库级联删除。

#### DependencySnapshot 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | `str` | 关联的用户 ID |
| `dependencies` | `dict` | 快照时的依赖清单完整拷贝，格式与 `User.installed_dependencies` 一致 |
| `reason` | `str` | 快照原因，格式：`pre_deploy:{skill_name}:v{version}` 或 `manual:{description}` |
| `is_auto` | `bool` | 是否为自动快照 |

### 索引设计

#### 设计原则

| 原则 | 说明 |
|------|------|
| 最左前缀 | 复合索引的列顺序按"等值条件（高区分度）→ 等值条件（低区分度）→ 排序/范围条件"排列，确保查询能利用索引的最左前缀 |
| 避免冗余 | 复合索引的最左前缀已覆盖的单列查询，不再创建重复单列索引 |
| 注释完整 | 每个索引必须标注用途（支撑的查询场景） |

#### 各模型索引

```python
# ── User 模型索引 ──
# 查找被锁定的用户（后台巡检、请求入口检查）
Index('ix_users_runtime_locked', runtime_locked)
# 空闲环境清理定时任务：WHERE venv_last_used_at < {threshold}
Index('ix_users_venv_last_used_at', venv_last_used_at)

# ── Skill 模型索引 ──
# 按用户查询 Skill 列表（已由初始迁移 b1a2c3d4 创建）
Index('ix_skills_user_id', user_id)
# 查询特定部署状态的 Skill，如 WHERE install_status = 'failed'
Index('ix_skills_install_status', install_status)

# ── SkillVersion 模型索引 ──
# 按 Skill 查询所有版本（如版本列表 API）
Index('ix_skill_versions_skill_id', skill_id)
# ⚠️ 此索引使用频率较低，仅用于按版本号精确查找场景。
#   日常查询主要走 uix_skill_versions 唯一约束（见下方唯一约束设计）。
Index('ix_skill_versions_version', version)
```

#### 复合索引

DependencySnapshot 模型使用一个 3 列复合索引：

```python
# ── DependencySnapshot 模型 ──
# 列顺序设计依据：
#   1. user_id（等值条件，区分度高）→ 过滤到特定用户
#   2. is_auto（等值条件，布尔值，区分度低）→ 区分自动/手动快照
#   3. created_at DESC（排序条件）→ 按时间降序，避免文件排序
#
# 最左前缀覆盖：
#   (user_id) → 按 user_id 查询（如快照列表 API）
#   (user_id, is_auto) → 按 user_id + is_auto 查询（如清理逻辑）
#   (user_id, is_auto, created_at DESC) → 完整匹配（如清理时取最早的快照）
#
# ⚠️ 第 186 行 ForeignKey 上的 index=True 会自动创建单列索引 ix_dependency_snapshots_user_id，
#   与复合索引的最左前缀 (user_id) 功能重复。建议移除外键上的 index=True，
#   由复合索引的最左前缀覆盖即可。如保留，应在迁移中明确说明原因。
# ⚠️ created_at.desc() 语法在 Index() 中的支持取决于数据库后端：
#   - SQLite 支持此语法
#   - PostgreSQL 需要确认 SQLAlchemy 版本的兼容性
Index('ix_dependency_snapshots_user_is_auto_created_at', user_id, is_auto, created_at.desc())
```

> **注意**：由于复合索引 `(user_id, is_auto, created_at.desc())` 的最左前缀已覆盖 `user_id` 单列查询，原设计中第 226 行的 `Index('ix_dependency_snapshots_user_id', user_id)` 是冗余的，应移除。同时第 186 行外键上的 `index=True` 也与之重复，建议一并清理。

#### 关联查询场景

| 索引 | 命中的查询/场景 | 文档引用 |
|------|-----------------|---------|
| `ix_dependency_snapshots_user_is_auto_created_at` | `cleanup_dependency_snapshots()` 中 `list_by_user(user_id, is_auto=True, order_by_desc="created_at")` | [环境清理策略](./09-cleanup-strategy.md) |
| `ix_dependency_snapshots_user_is_auto_created_at`（最左前缀） | `GET /api/v1/runtime/dependency-snapshots` 快照列表查询 | [API 设计 - 查询快照列表](./06-api-design.md) |
| `ix_users_runtime_locked` | 请求入口检查 `runtime_locked = True`、后台巡检 | [并发安全机制](./05-concurrency.md) |
| `ix_users_venv_last_used_at` | 空闲环境清理定时任务 `WHERE venv_last_used_at < threshold` | [环境清理策略](./09-cleanup-strategy.md) |
| `ix_skills_install_status` | 查询未部署/部署失败的 Skill | [API 设计](./06-api-design.md) |

### 唯一约束设计

> **概念说明**：`UniqueConstraint` 和 `Index` 是 SQLAlchemy 中两种不同的索引声明方式。`UniqueConstraint` 创建唯一索引，既保证数据唯一性也提供查询加速；普通 `Index` 仅加速查询，不约束数据唯一性。`UniqueConstraint` 会隐式创建一个唯一索引，因此如果已有唯一约束覆盖的列组合，通常不需要再创建重复的普通索引。

```python
# SkillVersion 模型：同一 Skill 不能有重复版本号
# 隐式创建唯一索引，同时支撑 (skill_id, version) 的联合查询
UniqueConstraint('skill_id', 'version', name='uix_skill_versions')
```

> **说明**：`uix_skill_versions` 唯一约束同时作为复合唯一索引使用，支撑"查询某 Skill 的特定版本"场景。因此 `ix_skill_versions_skill_id` 单列索引在"按 skill_id 查询所有版本"场景下仍有独立价值（因为唯一索引的查询条件通常包含 `version`），两者不冗余。


---

**导航**： [← 架构设计](./02-architecture.md) | [返回目录](./00-index.md) | [核心流程 →](./04-core-flows.md)
