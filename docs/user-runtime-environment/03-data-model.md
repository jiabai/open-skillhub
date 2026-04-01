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
| `installed_dependencies` | `dict` | 已安装依赖清单，格式：`{"package_name": "version"}` |
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

### Skill 模型扩展

在 `skills` 表添加以下字段（用于执行流程）：

```python
# backend/models/skill.py

class Skill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skills"

    # 现有字段...

    # 新增字段 - 脚本执行相关
    script_file: Mapped[str] = mapped_column(String(100), default="main.py")
    dependencies: Mapped[list] = mapped_column(JSON, default=list)  # 依赖声明列表
    metadata: Mapped[dict] = mapped_column(JSON, default=dict)
```

#### Skill 新增字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `script_file` | `str` | 脚本入口文件名，默认 `main.py`，可从 SKILL.md metadata 解析覆盖 |
| `dependencies` | `list` | 依赖声明列表，格式：`["requests>=2.28.0", "playwright>=1.40.0"]` |
| `metadata` | `dict` | SKILL.md 解析的元数据，可包含 `script_entry` 等自定义配置 |


---

**导航**： [← 架构设计](./02-architecture.md) | [返回目录](./00-index.md) | [核心流程 →](./04-core-flows.md)