---
status: draft
ai_read: true
last_updated: 2026-03-31
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
    installed_dependencies: Mapped[dict] = mapped_column(JSON, default=dict)
    venv_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    venv_last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # 新增字段 - 存储路径（用于账户删除时的级联清理）
    skill_storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # 新增字段 - 运行时操作锁（并发安全）
    runtime_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    runtime_lock_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    runtime_locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `venv_path` | `str \| None` | 虚拟环境的绝对路径，未创建时为 `None` |
| `installed_dependencies` | `dict[str, str]` | 已安装依赖清单，格式：`{"package_name": "version"}` |
| `venv_created_at` | `datetime \| None` | 虚拟环境创建时间 |
| `venv_last_used_at` | `datetime \| None` | 最后使用时间，用于空闲超时判断 |
| `runtime_locked` | `bool` | 运行时操作锁，`True` 表示正在安装/更新依赖 |
| `runtime_lock_reason` | `str \| None` | 锁定原因，如 "Installing dependencies" |
| `runtime_locked_at` | `datetime \| None` | 锁定开始时间，用于估算等待时长 |
| `skill_storage_path` | `str \| None` | Skill 文件存储路径，用于账户删除时的级联清理 |

### installed_dependencies 格式示例

```json
{
  "requests": "2.28.0",
  "playwright": "1.40.0",
  "pydantic": "2.5.0"
}
```

> **格式规范**：字典的键（包名）应使用**小写格式**存储。Python 包名在 PyPI 上不区分大小写，但为了确保依赖冲突检测、版本比较等操作的一致性，建议统一使用小写格式。所有依赖检测逻辑（如 `detect_dependency_conflicts`）都使用小写匹配。

### Skill 模型扩展

在 `skills` 表添加以下字段（用于执行流程）：

```python
# backend/models/skill.py

class Skill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skills"

    # 现有字段（已在代码中实现）
    # id: Mapped[str]                           # UUID，主键（继承自 UUIDPrimaryKeyMixin）
    # user_id: Mapped[str]                      # 外键关联用户
    # name: Mapped[str]                         # Skill 名称
    # created_at: Mapped[datetime]              # 创建时间（继承自 TimestampMixin）
    # updated_at: Mapped[datetime]              # 更新时间（继承自 TimestampMixin）
    # skill_dir: Mapped[str]                    # Skill 目录路径（迁移后更名为 storage_path）

    # 新增字段 - 脚本执行相关
    script_file: Mapped[str] = mapped_column(String(100), default="main.py")
    dependencies: Mapped[list] = mapped_column(JSON, default=list)  # 依赖声明列表（冗余字段，方便查询）
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)

    # 新增字段 - 版本管理
    # current_version: Mapped[str | None]       # 现有字段，无需新增

    # 新增字段 - 存储路径
    # 注意：现有代码中已有 skill_dir 字段，语义为 Skill 目录路径。
    # 此处新增 storage_path 用于统一路径管理，替代现有 skill_dir。
    # 迁移时需将 skill_dir 数据迁移至 storage_path，并废弃 skill_dir 字段。
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

#### Skill 新增字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `script_file` | `str` | 脚本入口文件名，默认 `main.py`，可从 SKILL.md metadata 解析覆盖 |
| `dependencies` | `list` | 当前激活版本的依赖声明列表，格式：`["requests>=2.28.0", "playwright>=1.40.0"]` |
| `metadata` | `dict` | SKILL.md 解析的元数据，可包含 `script_entry` 等自定义配置 |
| `current_version` | `str` | 当前激活的版本号，默认 `1.0.0` |
| `storage_path` | `str \| None` | Skill 文件存储路径，格式：`{SKILL_STORAGE_PATH}/{user_id}/{skill_name}` |

> **设计说明**：
> - `Skill.dependencies`：当前激活版本的依赖声明（冗余字段，方便查询）
> - `SkillVersion.dependencies`：每个版本的独立依赖声明（权威来源）
> - 版本切换时，`Skill.dependencies` 同步更新为对应版本的依赖声明
>
> **路径层级关系**：
> - `User.skill_storage_path` = `{SKILL_STORAGE_PATH}/{user_id}` （用户 Skill 根目录）
> - `Skill.storage_path` = `{SKILL_STORAGE_PATH}/{user_id}/{skill_name}` （具体 Skill 目录）
> - `SkillVersion.storage_path` = `{SKILL_STORAGE_PATH}/{user_id}/{skill_name}/_versions/{version}` （版本目录）

### SkillVersion 模型

在现有 `skill_versions` 表基础上**新增**以下字段：

> **注意**：以下仅列出需要新增或修改的字段，现有字段保持不变。现有字段包括 `dependencies`（JSON，依赖声明列表）、`dependency_spec`（JSON，依赖解析结果）、`dependency_spec_version`（str，解析器版本）、`description`（str）、`metadata_json`（JSON，列名 `metadata`）。

```python
# backend/models/skill_version.py

class SkillVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skill_versions"

    # 现有字段（保持不变）
    # skill_id: Mapped[str]                    # 外键关联（已有）
    # version: Mapped[str]                     # 版本号（已有）
    # description: Mapped[str]                 # 版本描述（已有）
    # dependencies: Mapped[list[str]]          # 依赖声明列表（已有）
    # dependency_spec: Mapped[dict]            # 依赖解析结果（已有）
    # dependency_spec_version: Mapped[str | None]  # 解析器版本（已有）
    # metadata_json: Mapped[dict]              # SKILL.md 元数据（已有，列名 metadata）

    # 新增字段 - 脚本配置
    script_file: Mapped[str] = mapped_column(String(100), default="main.py")

    # 新增字段 - 存储路径
    storage_path: Mapped[str] = mapped_column(String(500))

    # 唯一约束（与现有代码保持一致）
    # __table_args__ = (UniqueConstraint("skill_id", "version", name="uix_skill_versions"),)
```

> **版本号格式规范**：版本号采用语义版本号（SemVer），格式为 `major.minor.patch`，如 `1.0.0`、`2.1.3`。正则表达式：`^\d+\.\d+\.\d+$`。

#### SkillVersion 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `skill_id` | `str` | 关联的 Skill ID（已有） |
| `version` | `str` | 版本号，如 "1.0.0"（已有） |
| `dependencies` | `list` | 该版本的依赖声明列表（已有） |
| `dependency_spec` | `dict` | 依赖解析结果（已有） |
| `description` | `str` | 版本描述（已有） |
| `metadata_json` | `dict` | SKILL.md 解析的元数据（已有，列名 `metadata`） |
| `script_file` | `str` | **新增** - 该版本的脚本入口文件名，默认 `main.py` |
| `storage_path` | `str` | **新增** - 该版本文件的存储路径 |

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

    # 变更原因，如 "pre_upload:my-skill:v2.0.0"
    reason: Mapped[str] = mapped_column(String(200))

    # 是否为自动快照（上传/回滚前自动保存）
    is_auto: Mapped[bool] = mapped_column(Boolean, default=True)
```

> **级联删除说明**：当用户账户被删除时，其所有依赖快照记录将自动被数据库级联删除，无需应用层手动清理。这确保了数据完整性，避免孤儿数据。

#### DependencySnapshot 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | `str` | 关联的用户 ID |
| `dependencies` | `dict` | 快照时的依赖清单完整拷贝，格式与 `User.installed_dependencies` 一致 |
| `reason` | `str` | 快照原因，格式：`pre_upload:{skill_name}:v{version}` 或 `manual:{description}` |
| `is_auto` | `bool` | 是否为自动快照，自动快照受保留数量限制，手动快照单独计费 |

### 索引设计

为支持核心流程查询，需要为以下字段创建索引：

```python
# User 模型索引
Index('ix_users_runtime_locked', runtime_locked)  # 查询锁定用户（并发安全）
Index('ix_users_venv_last_used_at', venv_last_used_at)  # 空闲清理查询

# Skill 模型索引
Index('ix_skills_user_id', user_id)  # 按用户查询 Skill（外键自动创建）

# SkillVersion 模型索引
Index('ix_skill_versions_skill_id', skill_id)  # 按 Skill 查询版本（外键自动创建）
Index('ix_skill_versions_version', version)  # 按版本号查询

# DependencySnapshot 模型索引
Index('ix_dependency_snapshots_user_id', user_id)  # 按用户查询快照（外键自动创建）
```

### 唯一约束设计

```python
# SkillVersion 模型：同一 Skill 不能有重复版本号（与现有代码保持一致）
UniqueConstraint('skill_id', 'version', name='uix_skill_versions')

# User 模型：用户名/邮箱唯一（根据现有设计）
# 注意：具体唯一约束需根据现有 User 模型定义调整
```

> **唯一约束说明**：
> - `SkillVersion(skill_id, version)`：确保同一 Skill 的版本号唯一，防止重复版本
> - 其他唯一约束（如用户名、邮箱）应在现有 User 模型中已有定义


---

**导航**： [← 架构设计](./02-architecture.md) | [返回目录](./00-index.md) | [核心流程 →](./04-core-flows.md)