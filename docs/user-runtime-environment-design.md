---
status: deprecated
deprecated_reason: "本文档为早期设计版本，内容已过时。最新、最完整的设计请参考子文档目录 docs/user-runtime-environment/ 下的各子文档。"
superseded_by: docs/user-runtime-environment/
ai_read: true
last_updated: 2026-03-31
---

> ⚠️ **本文档已废弃**。请参阅最新子文档：[`docs/user-runtime-environment/`](./user-runtime-environment/00-index.md)
>
> 主要差异：子文档新增了依赖快照机制（DependencySnapshot）、安全扫描增强、安装超时独立配置、依赖预览确认流程、`runtime_temp_path` 字段等，且移除了已废弃的 `skill_storage_path` 字段（改为动态拼接）。

# 用户级运行时环境设计文档（已废弃）

## 概述

本文档描述了 Open SkillHub 的用户级运行时环境设计方案。由于 skill 的 scripts 脚本会在服务端运行，需要为每个用户的私有 skill 空间搭建独立的运行时环境。

### 设计目标

- **隔离性**：每个用户拥有独立的 Python 虚拟环境，避免依赖冲突
- **安全性**：用户间完全隔离，防止恶意代码影响其他用户
- **效率**：依赖预安装，执行时无延迟
- **可维护性**：支持环境清理、依赖冲突处理等运维操作

### 核心决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 隔离模型 | 用户级别隔离 | 资源占用适中，用户内依赖冲突可控 |
| 安全隔离层级 | subprocess + 环境清理 + 脚本扫描 | 内部可信用户，平衡安全与复杂度 |
| 环境创建时机 | 首次上传 skill 时 | 按需创建，避免资源浪费 |
| 生命周期 | 长期保留 | 后续执行无需等待环境初始化 |
| 依赖安装时机 | 上传时自动安装 | 执行时无延迟，用户体验好 |
| 依赖冲突策略 | 前端交互式处理 | 用户自主决策，灵活可控 |
| Skill 删除时的依赖处理 | 不卸载依赖 | 可能被其他 Skill 使用，避免破坏其他 Skill |
| Skill 版本回滚时的依赖处理 | 不回滚依赖 | 当前环境依赖可能满足需求，避免不必要的卸载/重装 |
| 用户删除所有 Skill 时 | 环境保留 | 等待空闲清理策略处理，用户可能重新上传 |
| 用户删除账户时 | 环境级联删除 | 账户不存在则环境无意义，彻底清理 |
| 环境清理策略 | 组合策略 | 平衡资源占用和运维灵活性 |
| 安装失败处理 | 回滚上传 | 保证数据一致性 |
| 并发安全 | 用户级操作锁 | 防止安装过程中执行导致状态不一致 |

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Open SkillHub Server                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  API Layer   │    │  Skill Service│   │  Venv Manager│       │
│  │  - Upload    │───▶│  - 解析依赖   │───▶│  - 创建环境  │       │
│  │  - Execute   │    │  - 冲突检测   │    │  - 安装依赖  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                  │               │
│                                                  ▼               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    User Runtime Storage                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │   │
│  │  │  User A     │  │  User B     │  │  User C     │       │   │
│  │  │  └── venv/  │  │  └── venv/  │  │  (未创建)   │       │   │
│  │  │      ├── bin│  │      ├── bin│  │             │       │   │
│  │  │      └── lib│  │      └── lib│  │             │       │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Skill Storage                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │   │
│  │  │  User A     │  │  User B     │  │  User C     │       │   │
│  │  │  └── skill1 │  │  └── skill1 │  │  └── skill1 │       │   │
│  │  │  └── skill2 │  │  └── skill2 │  │             │       │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
{VENV_STORAGE_PATH}/                    # 虚拟环境存储根目录
├── {user_id_1}/                        # 用户 A 的虚拟环境
│   ├── bin/
│   │   ├── python                      # Python 解释器
│   │   └── pip                         # pip 工具
│   └── lib/
│       └── python3.x/
│           └── site-packages/          # 已安装的包
├── {user_id_2}/                        # 用户 B 的虚拟环境
│   └── ...
└── {user_id_3}/                        # 用户 C 的虚拟环境
    └── ...

{SKILL_STORAGE_PATH}/                   # Skill 文件存储根目录（现有）
├── {user_id_1}/
│   └── {skill_name}/
│       ├── SKILL.md
│       ├── _versions/
│       └── ...
└── ...

> **注**：Windows 系统下虚拟环境的 `bin/` 目录为 `Scripts/`，`lib/python3.x/` 目录结构相同。
```

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

## 核心流程

### 1. Skill 上传流程（含环境创建和依赖安装）

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Skill Upload Flow                             │
└─────────────────────────────────────────────────────────────────────┘

用户上传 Skill ZIP
       │
       ▼
  ┌─────────────────┐
  │ 1. 验证 ZIP 文件 │
  │    - 格式校验    │
  │    - 大小限制    │
  │    - SKILL.md   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 2. 脚本安全扫描                                  │
  │    - 扫描 scripts/*.py 文件                      │
  │    - 检测风险模式                                │
  └────────┬────────────────────────────────────────┘
           │
           ├───────── 检测到 HIGH 级别风险 ─────────▶ 返回安全拒绝错误
           │
           ├───────── 检测到 MEDIUM 级别风险 ────────▶ 返回安全审查确认
           │                                           等待用户决策
           │
           ▼ 无风险或 LOW 级别风险（继续）
  ┌─────────────────────────────────────────────────┐
  │ 3. 加锁运行时环境                                │
  │    - 检查 runtime_locked 状态                    │
  │    - 若已锁定 → 返回 RUNTIME_LOCKED 错误         │
  │    - 设置 runtime_locked = True                 │
  │    - 设置 runtime_lock_reason                   │
  │    - 设置 runtime_locked_at                     │
  └────────┬────────────────────────────────────────┘
           │ 成功加锁
           ▼
  ┌─────────────────┐
  │ 4. 解析依赖声明  │
  │    - frontmatter│
  │    - metadata   │
  │    - requirements.txt │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     否      ┌─────────────────┐
  │ 5. 检查用户环境  │───────────▶│ 6. 创建虚拟环境  │
  │    是否存在？    │             │    - venv 创建   │
  └────────┬────────┘             │    - 记录路径    │
           │ 是                    │    - 设置 venv_created_at │
           │                       │    - 设置 skill_storage_path │
           │                       └────────┬────────┘
           │                                │
           ▼                                ▼
  ┌─────────────────────────────────────────────────┐
  │ 6a. 环境已存在时更新使用时间                      │
  │    - 更新 venv_last_used_at 为当前时间           │
  │    - 表示环境正在被使用，避免被空闲清理误判        │
  │    - 特别重要：用户删除所有 Skill 后重新上传      │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 7. 解析 SKILL.md metadata                       │
  │    - 提取 script_entry 配置                     │
  │    - 设置 skill.script_file 字段                │
  │    - 默认值为 main.py                           │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 8. 依赖冲突检测                                  │
  │    - 对比已安装依赖与新依赖                       │
  │    - 检测版本冲突                                │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐     有冲突    ┌─────────────────────────────────────────┐
  │ 是否存在冲突？   │─────────────▶│ 9a. 返回冲突信息                         │
  └────────┬────────┘              │    等待用户决策（保持锁定状态）           │
           │ 无冲突                 │                                          │
           │                        │    ⏱️ 超时机制：                          │
           │                        │    - 等待时间上限：5分钟                  │
           │                        │    - 超时后自动取消上传并解锁             │
           │                        │    - 防止长时间占用锁阻塞其他操作         │
           │                        │    - 注意：此超时仅适用于等待用户确认场景  │
           │                        │      安装过程不受此限制（通常 10-60 秒）   │
           │                        └────────┬────────────────────────────────┘
           │                                 │
           │                     ┌───────────┴───────────┐
           │                     │                       │
           │               用户选择              超时自动取消
           │              "允许安装"            （或用户选择"取消"）
           │                     │                       │
           │                     ▼                       ▼
           │            ┌─────────────────┐   ┌─────────────────┐
           │            │ 9b. 卸载冲突包   │   │ 解锁并返回错误   │
           │            │    安装新版本    │   │ 流程结束         │
           │            └────────┬────────┘   └─────────────────┘
           │                     │
           ▼                     ▼
  ┌─────────────────────────────────────────────────┐
  │ 10. 安装新依赖                                   │
  │    - uv pip install [packages]                  │
  │    - 更新 installed_dependencies                │
  │    - 更新 venv_last_used_at                     │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐     失败     ┌─────────────────────────────────────────────────┐
  │ 11. 安装是否成功？ │────────────▶│ 12. 回滚上传并解锁                              │
  └────────┬────────┘              │    - 回滚依赖状态                               │
           │ 成功                   │    - 删除临时文件                               │
           │                        │    - 删除临时 Skill 目录                        │
           │                        │    - 释放运行时锁（最后执行）                    │
           │                        │    - 返回错误信息                               │
           │                        └─────────────────────────────────────────────────┘
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 13. 创建 Skill 版本                              │
  │     - 写入版本目录                               │
  │     - 创建版本记录                               │
  │     - 设置 skill.script_file（从 metadata）      │
  │     - 设置 user.skill_storage_path（首次上传）   │
  │     - 注意：版本创建在解锁之前，确保原子性        │
  │       若创建失败，依赖也会回滚                   │
  └────────┬────────────────────────────────────────┘
           │
           ├───────── 创建失败 ─────────▶ 进入步骤 12 的回滚流程
           │
           ▼ 创建成功
  ┌─────────────────────────────────────────────────┐
  │ 14. 解锁运行时环境                               │
  │     - runtime_locked = False                    │
  │     - 清空 lock_reason 和 locked_at             │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 15. 返回成功响应                                 │
  │     - Skill 名称、版本                           │
  │     - 已安装依赖数量                             │
  └─────────────────────────────────────────────────┘

说明：
- 版本创建在解锁之前执行，保证原子性
- 若版本创建失败，整个流程回滚（包括依赖）
- 只有所有步骤成功后才解锁，避免部分成功导致状态不一致
- 环境已存在时更新 venv_last_used_at，避免用户删除 Skill 后重传被误判为空闲
- skill_storage_path 首次上传时设置，确保账户删除时级联清理可用
- 超时机制仅适用于等待用户确认场景，安装过程不受此限制
```

### 2. Skill 执行流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Skill Execute Flow                             │
└─────────────────────────────────────────────────────────────────────┘

MCP Client 调用 execute_skill
       │
       ▼
  ┌─────────────────┐
  │ 1. 权限验证      │
  │    - 用户认证    │
  │    - Skill 可见性│
  │    - 执行权限    │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     已锁定     ┌─────────────────┐
  │ 2. 检查运行时锁  │─────────────▶│ 返回错误：       │
  │    runtime_locked│              │ RUNTIME_LOCKED   │
  └────────┬────────┘              └─────────────────┘
           │ 未锁定
           ▼
  ┌─────────────────┐     不存在    ┌─────────────────┐
  │ 3. 检查用户环境  │─────────────▶│ 返回错误：       │
  │    是否存在？    │              │ RUNTIME_NOT_INITIALIZED │
  └────────┬────────┘              └─────────────────┘
           │ 存在
           ▼
  ┌─────────────────┐
  │ 4. 获取版本目录  │
  │    - 解析版本号  │
  │    - 定位文件    │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ 5. 更新使用时间  │
  │    venv_last_used_at │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 6. 构建安全环境变量                              │
  │    - 清理继承的环境变量                          │
  │    - 仅保留必要变量                              │
  │    - 设置隔离临时目录                            │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 7. 执行 Skill                                    │
  │    - 使用用户虚拟环境的 Python                   │
  │    - 设置环境变量 SKILL_PARAMS                   │
  │    - 使用安全环境变量                            │
  │    - 执行命令                                    │
  │    - 收集输出                                    │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐
  │ 8. 返回执行结果  │
  │    - status     │
  │    - output     │
  │    - execution_time_ms │
  └─────────────────┘
```

### 3. Skill 删除流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Skill Delete Flow                              │
└─────────────────────────────────────────────────────────────────────┘

用户删除 Skill
       │
       ▼
  ┌─────────────────┐
  │ 1. 权限验证      │
  │    - 用户认证    │
  │    - Skill 所有权│
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 2. 删除 Skill 文件                               │
  │    - 删除版本目录                                │
  │    - 删除版本记录                                │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐
  │ 3. 依赖处理：    │
  │    不卸载依赖    │
  │    保持环境不变  │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ 4. 返回成功响应  │
  └─────────────────┘

说明：
- Skill 的依赖可能被其他 Skill 共享使用
- 删除 Skill 不会触发依赖卸载
- 环境状态保持不变，继续服务其他 Skill
```

### 4. 用户删除所有 Skill 时的处理

```
┌─────────────────────────────────────────────────────────────────────┐
│              User Deletes All Skills Flow                            │
└─────────────────────────────────────────────────────────────────────┘

用户删除最后一个 Skill
       │
       ▼
  ┌─────────────────┐
  │ 1. 执行 Skill    │
  │    删除流程      │
  │    (如上)        │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 2. 检查用户剩余 Skill 数量                        │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐     有剩余     ┌─────────────────┐
  │ 剩余 Skill 数量  │─────────────▶│ 正常返回，流程结束│
  │    > 0？        │              │                  │
  └────────┬────────┘              └─────────────────┘
           │ 无剩余（最后一个）
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 3. 环境保留策略                                  │
  │    - 虚拟环境不删除                              │
  │    - 依赖不卸载                                  │
  │    - venv_last_used_at 保持不变                  │
  │    - 等待空闲清理策略处理                         │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 4. 返回成功响应                                  │
  │    提示：环境将保留，若重新上传 Skill 可直接使用  │
  └─────────────────────────────────────────────────┘

说明：
- 用户可能重新上传 Skill，保留环境可避免重新初始化
- venv_last_used_at 保持不变，反映最后一次实际使用时间
- 空闲清理策略：当用户无剩余 Skill AND 空闲天数超过阈值时清理
- 用户可通过管理接口手动清理环境
```

### 5. 用户删除账户时的处理

```
┌─────────────────────────────────────────────────────────────────────┐
│                  User Account Deletion Flow                          │
└─────────────────────────────────────────────────────────────────────┘

用户删除账户
       │
       ▼
  ┌─────────────────┐
  │ 1. 权限验证      │
  │    - 用户认证    │
  │    - 账户所有权  │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 2. 删除所有 Skill 文件                           │
  │    - 遍历用户所有 Skill                          │
  │    - 删除版本目录                                │
  │    - 删除版本记录                                │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 3. 级联清理运行时环境                            │
  │    - 删除虚拟环境目录                            │
  │    - 清空 venv_path                             │
  │    - 清空 installed_dependencies                │
  │    - 清空 venv_created_at                       │
  │    - 清空 venv_last_used_at                     │
  │    - 清空运行时锁字段                            │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 4. 删除用户记录                                  │
  │    - 删除 users 表记录                           │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐
  │ 5. 记录审计日志  │
  │    - 账户删除时间│
  │    - 环境清理详情│
  └─────────────────┘

说明：
- 账户删除是彻底清理，环境无保留意义
- 清理顺序：先 Skill 文件 → 再环境 → 最后用户记录
- 审计日志记录完整的清理过程
```

### 6. Skill 版本回滚流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Skill Version Rollback Flow                       │
└─────────────────────────────────────────────────────────────────────┘

用户回滚 Skill 到旧版本
       │
       ▼
  ┌─────────────────┐
  │ 1. 权限验证      │
  │    - 用户认证    │
  │    - Skill 所有权│
  │    - 目标版本存在│
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     已锁定     ┌─────────────────┐
  │ 2. 检查运行时锁  │─────────────▶│ 返回错误：       │
  │    runtime_locked│              │ RUNTIME_LOCKED   │
  └────────┬────────┘              └─────────────────┘
           │ 未锁定
           ▼
  ┌─────────────────┐     不存在    ┌─────────────────┐
  │ 3. 检查用户环境  │─────────────▶│ 返回错误：       │
  │    是否存在？    │              │ RUNTIME_NOT_INITIALIZED │
  └────────┬────────┘              └─────────────────┘
           │ 存在
           ▼
  ┌─────────────────┐
  │ 4. 获取目标版本  │
  │    - 解析版本号  │
  │    - 定位文件    │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 5. 依赖处理策略                                  │
  │    - 不回滚依赖                                  │
  │    - 不卸载当前依赖                              │
  │    - 不安装旧版本依赖                            │
  │    - 直接使用当前环境                            │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 6. 检查依赖兼容性（可选）                         │
  │    - 对比旧版本依赖声明与当前已安装依赖            │
  │    - 检测潜在兼容性问题                          │
  └────────┬────────────────────────────────────────┘
           │
           ├───────── 存在兼容性问题 ─────────▶ 返回警告提示
           │                                     用户可选择继续或取消
           │
           ▼ 无问题或用户确认继续
  ┌─────────────────────────────────────────────────┐
  │ 7. 更新版本指针                                  │
  │    - 设置 current_version = 目标版本            │
  │    - 更新 venv_last_used_at                     │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐
  │ 8. 返回成功响应  │
  │    - 新版本号    │
  │    - 回滚时间    │
  └─────────────────┘

说明：
- 版本回滚只切换代码版本，依赖保持不变
- 版本回滚需要检查运行时锁，避免与依赖安装操作冲突
- 当前环境的依赖可能已满足旧版本需求
- 避免不必要的依赖卸载/重装，减少操作风险
- 若旧版本依赖与当前不兼容，提供警告但不阻止回滚
```

### 7. 环境清理流程（定时/管理员触发）

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Environment Cleanup Flow                        │
└─────────────────────────────────────────────────────────────────────┘

触发条件：
  A. 定时任务检测（每日执行）
  B. 管理员手动触发

       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │ 1. 查询符合条件的用户                            │
  │    - venv_last_used_at < now - IDLE_DAYS        │
  │    - 或管理员指定的用户                          │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 2. 执行清理                                      │
  │    - 删除虚拟环境目录                            │
  │    - 清空 venv_path                             │
  │    - 清空 installed_dependencies                │
  │    - 清空 venv_created_at                       │
  │    - 清空 venv_last_used_at                     │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐
  │ 3. 记录审计日志  │
  └─────────────────┘
```

---

## 并发安全机制

### 问题场景

用户在安装依赖过程中执行其他 Skill，可能导致：
- 执行失败：venv 未完全创建时，找不到 python 解释器
- 依赖缺失：Skill 需要的包正在安装中，导入失败
- uv 锁冲突：`uv pip install` / `uv sync` 时文件锁定，执行时无法读取
- 状态不一致：`installed_dependencies` 更新滞后

### 设计方案：用户级操作锁（含超时机制）

采用用户级操作锁机制，在上传/安装依赖期间锁定运行时环境，阻止其他执行请求。
同时引入超时机制，防止用户长时间不决策导致锁无限占用。

#### 锁机制说明

| 操作 | 锁行为 | 说明 |
|------|--------|------|
| 上传开始 | 加锁 | 设置 `runtime_locked = True` |
| 安装成功 | 解锁 | 设置 `runtime_locked = False` |
| 安装失败 | 解锁 | 异常路径也要解锁 |
| 用户取消上传 | 解锁 | 冲突解决时用户取消 |
| 冲突等待超时 | 解锁 | 5分钟无响应自动取消 |
| 执行前检查 | 检锁 | 已锁定则返回错误 |

#### 锁超时配置

```yaml
# config/default.yaml
runtime:
  # 锁等待超时时间（秒）
  # 仅适用于等待用户确认的场景（依赖冲突/安全审查确认界面无响应）
  # 超过此时间自动取消上传并解锁
  #
  # 注意：此超时不适用于安装过程本身
  # 安装过程通常 10-60 秒完成，无需超时限制
  # 若安装过程异常卡住，应由运维人员手动介入或通过进程监控机制处理
  lock_wait_timeout_seconds: 300  # 5分钟
```

**超时适用场景说明**：

| 场景 | 是否受超时限制 | 说明 |
|------|---------------|------|
| 等待用户确认冲突 | ✅ 受限制 | 用户无响应 5 分钟后自动取消 |
| 等待用户确认安全审查 | ✅ 受限制 | 用户无响应 5 分钟后自动取消 |
| 正在安装依赖 | ❌ 不受限制 | 安装过程通常快速完成，不应被打断 |
| 环境正在创建 | ❌ 不受限制 | 创建过程通常快速完成 |

#### 锁字段设计

```python
# User 模型字段
runtime_locked: bool              # 是否锁定
runtime_lock_reason: str | None   # 锁定原因，用于前端提示
runtime_locked_at: datetime | None  # 锁定时间，用于超时检测和估算等待时长
```

#### 锁超时检测逻辑

```python
async def check_lock_timeout(user: User, timeout_seconds: int = 300) -> bool:
    """
    检查运行时锁是否超时

    Args:
        user: 用户对象
        timeout_seconds: 超时时间（秒），默认5分钟

    Returns:
        是否已超时

    Note:
        此超时检测主要用于清理"等待用户确认"场景的遗留锁。
        若 lock_reason 为 "Installing dependencies"，表示正在安装，
        此时不建议强制解锁（安装过程通常快速完成）。
        实际实现中可根据 lock_reason 区分处理策略。
    """
    if not user.runtime_locked or not user.runtime_locked_at:
        return False

    elapsed = (
        datetime.now(timezone.utc) - user.runtime_locked_at
    ).total_seconds()

    return elapsed > timeout_seconds


async def cleanup_expired_locks(
    user_repo: UserRepository,
    timeout_seconds: int = 300,
    skip_installing: bool = True,
) -> list[str]:
    """
    清理超时的运行时锁（定时任务调用）

    Args:
        user_repo: 用户仓库
        timeout_seconds: 超时时间（秒）
        skip_installing: 是否跳过正在安装的用户（默认 True）

    Returns:
        清理的用户ID列表

    Note:
        默认跳过正在安装依赖的用户，仅清理等待确认超时的锁。
        若 skip_installing=False，将清理所有超时的锁（慎用）。
    """
    locked_users = await user_repo.find_locked_users()

    cleaned = []
    for user in locked_users:
        # 可选：跳过正在安装的用户
        if skip_installing and user.runtime_lock_reason == "Installing dependencies":
            logger.debug(f"Skipping installing user {user.id}")
            continue

        if await check_lock_timeout(user, timeout_seconds):
            # 超时解锁
            user.runtime_locked = False
            user.runtime_lock_reason = None
            user.runtime_locked_at = None
            await user_repo.update(user)

            # 清理临时文件（如果有）
            temp_path = Path(f"/tmp/skill_upload_{user.id}")
            if temp_path.exists():
                shutil.rmtree(temp_path)

            cleaned.append(user.id)
            logger.info(f"Cleaned expired runtime lock for user {user.id}")

    return cleaned
```

#### 执行前检查逻辑

```python
async def check_runtime_lock(user: User) -> None:
    """
    执行前检查运行时锁状态

    Raises:
        RuntimeErrorLocked: 环境正在更新
    """
    if user.runtime_locked:
        # 计算建议等待时间（基于锁定时长估算）
        elapsed_seconds = (
            datetime.now(timezone.utc) - user.runtime_locked_at
        ).total_seconds()

        # 依赖安装通常 10-60 秒，建议等待 30 秒
        retry_after = max(10, min(60, 30 - elapsed_seconds))

        raise RuntimeErrorLockedError(
            reason=user.runtime_lock_reason,
            locked_at=user.runtime_locked_at,
            retry_after=int(retry_after)
        )
```

#### 前端处理建议

```
收到 RUNTIME_LOCKED 错误
       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │ 显示等待提示                                     │
  │                                                  │
  │ ⏳ 运行时环境正在更新                            │
  │                                                  │
  │ 原因：Installing dependencies                    │
  │                                                  │
  │ 请等待约 30 秒后重试，或稍后再执行此 Skill        │
  │                                                  │
  │ [自动重试（倒计时）]  [取消]                     │
  │                                                  │
  └─────────────────────────────────────────────────┘

自动重试策略：
- 首次收到错误后等待 retry_after 秒
- 最多重试 3 次
- 超过 3 次仍锁定则提示用户手动稍后重试
```

---

## API 设计

### 1. 上传接口扩展

**现有接口**：`POST /api/v1/skills/upload`

**扩展响应**（依赖冲突时）：

```json
{
  "status": "conflict",
  "message": "Dependency version conflict detected",
  "conflicts": [
    {
      "package": "requests",
      "installed_version": "2.28.0",
      "required_version": ">=2.30.0",
      "conflict_type": "version_mismatch"
    }
  ],
  "skill_uuid": "xxx-xxx-xxx",
  "pending_version": "1.2.0",
  "pending_dependencies": ["requests>=2.30.0", "new-package>=1.0.0"]
}
```

**新增接口**：`POST /api/v1/skills/upload/resolve-conflict`

用户确认解决冲突后调用：

```json
// Request
{
  "skill_uuid": "xxx-xxx-xxx",
  "version": "1.2.0",
  "action": "proceed"  // 或 "cancel"
}

// Response (action=proceed)
{
  "status": "success",
  "version": "1.2.0",
  "installed": ["requests==2.31.0", "new-package==1.0.0"],
  "uninstalled": ["requests==2.28.0"]
}

// Response (action=cancel)
{
  "status": "cancelled",
  "message": "Upload cancelled by user"
}
```

**新增接口**：`POST /api/v1/skills/upload/resolve-security`

用户确认安全审查后调用：

```json
// Request
{
  "skill_uuid": "xxx-xxx-xxx",
  "action": "proceed"  // 或 "cancel"
}

// Response (action=proceed)
{
  "status": "success",
  "message": "Security review passed, continuing upload",
  "acknowledged_risks": [
    {
      "pattern": "requests.get",
      "description": "HTTP 网络请求"
    }
  ]
}

// Response (action=cancel)
{
  "status": "cancelled",
  "message": "Upload cancelled due to security concerns"
}
```

### 2. 管理接口

**查询用户环境状态**：`GET /api/v1/admin/users/{user_id}/runtime`

```json
{
  "user_id": "xxx-xxx-xxx",
  "venv_exists": true,
  "venv_path": "/data/venvs/xxx-xxx-xxx",
  "venv_created_at": "2026-03-01T10:00:00Z",
  "venv_last_used_at": "2026-03-30T15:30:00Z",
  "installed_count": 15,
  "installed_dependencies": {
    "requests": "2.28.0",
    "playwright": "1.40.0"
  },
  "disk_usage_mb": 256,
  "skill_count": 3,
  "unused_dependencies": [
    {"name": "old-package", "version": "1.0.0", "used_by_skills": []}
  ]
}
```

**清理用户环境**：`DELETE /api/v1/admin/users/{user_id}/runtime`

```json
{
  "status": "success",
  "message": "Runtime environment cleaned",
  "disk_freed_mb": 256
}
```

**清理未使用依赖**：`POST /api/v1/admin/users/{user_id}/runtime/cleanup-dependencies`

```json
// Request
{
  "packages": ["old-package", "unused-lib"],  // 可选，不传则自动检测
  "dry_run": false  // true 时仅返回预览，不实际删除
}

// Response
{
  "status": "success",
  "message": "Unused dependencies cleaned",
  "removed_packages": [
    {"name": "old-package", "version": "1.0.0", "disk_freed_kb": 150}
  ],
  "preserved_packages": [
    {"name": "requests", "version": "2.28.0", "used_by_skills": ["skill-a", "skill-b"]}
  ],
  "total_disk_freed_kb": 150,
  "dry_run": false
}

// Response (dry_run=true)
{
  "status": "preview",
  "message": "Dry run completed, no changes made",
  "would_remove": [...],
  "would_preserve": [...],
  "dry_run": true
}
```

#### 未使用依赖检测逻辑

```python
async def detect_unused_dependencies(
    user: User,
    skill_repo: SkillRepository,
) -> list[dict]:
    """
    检测未被任何 Skill 使用的依赖

    Returns:
        未使用依赖列表 [{"name": str, "version": str, "used_by_skills": []}]
    """
    # 获取用户所有 Skill 的依赖声明
    skills = await skill_repo.list_by_user(user.id)

    # 合并所有 Skill 声明的依赖
    all_declared_packages = set()
    skill_dependencies = {}  # skill_id -> dependencies

    for skill in skills:
        skill_deps = skill.dependencies or []
        skill_dependencies[skill.id] = skill_deps
        for dep in skill_deps:
            pkg_name, _ = parse_requirement(dep)
            all_declared_packages.add(pkg_name.lower())

    # 对比已安装依赖
    installed = user.installed_dependencies or {}
    unused = []

    for pkg_name, version in installed.items():
        if pkg_name.lower() not in all_declared_packages:
            unused.append({
                "name": pkg_name,
                "version": version,
                "used_by_skills": [],  # 无 Skill 使用
            })

    return unused
```

---

## 依赖冲突处理

### 冲突检测逻辑

```python
def detect_dependency_conflicts(
    installed: dict[str, str],
    required: list[str]
) -> list[dict]:
    """
    检测依赖冲突

    Args:
        installed: 已安装依赖 {"package": "version"}
                   注意：包名建议统一使用小写格式存储
        required: 需要安装的依赖 ["package>=version", ...]

    Returns:
        冲突列表 [{"package": str, "installed_version": str,
                  "required_version": str, "conflict_type": str}]
    """
    conflicts = []

    # 构建小写化的已安装依赖映射，确保大小写不敏感匹配
    installed_lower = {k.lower(): v for k, v in installed.items()}

    for req in required:
        pkg_name, version_spec = parse_requirement(req)
        pkg_name_lower = pkg_name.lower()

        if pkg_name_lower in installed_lower:
            installed_version = installed_lower[pkg_name_lower]

            # 检查版本是否满足要求
            if not version_satisfies(installed_version, version_spec):
                conflicts.append({
                    "package": pkg_name,
                    "installed_version": installed_version,
                    "required_version": version_spec,
                    "conflict_type": "version_mismatch"
                })

    return conflicts
```

### 用户交互流程

```
前端检测到冲突响应
       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │ 显示冲突对话框                                   │
  │                                                  │
  │ ⚠️ 检测到依赖版本冲突                            │
  │                                                  │
  │ 以下包的版本与您环境中已安装的版本不兼容：        │
  │                                                  │
  │ • requests                                       │
  │   已安装: 2.28.0                                 │
  │   需要: >=2.30.0                                 │
  │                                                  │
  │ 选择操作：                                       │
  │                                                  │
  │ [允许安装]  [取消上传]                           │
  │                                                  │
  │ 提示：允许安装将卸载旧版本并安装新版本，         │
  │      可能影响您其他 skill 的运行。               │
  └─────────────────────────────────────────────────┘
```

---

## 前端交互体验设计

### 1. 依赖列表预览

用户上传 Skill ZIP 后，在安装依赖前先展示解析出的依赖列表，让用户确认后再继续。

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Skill 上传 - 依赖预览                          │
└─────────────────────────────────────────────────────────────────────┘

ZIP 文件解析完成，检测到以下依赖声明：

┌─────────────────────────────────────────────────────────────────────┐
│  将安装的依赖                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✓ requests        2.31.0        HTTP 请求库                        │
│  ✓ playwright      1.40.0        浏览器自动化                        │
│  ✓ pydantic        2.5.0         数据验证                            │
│                                                                      │
│  新依赖数量: 3                                                       │
│  预估安装时间: 约 30-60 秒                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  已安装的依赖（无需安装）                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  • numpy           1.24.0        已安装                              │
│  • pandas          2.0.0         已安装                              │
│                                                                      │
│  已有依赖数量: 2                                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

[确认并安装依赖]  [取消上传]

提示：安装完成后 Skill 即可使用，依赖将保存在您的运行时环境中。
```

#### API 支持

上传接口返回依赖预览信息：

```json
// POST /api/v1/skills/upload 返回（第一阶段：解析完成）
{
  "status": "dependency_preview",
  "skill_uuid": "xxx-xxx-xxx",
  "skill_name": "my-skill",
  "pending_version": "1.0.0",
  "dependencies": {
    "to_install": [
      {"name": "requests", "version": "2.31.0", "description": "HTTP library"},
      {"name": "playwright", "version": "1.40.0", "description": "Browser automation"}
    ],
    "already_installed": [
      {"name": "numpy", "version": "1.24.0"},
      {"name": "pandas", "version": "2.0.0"}
    ],
    "estimated_duration_seconds": 45
  },
  "require_confirmation": true
}
```

**新增接口**：`POST /api/v1/skills/upload/confirm-dependencies`

用户确认依赖后继续安装：

```json
// Request
{
  "skill_uuid": "xxx-xxx-xxx",
  "action": "proceed"  // 或 "cancel"
}

// Response (action=proceed)
{
  "status": "installing",
  "message": "Dependency installation started",
  "skill_uuid": "xxx-xxx-xxx"
}

// Response (action=cancel)
{
  "status": "cancelled",
  "message": "Upload cancelled by user"
}
```

### 2. 安装进度反馈

依赖安装过程中，前端显示实时进度，避免用户等待时焦虑。

```
┌─────────────────────────────────────────────────────────────────────┐
│                        正在安装依赖...                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ⏳ 安装进度                                                         │
│                                                                      │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  35%        │
│                                                                      │
│  正在安装: playwright-1.40.0                                         │
│  已完成: requests, pydantic                                          │
│                                                                      │
│  已安装: 2/3                                                         │
│  用时: 25 秒                                                         │
│  预估剩余: 20 秒                                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

[取消安装]

提示：取消安装将回滚所有更改，Skill 不会被上传。
```

#### 进度更新机制

**方案 A：WebSocket 实时推送**

```javascript
// 前端 WebSocket 连接
const ws = new WebSocket('/api/v1/skills/upload/xxx-xxx-xxx/progress');

ws.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  // 更新进度显示
  updateProgressBar(progress);
};

// 服务端推送格式
{
  "type": "install_progress",
  "skill_uuid": "xxx-xxx-xxx",
  "current_package": "playwright",
  "current_version": "1.40.0",
  "completed_packages": ["requests", "pydantic"],
  "total_packages": 3,
  "progress_percent": 35,
  "elapsed_seconds": 25,
  "estimated_remaining_seconds": 20
}
```

**方案 B：轮询进度接口**

```json
// GET /api/v1/skills/upload/{skill_uuid}/progress
{
  "status": "installing",
  "current_package": "playwright",
  "current_version": "1.40.0",
  "completed_packages": ["requests", "pydantic"],
  "total_packages": 3,
  "progress_percent": 35,
  "elapsed_seconds": 25,
  "estimated_remaining_seconds": 20
}

// 轮询间隔建议：每 2-3 秒
```

**推荐方案**：内部用户场景，轮询方案足够，实现简单。

### 3. 错误详情展示

安装失败时，展示详细的错误信息，帮助用户理解问题并采取行动。

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ❌ 依赖安装失败                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  失败详情                                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  包名: playwright                                                    │
│  版本: 1.40.0                                                        │
│  错误类型: DEPENDENCY_NETWORK_ERROR                                  │
│                                                                      │
│  错误信息:                                                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ERROR: Could not fetch package playwright-1.40.0            │    │
│  │ Reason: Network timeout after 30s                           │    │
│  │ Mirror: https://pypi.org/simple                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  安装状态:                                                           │
│  ✓ requests          2.31.0     安装成功                            │
│  ✓ pydantic          2.5.0      安装成功                            │
│  ❌ playwright       1.40.0     安装失败                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  建议操作                                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  • 检查网络连接是否正常                                               │
│  • 稍后重新尝试上传                                                   │
│  • 如持续失败，请联系管理员                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

[重新尝试]  [取消上传]  [查看完整日志]

提示：已成功安装的依赖 (requests, pydantic) 将被回滚卸载。
```

#### 错误类型分类

| 错误类型 | 错误码 | 说明 | 用户建议 |
|----------|--------|------|----------|
| 网络错误 | `DEPENDENCY_NETWORK_ERROR` | 无法连接 PyPI 或下载超时 | 检查网络，稍后重试 |
| 包不存在 | `PACKAGE_NOT_FOUND` | PyPI 上不存在该包或版本 | 检查包名/版本是否正确 |
| 版本冲突 | `VERSION_CONFLICT` | 与其他已安装包版本冲突 | 查看冲突详情，调整依赖 |
| 权限错误 | `PERMISSION_ERROR` | 无权限安装到环境 | 联系管理员 |
| 磁盘空间 | `DISK_SPACE_ERROR` | 环境磁盘空间不足 | 清理环境或联系管理员 |
| 编译错误 | `BUILD_ERROR` | 包需要编译但环境不支持 | 使用预编译版本或联系管理员 |

#### API 错误响应格式

```json
{
  "error": "DEPENDENCY_INSTALL_FAILED",
  "message": "Failed to install package playwright",
  "details": {
    "failed_package": {
      "name": "playwright",
      "version": "1.40.0",
      "error_type": "DEPENDENCY_NETWORK_ERROR",
      "error_message": "Could not fetch package playwright-1.40.0\nReason: Network timeout after 30s",
      "mirror": "https://pypi.org/simple"
    },
    "completed_packages": [
      {"name": "requests", "version": "2.31.0", "status": "success"},
      {"name": "pydantic", "version": "2.5.0", "status": "success"}
    ],
    "rollback_status": {
      "will_uninstall": ["requests", "pydantic"],
      "message": "Successfully installed packages will be rolled back"
    },
    "suggestions": [
      "检查网络连接是否正常",
      "稍后重新尝试上传",
      "如持续失败，请联系管理员"
    ]
  },
  "log_url": "/api/v1/skills/upload/xxx-xxx-xxx/logs"
}
```

### 4. 完整上传流程交互

整合以上交互，形成完整的上传流程体验：

```
用户选择 ZIP 文件
       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │ 1. 文件验证                                      │
  │    显示: "正在验证文件..."                        │
  │    进度条: 短暂显示                              │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 2. 脚本安全扫描                                  │
  │    显示: "正在扫描脚本安全性..."                  │
  │    结果: 无风险 / 风险提示对话框                  │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 3. 依赖解析与预览                                │
  │    显示: 依赖预览对话框                          │
  │    用户: 确认或取消                              │
  └────────┬────────────────────────────────────────┘
           │ 用户确认
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 4. 依赖冲突检测                                  │
  │    无冲突: 直接进入安装                          │
  │    有冲突: 显示冲突对话框                        │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 5. 依赖安装                                      │
  │    显示: 安装进度条                              │
  │    实时: 包名、进度、用时                        │
  └────────┬────────────────────────────────────────┘
           │
           ├───────── 安装失败 ─────────▶ 显示错误详情对话框
           │
           ▼ 安装成功
  ┌─────────────────────────────────────────────────┐
  │ 6. 创建版本                                      │
  │    显示: "正在创建版本..."                       │
  │    结果: 成功消息                                │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 7. 上传完成                                      │
  │    显示: 成功对话框                              │
  │    信息: Skill 名称、版本、依赖数量              │
  │    操作: [查看 Skill] [立即执行]                 │
  └─────────────────────────────────────────────────┘
```

### 5. 前端组件设计建议

#### 依赖预览组件 (DependencyPreviewDialog)

```typescript
interface DependencyPreviewDialogProps {
  skillUuid: string;
  skillName: string;
  pendingVersion: string;
  dependencies: {
    toInstall: PackageInfo[];
    alreadyInstalled: PackageInfo[];
  };
  estimatedDurationSeconds: number;
  onConfirm: () => void;
  onCancel: () => void;
}

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
}
```

#### 安装进度组件 (InstallProgressDialog)

```typescript
interface InstallProgressDialogProps {
  skillUuid: string;
  progress: {
    currentPackage: string;
    currentVersion: string;
    completedPackages: string[];
    totalPackages: number;
    progressPercent: number;
    elapsedSeconds: number;
    estimatedRemainingSeconds: number;
  };
  onCancel: () => void;
}

// 进度更新方式
const useInstallProgress = (skillUuid: string) => {
  // 方案 A: WebSocket
  // 方案 B: 轮询
  const pollProgress = async () => {
    const response = await fetch(`/api/v1/skills/upload/${skillUuid}/progress`);
    return response.json();
  };

  // 每 2 秒轮询一次
  useEffect(() => {
    const interval = setInterval(pollProgress, 2000);
    return () => clearInterval(interval);
  }, [skillUuid]);
};
```

#### 错误详情组件 (InstallErrorDialog)

```typescript
interface InstallErrorDialogProps {
  error: {
    errorType: string;
    failedPackage: PackageErrorInfo;
    completedPackages: PackageStatus[];
    suggestions: string[];
    logUrl: string;
  };
  onRetry: () => void;
  onCancel: () => void;
  onViewLog: () => void;
}

interface PackageErrorInfo {
  name: string;
  version: string;
  errorType: 'DEPENDENCY_NETWORK_ERROR' | 'PACKAGE_NOT_FOUND' | 'VERSION_CONFLICT' | ...;
  errorMessage: string;
  mirror?: string;
}
```

---

## 环境清理策略

### 配置项

```yaml
# config/default.yaml

runtime:
  # 虚拟环境存储路径
  venv_storage_path: "${DATA_DIR}/venvs"
  
  # 空闲超时天数（超过此天数未使用的环境将被清理）
  idle_cleanup_days: 90
  
  # 是否启用自动清理
  auto_cleanup_enabled: true
  
  # 清理任务执行时间（cron 表达式）
  cleanup_cron: "0 3 * * *"  # 每天凌晨 3 点
  
  # Python 版本（用于创建虚拟环境）
  python_version: "3.11"
```

### 清理条件

| 条件 | 触发方式 | 清理范围 | 说明 |
|------|----------|----------|------|
| 空闲超时 + 无剩余 Skill | 定时任务 | 仅环境 | `venv_last_used_at` 超过配置天数 **且** 用户无剩余 Skill |
| 空闲超时 + 有剩余 Skill | 不清理 | - | 用户有 Skill 时环境必须保留，即使长期未用 |
| 管理员触发 | 管理接口 | 仅环境 | 通过 `DELETE /api/v1/admin/users/{user_id}/runtime` 手动清理 |
| 用户删除所有 Skill | Skill 删除流程 | 仅环境（等待空闲清理） | 保留环境，`venv_last_used_at` 保持不变，等待空闲超时自动清理 |
| 用户删除账户 | 账户删除流程 | Skill + 环境 + 用户记录 | 级联清理，彻底删除所有资源 |

### 清理逻辑代码示例

```python
async def get_cleanup_candidates(
    user_repo: UserRepository,
    skill_repo: SkillRepository,
    idle_days: int,
) -> list[User]:
    """
    获取符合清理条件的用户

    条件：空闲超过阈值 AND 无剩余 Skill
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(days=idle_days)

    # 查询空闲超时的用户
    idle_users = await user_repo.find_by_last_used_before(cutoff_time)

    candidates = []
    for user in idle_users:
        # 检查是否有剩余 Skill
        skill_count = await skill_repo.count_by_user(user.id)
        if skill_count == 0:
            candidates.append(user)

    return candidates
```

---

## 错误处理

### 错误码定义

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `RUNTIME_LOCKED` | 423 | 运行时环境正在更新（安装依赖），请等待 |
| `RUNTIME_NOT_INITIALIZED` | 400 | 用户运行时环境未初始化 |
| `DEPENDENCY_CONFLICT` | 409 | 依赖版本冲突，需要用户确认 |
| `DEPENDENCY_INSTALL_FAILED` | 500 | 依赖安装失败 |
| `VENV_CREATION_FAILED` | 500 | 虚拟环境创建失败 |
| `RUNTIME_DISK_QUOTA_EXCEEDED` | 507 | 运行时磁盘配额超限 |
| `SCRIPT_SECURITY_HIGH_RISK` | 403 | 脚本包含高风险操作，禁止上传 |
| `SCRIPT_SECURITY_REVIEW` | 202 | 脚本包含中等风险操作，需要用户确认 |

#### RUNTIME_LOCKED 错误响应格式

```json
{
  "error": "RUNTIME_LOCKED",
  "message": "Runtime environment is being updated, please wait",
  "lock_reason": "Installing dependencies",
  "locked_at": "2026-03-30T15:30:00Z",
  "retry_after": 30
}
```

#### SCRIPT_SECURITY_HIGH_RISK 错误响应格式

```json
{
  "error": "SCRIPT_SECURITY_HIGH_RISK",
  "message": "Script contains high-risk patterns and cannot be uploaded",
  "risks": [
    {
      "pattern": "os.system\\s*\\(",
      "description": "执行系统命令",
      "level": "high",
      "file": "scripts/main.py",
      "positions": [23, 45]
    }
  ]
}
```

#### SCRIPT_SECURITY_REVIEW 响应格式（需要确认）

```json
{
  "status": "security_review",
  "message": "Script contains medium-risk patterns, please review",
  "risks": [
    {
      "pattern": "requests\\.get\\s*\\(",
      "description": "HTTP 网络请求",
      "level": "medium",
      "file": "scripts/helper.py",
      "positions": [8]
    }
  ],
  "skill_uuid": "xxx-xxx-xxx",
  "require_confirmation": true
}
```

### 安装失败回滚

```python
async def upload_with_rollback(
    user: User,
    skill: Skill,
    filename: str,
    content: bytes,
    metadata: dict | None = None,
    skill_repo: SkillRepository,
    user_repo: UserRepository,
) -> dict:
    """
    带回滚机制的上传流程
    """
    # 1. 加锁运行时环境
    user.runtime_locked = True
    user.runtime_lock_reason = "Installing dependencies"
    user.runtime_locked_at = datetime.now(timezone.utc)
    await user_repo.update(user)

    # 2. 备份当前状态
    backup_dependencies = dict(user.installed_dependencies or {})
    backup_venv_path = user.venv_path

    try:
        # 3. 解析 SKILL.md metadata
        script_entry = metadata.get("script_entry", "main.py") if metadata else "main.py"
        skill.script_file = script_entry

        # 4. 检查/创建虚拟环境
        if not user.venv_path:
            # 首次上传：创建环境
            venv_path = await create_virtualenv(user.id)
            user.venv_path = str(venv_path)
            user.venv_created_at = datetime.now(timezone.utc)
            # 设置 skill_storage_path（用于级联删除）
            user.skill_storage_path = str(SKILL_STORAGE_PATH / user.id)
        else:
            # 环境已存在：更新使用时间
            user.venv_last_used_at = datetime.now(timezone.utc)

        # 5. 安装依赖
        await install_dependencies(user, skill.dependencies)

        # 6. 创建版本记录
        await skill_repo.create_version(skill)

        # 7. 更新用户记录（解锁）
        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        user.installed_dependencies = await get_installed_packages(user.venv_path)
        await user_repo.update(user)

        return {"status": "success", "skill_id": skill.id}

    except DependencyInstallError as e:
        # 安装失败，回滚依赖（先回滚再解锁）
        logger.error(f"Dependency install failed: {e}")

        # 回滚依赖记录
        user.installed_dependencies = backup_dependencies

        # 尝试卸载已安装的新包（如果有）
        await _rollback_new_packages(user, e.installed_packages)

        # 最后解锁
        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        await user_repo.update(user)

        raise ValueError(f"Dependency install failed: {e}")

    except Exception as e:
        # 其他异常，确保解锁
        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        await user_repo.update(user)
        raise
```

---

## 实施计划

### Phase 1: 数据模型和基础设施（P0）

- [ ] 数据库迁移：添加 `users` 表新字段（包括运行时锁字段）
- [ ] 配置项：添加运行时相关配置
- [ ] 工具函数：虚拟环境创建、依赖解析

### Phase 2: 安全扫描机制（P0）

- [ ] 风险模式定义：HIGH/MEDIUM/LOW 级别模式列表
- [ ] 脚本扫描服务：`ScriptScanner` 类实现
- [ ] 上传流程集成：在 ZIP 解压后执行扫描
- [ ] 前端安全审查对话框：高风险拒绝、中风险确认

### Phase 3: 上传流程改造（P0）

- [ ] 修改 `SkillService.upload_zip`：集成环境创建和依赖安装
- [ ] 集成运行时锁机制：加锁/解锁逻辑
- [ ] SKILL.md metadata 解析：提取 `script_entry` 设置 `script_file` 字段
- [ ] 首次上传时设置 `skill_storage_path`：确保级联删除可用
- [ ] 环境已存在时更新 `venv_last_used_at`：避免空闲误判
- [ ] 新增冲突检测 API
- [ ] 新增冲突解决 API
- [ ] 新增依赖预览 API：返回 `dependency_preview` 状态
- [ ] 新增依赖确认 API：`POST /skills/upload/confirm-dependencies`
- [ ] 新增安装进度查询 API：`GET /skills/upload/{uuid}/progress`
- [ ] 前端依赖预览对话框组件
- [ ] 前端安装进度组件（轮询方式）
- [ ] 前端错误详情组件
- [ ] 前端冲突对话框组件

### Phase 4: 执行流程改造（P0）

- [ ] 修改 `ExecuteSkillOp`：使用用户虚拟环境
- [ ] 环境变量清理：`build_safe_environment` 函数
- [ ] 运行时锁检查：执行前检查 `runtime_locked`
- [ ] 更新使用时间戳
- [ ] 使用 `skill.script_file` 字段确定脚本入口文件

### Phase 5: 管理功能（P1）

- [ ] 管理接口：查询用户环境状态
- [ ] 管理接口：清理用户环境
- [ ] 管理接口：清理未使用依赖（含 dry_run 模式）
- [ ] 定时任务：自动清理空闲环境（含 Skill 数量检查）
- [ ] 定时任务：清理超时的运行时锁（区分等待确认和安装中状态）
- [ ] 前端：依赖管理页面（显示未使用依赖）

### Phase 6: 删除与版本管理场景（P1）

- [ ] Skill 删除流程：不卸载依赖的实现
- [ ] 用户删除所有 Skill 检测：保留 `venv_last_used_at` 不变（等待空闲清理）
- [ ] 用户账户删除流程：级联清理环境和 Skill
- [ ] Skill 版本回滚流程：依赖不回滚的实现
- [ ] 版本回滚兼容性检查：提供警告提示
- [ ] 审计日志：记录删除、清理和回滚操作

### Phase 7: 测试和文档（P1）

- [ ] 单元测试：虚拟环境管理
- [ ] 单元测试：依赖冲突检测
- [ ] 单元测试：脚本安全扫描
- [ ] 单元测试：Skill 删除流程
- [ ] 单元测试：账户删除级联清理
- [ ] 单元测试：Skill 版本回滚
- [ ] 集成测试：完整上传执行流程
- [ ] 集成测试：完整删除清理流程
- [ ] 集成测试：版本回滚流程
- [ ] 用户文档：依赖管理指南
- [ ] 用户文档：安全审查说明
- [ ] 用户文档：Skill 删除与环境清理说明
- [ ] 用户文档：版本回滚与依赖处理说明

---

## 安全考虑

### 1. 安全隔离层级选择（ADR-001）

#### 背景

Skill 脚本需要在服务端执行，需要选择合适的隔离层级以平衡安全性和实现复杂度。

#### 选项分析

| 方案 | 安全性 | 实现复杂度 | 性能开销 |
|------|--------|-----------|----------|
| subprocess + venv（当前） | 弱 | 低 | 无 |
| subprocess + 环境清理 | 中 | 低 | 无 |
| Docker 容器 | 强 | 中 | 中 |
| Docker + 网络隔离 | 很强 | 中高 | 中高 |

#### 决策

选择 **subprocess + 环境变量清理 + 脚本扫描** 方案。

#### 理由

- **用户信任模型**：系统面向内部员工/可信用户，恶意攻击概率低
- **实现成本**：无需引入容器基础设施，运维复杂度低
- **性能优先**：无容器启动开销，执行响应快
- **风险可控**：通过环境清理和脚本扫描，可缓解主要风险

#### 已知风险与接受

| 风险 | 缓解措施 | 残余风险 | 接受理由 |
|------|----------|----------|----------|
| 文件系统越界 | 脚本扫描 + 权限审计 | 中 | 内部用户可信，审计可追溯 |
| 环境变量泄露 | 环境变量清理 | 低 | 已缓解 |
| 网络无限制 | 脚本扫描敏感域名 | 中 | 内网服务有独立认证 |
| 依赖注入 | 仅允许 PyPI 官方源 | 低 | 已缓解 |

### 2. 环境变量清理

执行 Skill 时清理环境变量，仅保留必要变量，防止敏感信息泄露。

#### 清理策略

```python
# backend/services/skill_executor.py

import os
import platform

def build_safe_environment(
    user: User,
    skill_path: Path,
    venv_path: Path,
    params: dict,
) -> tuple[dict[str, str], Path]:
    """
    构建安全的执行环境变量

    清理所有继承的环境变量，仅保留必要变量

    注意：此函数创建临时目录，执行完成后应由调用方清理。
    使用唯一标识确保每次执行有独立的临时空间，避免并发冲突。

    Returns:
        tuple[dict[str, str], Path]: (环境变量字典, 临时目录路径)
        - 环境变量字典: 包含 PATH、SKILL_PARAMS、PYTHONPATH 等清理后的环境变量
        - 临时目录路径: 执行期间使用的临时工作目录，调用方需负责清理
    """
    import uuid

    # 获取 venv 的 bin 目录（根据平台判断）
    if platform.system() == "Windows":
        venv_bin = venv_path / "Scripts"
    else:
        venv_bin = venv_path / "bin"

    # 创建临时工作目录（使用唯一标识避免并发冲突）
    # 使用 tempfile.gettempdir() 确保跨平台兼容
    # Windows: %TEMP% 或 %TMP% (如 C:\Users\xxx\AppData\Local\Temp)
    # Linux/Mac: /tmp
    import tempfile
    temp_dir = Path(tempfile.gettempdir()) / f"skill_{user.id}_{uuid.uuid4().hex[:8]}"

    # 创建临时目录
    temp_dir.mkdir(parents=True, exist_ok=True)

    # 基础环境变量字典
    safe_env = {
        # PATH: 仅用户 venv 的 bin 目录
        # 注意：此设计限制脚本无法调用系统工具（如 git, curl, ffmpeg 等）
        # 如需使用系统工具，可通过以下方式解决：
        #   1. 在 Skill 中打包所需工具（推荐）
        #   2. 申请特殊权限（管理员配置宽松模式）
        #   3. 使用 Skill 自带的 subprocess 调用（需通过安全扫描）
        "PATH": str(venv_bin),

        # Skill 参数
        "SKILL_PARAMS": json.dumps(params),

        # Python 路径
        "PYTHONPATH": str(skill_path),
        "PYTHONIOENCODING": "utf-8",

        # 临时目录隔离
        "HOME": str(temp_dir),
        "TMPDIR": str(temp_dir),
        "TEMP": str(temp_dir),
        "TMP": str(temp_dir),

        # 基础环境
        "LANG": "en_US.UTF-8",
        "LC_ALL": "en_US.UTF-8",
    }

    # Windows 平台必需的系统变量
    # SystemRoot: Python subprocess 和系统 API 调用需要此变量
    # Windows DLL 加载、路径解析等功能依赖 SystemRoot
    if platform.system() == "Windows":
        system_root = os.environ.get("SystemRoot", "C:\\Windows")
        safe_env["SystemRoot"] = system_root
        # Windows 特定的临时目录变量已在上方设置（TEMP/TMP）

    # 不继承任何服务器敏感环境变量
    # 特别是：DATABASE_URL、SECRET_KEY、API_KEY 等

    return safe_env, temp_dir
```

#### PATH 限制说明

执行环境中的 PATH 仅包含用户虚拟环境的 bin 目录，**不包括系统 PATH**。这意味着：

| 限制 | 影响 | 解决方案 |
|------|------|---------|
| 无法调用 `git` | 不能执行 git 命令 | 使用 Python 库如 `pygit2` 或打包 git |
| 无法调用 `curl/wget` | 不能下载外部文件 | 使用 Python 库如 `requests` |
| 无法调用 `ffmpeg` | 不能处理视频/音频 | 打包 ffmpeg 二进制到 Skill 目录 |
| 无法调用系统命令 | 不能执行 `ls`, `cat` 等 | 使用 Python 标准库替代 |

**替代方案（需要管理员配置）**：

```yaml
# config/default.yaml
runtime:
  # PATH 模式：strict（仅 venv）或 relaxed（包含系统 PATH）
  # relaxed 模式会继承服务器 PATH，安全性降低，仅用于特殊场景
  path_mode: "strict"
```

**relaxed 模式的 PATH 构建**：

```python
def build_relaxed_environment(venv_bin: Path, system_path: str) -> dict[str, str]:
    """宽松模式：venv 优先，但不排除系统 PATH"""
    return {
        "PATH": f"{venv_bin}:{system_path}",  # venv 优先
        # ... 其他环境变量
    }
```

#### 执行时应用

```python
import shutil

async def execute_skill(user: User, skill: Skill, params: dict):
    # 获取路径
    venv_path = Path(user.venv_path)
    skill_path = Path(skill.version_path)
    python_path = get_python_path(venv_path)

    # 获取脚本入口文件（字段已在 Skill 模型中定义）
    script_file = skill.script_file

    # 构建安全环境变量（返回元组：环境变量字典, 临时目录路径）
    safe_env, temp_dir = build_safe_environment(user, skill_path, venv_path, params)

    try:
        # 执行脚本
        proc = await asyncio.create_subprocess_exec(
            str(python_path),
            str(skill_path / "scripts" / script_file),
            env=safe_env,  # 使用清理后的环境
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await proc.communicate()
        # ... 处理结果
    finally:
        # 清理临时目录
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
```

### 3. 脚本安全扫描

上传 Skill 时扫描脚本内容，检测潜在风险模式。

#### 风险模式定义

```python
# backend/services/script_scanner.py

from dataclasses import dataclass
from enum import Enum
import re

class RiskLevel(Enum):
    LOW = "low"       # 提示但允许
    MEDIUM = "medium" # 需要确认
    HIGH = "high"     # 拒绝上传

@dataclass
class RiskPattern:
    pattern: str
    description: str
    level: RiskLevel

# 风险模式列表
RISK_PATTERNS: list[RiskPattern] = [
    # HIGH: 拒绝上传
    RiskPattern(r"os\.system\s*\(", "执行系统命令", RiskLevel.HIGH),
    RiskPattern(r"subprocess\.(call|run|Popen)\s*\([^)]*shell\s*=\s*True", "Shell 命令执行", RiskLevel.HIGH),
    RiskPattern(r"eval\s*\(", "动态代码执行", RiskLevel.HIGH),
    RiskPattern(r"exec\s*\(", "动态代码执行", RiskLevel.HIGH),
    RiskPattern(r"__import__\s*\(", "动态模块加载", RiskLevel.HIGH),
    RiskPattern(r"compile\s*\(", "动态代码编译", RiskLevel.HIGH),

    # HIGH: 敏感文件访问
    RiskPattern(r"open\s*\(\s*[\'\"]\/etc\/", "读取系统配置文件", RiskLevel.HIGH),
    RiskPattern(r"open\s*\(\s*[\'\"]\/var\/log\/", "读取系统日志", RiskLevel.HIGH),
    RiskPattern(r"open\s*\(\s*[\'\"]\/app\/config\/", "读取应用配置", RiskLevel.HIGH),
    # 注意：此正则检测访问非当前用户的 Skill 目录
    RiskPattern(r"os\.path\.join\s*\([^)]*['\"]\/data\/skills['\"]\s*,\s*[^f]", "访问其他用户 Skill 目录", RiskLevel.HIGH),
    RiskPattern(r"\/proc\/", "读取进程信息", RiskLevel.HIGH),

    # MEDIUM: 需要确认
    RiskPattern(r"subprocess\.(call|run|Popen)\s*\(", "子进程调用", RiskLevel.MEDIUM),
    RiskPattern(r"socket\.", "网络 Socket 操作", RiskLevel.MEDIUM),
    RiskPattern(r"requests\.(get|post|put|delete)\s*\([^)]*https?://", "HTTP 网络请求", RiskLevel.MEDIUM),
    RiskPattern(r"ftplib|smtplib|telnetlib", "网络协议库使用", RiskLevel.MEDIUM),

    # LOW: 提示
    RiskPattern(r"pickle\.loads", "Pickle 反序列化风险", RiskLevel.LOW),
    RiskPattern(r"marshal\.loads", "Marshal 反序列化风险", RiskLevel.LOW),
]
```

#### 扫描局限性说明

上述正则表达式扫描存在以下已知局限性：

| 局限性 | 说明 | 影响 | 缓解措施 |
|--------|------|------|----------|
| 变量传递无法检测 | 如 `url = "https://evil.com"; requests.get(url)` | URL 通过变量传递时无法被正则捕获 | 属于残余风险，接受 |
| 字典参数无法检测 | 如 `subprocess.run(**{"shell": True})` | shell=True 通过字典解包传递时无法捕获 | 属于残余风险，接受 |
| 动态路径无法检测 | 如 `os.listdir(base_path + "/proc")` | 路径通过拼接/变量传递时无法捕获 | 属于残余风险，接受 |
| 混淆代码无法检测 | 如 `eval("os.system")` 通过字符串拼接 | 动态构造的调用无法捕获 | 属于残余风险，接受 |

**设计决策**：正则扫描作为第一道防线，能捕获大部分明显风险。残余风险通过以下方式接受：
- 用户信任模型：内部可信用户，恶意攻击概率低
- 审计追溯：所有执行记录审计日志，可追溯异常行为
- 运行时隔离：即使绕过扫描，环境变量清理和 PATH 限制提供第二层防护

#### 扫描实现

```python
def scan_script_content(content: str) -> list[dict]:
    """
    扫描脚本内容，检测风险模式

    Args:
        content: 脚本文件内容

    Returns:
        检测到的风险列表
    """
    risks = []

    for risk_pattern in RISK_PATTERNS:
        matches = re.findall(risk_pattern.pattern, content)
        if matches:
            risks.append({
                "pattern": risk_pattern.pattern,
                "description": risk_pattern.description,
                "level": risk_pattern.level.value,
                "count": len(matches),
                "positions": [
                    m.start() for m in re.finditer(risk_pattern.pattern, content)
                ],
            })

    return risks


def validate_script_security(content: str) -> tuple[bool, list[dict]]:
    """
    验证脚本安全性

    Returns:
        (是否通过, 风险列表)
    """
    risks = scan_script_content(content)

    # HIGH 级别风险：拒绝上传
    high_risks = [r for r in risks if r["level"] == "high"]

    if high_risks:
        return False, risks

    # MEDIUM 级别风险：需要用户确认
    # LOW 级别风险：仅提示
    return True, risks
```

#### 上传流程集成

```python
async def upload_skill_zip(user: User, content: bytes, metadata: dict):
    # ... 解压 ZIP 文件 ...

    # 扫描所有脚本文件
    scripts_dir = temp_dir / "scripts"
    all_risks = []

    for script_file in scripts_dir.glob("**/*.py"):
        content = script_file.read_text()
        is_safe, risks = validate_script_security(content)

        if not is_safe:
            # 拒绝上传
            raise ScriptSecurityError(
                message="Script contains high-risk patterns",
                risks=risks,
                file=str(script_file.relative_to(scripts_dir)),
            )

        all_risks.extend(risks)

    # MEDIUM 级别风险：返回给前端确认
    medium_risks = [r for r in all_risks if r["level"] == "medium"]
    if medium_risks:
        # 返回需要确认的风险
        return {
            "status": "security_review",
            "risks": all_risks,
            "require_confirmation": True,
        }

    # LOW 级别风险：仅记录日志，继续上传
    if all_risks:
        logger.info(f"Script has low-risk patterns: {all_risks}")

    # 继续正常上传流程 ...
```

#### 前端交互

```
检测到 MEDIUM 级别风险
       │
       ▼
┌─────────────────────────────────────────────────┐
│ 安全审查提示                                     │
│                                                  │
│ ⚠️ 检测到以下潜在风险操作：                       │
│                                                  │
│ • subprocess.run() - 子进程调用                  │
│   文件: scripts/main.py (第 15 行)               │
│                                                  │
│ • requests.get() - HTTP 网络请求                 │
│   文件: scripts/helper.py (第 8 行)              │
│                                                  │
│ 这些操作可能涉及系统资源或外部网络，               │
│ 请确认脚本用途后决定是否继续上传。                │
│                                                  │
│ [了解风险并继续上传]  [取消上传]                  │
│                                                  │
└─────────────────────────────────────────────────┘

检测到 HIGH 级别风险
       │
       ▼
┌─────────────────────────────────────────────────┐
│ 安全审查拒绝                                     │
│                                                  │
│ ❌ 检测到高风险操作，禁止上传：                    │
│                                                  │
│ • os.system() - 执行系统命令                     │
│   文件: scripts/main.py (第 23 行)               │
│                                                  │
│ • eval() - 动态代码执行                          │
│   文件: scripts/main.py (第 45 行)               │
│                                                  │
│ 这些操作存在安全风险，不允许上传。                 │
│ 如需执行此类操作，请联系管理员申请特殊权限。       │
│                                                  │
│ [返回修改]                                       │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 4. 资源隔离

- 每个用户的虚拟环境完全独立
- 执行时使用 `subprocess` 隔离进程
- 配置资源配额限制

### 5. 依赖安全

- 仅允许安装 PyPI 官方源的包
- 可配置私有镜像源
- 记录所有安装操作审计日志

### 6. 权限控制

- 只有 skill 所有者可以触发环境创建
- 管理员可以查看和清理任意用户环境
- 环境操作记录审计日志

---

## 监控指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| `venv_total_count` | 虚拟环境总数 | - |
| `venv_disk_usage_bytes` | 虚拟环境磁盘占用 | > 80% 容量 |
| `venv_creation_duration_seconds` | 环境创建耗时 | P95 > 30s |
| `dependency_install_duration_seconds` | 依赖安装耗时 | P95 > 60s |
| `dependency_install_failure_rate` | 依赖安装失败率 | > 5% |
| `dependency_conflict_rate` | 依赖冲突率 | - |
| `runtime_lock_duration_seconds` | 运行时锁持续时间 | P95 > 120s |
| `runtime_lock_wait_count` | 因锁等待的执行请求数 | - |
| `runtime_lock_timeout_count` | 锁超时自动取消次数 | > 10/天 |
| `script_scan_high_risk_count` | 高风险脚本检测次数 | > 0 时审计 |
| `script_scan_medium_risk_count` | 中风险脚本检测次数 | - |
| `script_scan_rejection_rate` | 因安全风险拒绝上传率 | > 1% |
| `skill_delete_count` | Skill 删除次数 | - |
| `skill_delete_all_users_count` | 删除所有 Skill 的用户数 | - |
| `user_account_delete_count` | 用户账户删除次数 | > 0 时审计 |
| `cascade_cleanup_duration_seconds` | 级联清理耗时 | P95 > 30s |
| `skill_rollback_count` | Skill 版本回滚次数 | - |
| `rollback_compatibility_warning_rate` | 回滚时依赖兼容性警告率 | - |
| `unused_dependency_count` | 未被 Skill 使用但已安装的依赖数 | - |
| `unused_dependency_cleanup_count` | 手动清理未使用依赖次数 | - |
| `unused_dependency_disk_freed_kb` | 清理未使用依赖释放的磁盘空间 | - |

---

## 附录

### A. 依赖解析工具函数

```python
import re
from packaging import version, requirements


def parse_requirement(req_str: str) -> tuple[str, str]:
    """
    解析依赖字符串
    
    Args:
        req_str: 如 "requests>=2.28.0" 或 "numpy"
    
    Returns:
        (package_name, version_spec)
    """
    req_str = req_str.strip()
    
    # 匹配包名和版本规范
    # PyPI 包名允许字母、数字、下划线、连字符和点号
    match = re.match(r'^([a-zA-Z0-9_.-]+)\s*(.*)$', req_str)
    if not match:
        raise ValueError(f"Invalid requirement: {req_str}")
    
    pkg_name = match.group(1).lower()
    version_spec = match.group(2).strip()
    
    return pkg_name, version_spec


def version_satisfies(installed: str, spec: str) -> bool:
    """
    检查已安装版本是否满足版本规范
    
    Args:
        installed: 已安装版本，如 "2.28.0"
        spec: 版本规范，如 ">=2.30.0" 或 ""
    
    Returns:
        是否满足
    """
    if not spec:
        return True
    
    try:
        installed_ver = version.parse(installed)
        req = requirements.Requirement(f"package{spec}")
        return installed_ver in req.specifier
    except Exception:
        return True  # 解析失败时默认通过
```

### B. 虚拟环境管理工具函数

```python
import asyncio
import platform
import shutil
from pathlib import Path


async def create_virtualenv(
    venv_path: Path,
    python_version: str = "3.11"
) -> bool:
    """
    创建虚拟环境

    Args:
        venv_path: 虚拟环境路径
        python_version: Python 版本

    Returns:
        是否成功
    """
    if venv_path.exists():
        shutil.rmtree(venv_path)

    venv_path.parent.mkdir(parents=True, exist_ok=True)

    proc = await asyncio.create_subprocess_exec(
        "python", "-m", "venv", str(venv_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        logger.error(f"Failed to create venv: {stderr.decode()}")
        return False

    return True


async def get_pip_path(venv_path: Path) -> Path:
    """
    获取虚拟环境中的 pip 路径
    """
    if platform.system() == "Windows":
        return venv_path / "Scripts" / "pip.exe"
    else:
        # Linux/Mac
        return venv_path / "bin" / "pip"


async def get_python_path(venv_path: Path) -> Path:
    """
    获取虚拟环境中的 Python 路径
    """
    if platform.system() == "Windows":
        return venv_path / "Scripts" / "python.exe"
    else:
        # Linux/Mac
        return venv_path / "bin" / "python"
```

### C. Skill 删除与账户级联清理

```python
import shutil
from pathlib import Path
from datetime import datetime, timezone


async def delete_skill(
    user: User,
    skill: Skill,
    skill_repo: SkillRepository,
) -> dict:
    """
    删除单个 Skill

    注意：不卸载依赖，保持环境不变
    """
    # 1. 删除 Skill 文件
    skill_path = Path(skill.storage_path)
    if skill_path.exists():
        shutil.rmtree(skill_path)

    # 2. 删除版本记录
    await skill_repo.delete_versions(skill.id)

    # 3. 删除 Skill 记录
    await skill_repo.delete(skill.id)

    # 4. 依赖不卸载，环境保持不变
    # 其他 Skill 可能使用相同依赖

    return {
        "status": "success",
        "skill_id": skill.id,
        "dependencies_preserved": True,
    }


async def on_last_skill_deleted(
    user: User,
    user_repo: UserRepository,
) -> dict:
    """
    用户删除最后一个 Skill 时的处理

    环境保留，venv_last_used_at 保持不变（反映最后一次实际使用时间）
    空闲清理策略：当用户无剩余 Skill AND 空闲天数超过阈值时清理
    """
    # venv_last_used_at 保持不变，不更新为当前时间
    # 因为用户删除 Skill 并非"使用"环境，而是不再需要环境
    # 空闲清理策略会检查：无剩余 Skill + 空闲超时 = 清理

    return {
        "status": "success",
        "message": "Environment preserved for potential future use",
        "cleanup_policy": "Will be cleaned when idle days exceed threshold AND user has no remaining Skills",
        "venv_last_used_at": user.venv_last_used_at.isoformat() if user.venv_last_used_at else None,
    }


async def delete_user_account(
    user: User,
    skill_repo: SkillRepository,
    user_repo: UserRepository,
    audit_logger: AuditLogger,
) -> dict:
    """
    删除用户账户（级联清理）

    清理顺序：Skill 文件 → 环境 → 用户记录
    """
    start_time = datetime.now(timezone.utc)

    # 1. 删除所有 Skill 文件
    skills = await skill_repo.list_by_user(user.id)
    skill_storage_path = Path(user.skill_storage_path)
    if skill_storage_path.exists():
        shutil.rmtree(skill_storage_path)

    # 删除 Skill 记录
    for skill in skills:
        await skill_repo.delete_versions(skill.id)
        await skill_repo.delete(skill.id)

    # 2. 级联清理运行时环境
    venv_path = Path(user.venv_path) if user.venv_path else None
    disk_freed_mb = 0

    if venv_path and venv_path.exists():
        # 计算磁盘空间
        disk_freed_mb = sum(
            f.stat().st_size for f in venv_path.rglob("*") if f.is_file()
        ) / (1024 * 1024)

        # 删除虚拟环境目录
        shutil.rmtree(venv_path)

    # 3. 删除用户记录
    await user_repo.delete(user.id)

    # 4. 记录审计日志
    duration_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
    audit_logger.log_account_deletion(
        user_id=user.id,
        skills_deleted=len(skills),
        disk_freed_mb=disk_freed_mb,
        duration_ms=duration_ms,
    )

    return {
        "status": "success",
        "user_id": user.id,
        "skills_deleted": len(skills),
        "disk_freed_mb": round(disk_freed_mb, 2),
        "duration_ms": round(duration_ms, 2),
    }
```

### D. Skill 版本回滚

```python
from datetime import datetime, timezone
from pathlib import Path


async def rollback_skill_version(
    user: User,
    skill: Skill,
    target_version: str,
    skill_repo: SkillRepository,
    user_repo: UserRepository,
) -> dict:
    """
    回滚 Skill 到指定版本

    注意：依赖不回滚，使用当前环境
    """
    # 1. 检查运行时锁状态
    if user.runtime_locked:
        raise RuntimeErrorLockedError(
            reason=user.runtime_lock_reason,
            locked_at=user.runtime_locked_at,
            retry_after=30
        )

    # 2. 检查用户环境是否存在
    if not user.venv_path:
        raise RuntimeErrorNotInitializedError(
            "User runtime environment not initialized"
        )

    # 3. 检查目标版本是否存在
    target_version_record = await skill_repo.get_version(
        skill.id, target_version
    )
    if not target_version_record:
        raise ValueError(f"Version {target_version} not found")

    # 4. 获取目标版本的依赖声明（用于兼容性检查）
    target_dependencies = target_version_record.dependencies or []

    # 5. 检查依赖兼容性（可选，提供警告）
    compatibility_warnings = check_dependency_compatibility(
        user.installed_dependencies,
        target_dependencies,
    )

    # 6. 依赖不回滚，不卸载，不安装
    # 当前环境的依赖可能满足旧版本需求
    # 即使不满足，用户可能希望先回滚代码再手动处理依赖

    # 7. 更新版本指针
    skill.current_version = target_version
    skill.updated_at = datetime.now(timezone.utc)
    await skill_repo.update(skill)

    # 8. 更新用户最后使用时间
    user.venv_last_used_at = datetime.now(timezone.utc)
    await user_repo.update(user)

    return {
        "status": "success",
        "skill_id": skill.id,
        "rolled_back_to": target_version,
        "dependencies_preserved": True,
        "compatibility_warnings": compatibility_warnings,
    }


def check_dependency_compatibility(
    installed: dict[str, str],
    required: list[str],
) -> list[dict]:
    """
    检查依赖兼容性（用于提供警告）

    与冲突检测类似，但只是警告，不阻止操作
    """
    warnings = []

    # 构建小写化的已安装依赖映射，确保大小写不敏感匹配
    installed_lower = {k.lower(): v for k, v in installed.items()}

    for req in required:
        pkg_name, version_spec = parse_requirement(req)
        pkg_name_lower = pkg_name.lower()

        if pkg_name_lower in installed_lower:
            installed_version = installed_lower[pkg_name_lower]

            if not version_satisfies(installed_version, version_spec):
                warnings.append({
                    "package": pkg_name,
                    "installed_version": installed_version,
                    "required_version": version_spec,
                    "warning_type": "version_mismatch",
                    "message": f"Installed {pkg_name}={installed_version} "
                               f"may not satisfy {version_spec}",
                })
        else:
            warnings.append({
                "package": pkg_name,
                "installed_version": None,
                "required_version": version_spec,
                "warning_type": "missing",
                "message": f"Package {pkg_name} is not installed",
            })

    return warnings
```
