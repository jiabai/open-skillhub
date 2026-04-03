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

> **格式规范**：字典的键（包名）应使用**小写格式**存储。Python 包名在 PyPI 上不区分大小写，但为了确保依赖冲突检测、版本比较等操作的一致性，建议统一使用小写格式。

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
| `current_version` | `str` | 当前激活的版本号，默认 `1.0.0` |
| `skill_dir` | `str` | Skill 文件存储路径，格式：`{SKILL_STORAGE_PATH}/{user_id}/{skill_name}` |
| `install_status` | `str` | **部署状态**，值域：`pending` / `installing` / `ready` / `failed` |
| `install_error` | `str \| None` | 部署失败时的错误信息，`install_status=failed` 时有值 |

#### install_status 状态流转

```
上传完成 ──→ pending ──→ installing ──→ ready
                 ↑            │
                 │            ↓
                 └────── failed ←── 安装失败
                 用户重试 ──→ installing
```

| 状态 | 触发条件 | 可执行 | 可部署 |
|------|---------|--------|--------|
| `pending` | 上传完成时设置 | 否 | 是 |
| `installing` | 用户触发部署时设置 | 否 | 否 |
| `ready` | 依赖安装成功时设置 | 是 | 否（已就绪） |
| `failed` | 依赖安装失败时设置 | 否 | 是（可重试） |

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

```python
# User 模型索引
Index('ix_users_runtime_locked', runtime_locked)
Index('ix_users_venv_last_used_at', venv_last_used_at)

# Skill 模型索引
Index('ix_skills_user_id', user_id)
Index('ix_skills_install_status', install_status)  # 查询未部署的 Skill

# SkillVersion 模型索引
Index('ix_skill_versions_skill_id', skill_id)
Index('ix_skill_versions_version', version)

# DependencySnapshot 模型索引
Index('ix_dependency_snapshots_user_id', user_id)
Index('ix_dependency_snapshots_user_is_auto_created_at', user_id, is_auto, created_at.desc())  # 支持按 user_id + is_auto 过滤并按 created_at 降序排序
```

### 唯一约束设计

```python
# SkillVersion 模型：同一 Skill 不能有重复版本号
UniqueConstraint('skill_id', 'version', name='uix_skill_versions')
```


---

**导航**： [← 架构设计](./02-architecture.md) | [返回目录](./00-index.md) | [核心流程 →](./04-core-flows.md)
