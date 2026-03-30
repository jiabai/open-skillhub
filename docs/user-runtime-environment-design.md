---
status: draft
ai_read: true
last_updated: 2026-03-30
---

# 用户级运行时环境设计文档

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
| 环境创建时机 | 首次上传 skill 时 | 按需创建，避免资源浪费 |
| 生命周期 | 长期保留 | 后续执行无需等待环境初始化 |
| 依赖安装时机 | 上传时自动安装 | 执行时无延迟，用户体验好 |
| 依赖冲突策略 | 前端交互式处理 | 用户自主决策，灵活可控 |
| 环境清理策略 | 组合策略 | 平衡资源占用和运维灵活性 |
| 安装失败处理 | 回滚上传 | 保证数据一致性 |

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
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `venv_path` | `str \| None` | 虚拟环境的绝对路径，未创建时为 `None` |
| `installed_dependencies` | `dict` | 已安装依赖清单，格式：`{"package_name": "version"}` |
| `venv_created_at` | `datetime \| None` | 虚拟环境创建时间 |
| `venv_last_used_at` | `datetime \| None` | 最后使用时间，用于空闲超时判断 |

### installed_dependencies 格式示例

```json
{
  "requests": "2.28.0",
  "playwright": "1.40.0",
  "pydantic": "2.5.0"
}
```

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
  ┌─────────────────┐
  │ 2. 解析依赖声明  │
  │    - frontmatter│
  │    - metadata   │
  │    - requirements.txt │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     否      ┌─────────────────┐
  │ 3. 检查用户环境  │───────────▶│ 4. 创建虚拟环境  │
  │    是否存在？    │             │    - venv 创建   │
  └────────┬────────┘             │    - 记录路径    │
           │ 是                    └────────┬────────┘
           │                                │
           ▼                                ▼
  ┌─────────────────────────────────────────────────┐
  │ 5. 依赖冲突检测                                  │
  │    - 对比已安装依赖与新依赖                       │
  │    - 检测版本冲突                                │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐     有冲突    ┌─────────────────┐
  │ 是否存在冲突？   │─────────────▶│ 6a. 返回冲突信息 │
  └────────┬────────┘              │    等待用户决策  │
           │ 无冲突                 └────────┬────────┘
           │                                │
           │                     ┌──────────┴──────────┐
           │                     │                     │
           │               用户选择              用户选择
           │              "允许安装"            "取消上传"
           │                     │                     │
           │                     ▼                     ▼
           │            ┌─────────────────┐   ┌─────────────────┐
           │            │ 6b. 卸载冲突包   │   │ 返回错误，流程结束│
           │            │    安装新版本    │   └─────────────────┘
           │            └────────┬────────┘
           │                     │
           ▼                     ▼
  ┌─────────────────────────────────────────────────┐
  │ 7. 安装新依赖                                    │
  │    - pip install [packages]                     │
  │    - 更新 installed_dependencies                │
  │    - 更新 venv_last_used_at                     │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐     失败     ┌─────────────────┐
  │ 8. 安装是否成功？ │────────────▶│ 9. 回滚上传      │
  └────────┬────────┘              │    - 删除临时文件│
           │ 成功                   │    - 返回错误信息│
           │                        └─────────────────┘
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 10. 创建 Skill 版本                              │
  │     - 写入版本目录                               │
  │     - 创建版本记录                               │
  │     - 返回成功响应                               │
  └─────────────────────────────────────────────────┘
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
  ┌─────────────────┐     不存在    ┌─────────────────┐
  │ 2. 检查用户环境  │─────────────▶│ 返回错误：       │
  │    是否存在？    │              │ RUNTIME_NOT_INITIALIZED │
  └────────┬────────┘              └─────────────────┘
           │ 存在
           ▼
  ┌─────────────────┐
  │ 3. 获取版本目录  │
  │    - 解析版本号  │
  │    - 定位文件    │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ 4. 更新使用时间  │
  │    venv_last_used_at │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 5. 执行 Skill                                    │
  │    - 使用用户虚拟环境的 Python                   │
  │    - 设置环境变量 SKILL_PARAMS                   │
  │    - 执行命令                                    │
  │    - 收集输出                                    │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐
  │ 6. 返回执行结果  │
  │    - status     │
  │    - output     │
  │    - execution_time_ms │
  └─────────────────┘
```

### 3. 环境清理流程

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
  "disk_usage_mb": 256
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
        required: 需要安装的依赖 ["package>=version", ...]
    
    Returns:
        冲突列表 [{"package": str, "installed_version": str, 
                  "required_version": str, "conflict_type": str}]
    """
    conflicts = []
    
    for req in required:
        pkg_name, version_spec = parse_requirement(req)
        
        if pkg_name in installed:
            installed_version = installed[pkg_name]
            
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

| 条件 | 说明 |
|------|------|
| 空闲超时 | `venv_last_used_at` 超过配置的天数 |
| 管理员触发 | 通过管理接口手动清理 |
| 用户删除 | 用户账号删除时级联清理 |

---

## 错误处理

### 错误码定义

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `RUNTIME_NOT_INITIALIZED` | 400 | 用户运行时环境未初始化 |
| `DEPENDENCY_CONFLICT` | 409 | 依赖版本冲突，需要用户确认 |
| `DEPENDENCY_INSTALL_FAILED` | 500 | 依赖安装失败 |
| `VENV_CREATION_FAILED` | 500 | 虚拟环境创建失败 |
| `RUNTIME_DISK_QUOTA_EXCEEDED` | 507 | 运行时磁盘配额超限 |

### 安装失败回滚

```python
async def upload_with_rollback(
    user: User,
    skill_id: str,
    filename: str,
    content: bytes,
    metadata: dict | None = None,
) -> dict:
    """
    带回滚机制的上传流程
    """
    # 1. 备份当前状态
    backup_dependencies = dict(user.installed_dependencies or {})
    backup_venv_path = user.venv_path
    
    try:
        # 2. 执行上传和依赖安装
        result = await _do_upload(user, skill_id, filename, content, metadata)
        return result
        
    except DependencyInstallError as e:
        # 3. 安装失败，回滚
        logger.error(f"Dependency install failed: {e}")
        
        # 回滚依赖记录
        user.installed_dependencies = backup_dependencies
        await user_repo.update(user)
        
        # 尝试卸载已安装的新包（如果有）
        await _rollback_new_packages(user, e.installed_packages)
        
        raise ValueError(f"Dependency install failed: {e}")
```

---

## 实施计划

### Phase 1: 数据模型和基础设施（P0）

- [ ] 数据库迁移：添加 `users` 表新字段
- [ ] 配置项：添加运行时相关配置
- [ ] 工具函数：虚拟环境创建、依赖解析

### Phase 2: 上传流程改造（P0）

- [ ] 修改 `SkillService.upload_zip`：集成环境创建和依赖安装
- [ ] 新增冲突检测 API
- [ ] 新增冲突解决 API
- [ ] 前端冲突对话框组件

### Phase 3: 执行流程改造（P0）

- [ ] 修改 `ExecuteSkillOp`：使用用户虚拟环境
- [ ] 更新使用时间戳

### Phase 4: 管理功能（P1）

- [ ] 管理接口：查询用户环境状态
- [ ] 管理接口：清理用户环境
- [ ] 定时任务：自动清理空闲环境

### Phase 5: 测试和文档（P1）

- [ ] 单元测试：虚拟环境管理
- [ ] 单元测试：依赖冲突检测
- [ ] 集成测试：完整上传执行流程
- [ ] 用户文档：依赖管理指南

---

## 安全考虑

### 1. 资源隔离

- 每个用户的虚拟环境完全独立
- 执行时使用 `subprocess` 隔离进程
- 配置资源配额限制

### 2. 依赖安全

- 仅允许安装 PyPI 官方源的包
- 可配置私有镜像源
- 记录所有安装操作审计日志

### 3. 权限控制

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
    match = re.match(r'^([a-zA-Z0-9_-]+)\s*(.*)$', req_str)
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
    if shutil.which("python3"):
        # Linux/Mac
        return venv_path / "bin" / "pip"
    else:
        # Windows
        return venv_path / "Scripts" / "pip.exe"


async def get_python_path(venv_path: Path) -> Path:
    """
    获取虚拟环境中的 Python 路径
    """
    if shutil.which("python3"):
        # Linux/Mac
        return venv_path / "bin" / "python"
    else:
        # Windows
        return venv_path / "Scripts" / "python.exe"
```
