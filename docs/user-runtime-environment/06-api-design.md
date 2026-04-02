---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
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
  "dependencies": {
    "to_install": [
      {"name": "requests", "version": ">=2.30.0", "reason": "upgrade_required"},
      {"name": "new-package", "version": ">=1.0.0", "reason": "new_dependency"}
    ],
    "already_installed": [
      {"name": "numpy", "version": "1.24.0"}
    ]
  }
}
```

**新增接口**：`POST /api/v1/skills/upload/resolve-conflict`

> **接口说明**：此接口用于**解决依赖版本冲突**。当上传的新 Skill 依赖与环境中已安装的依赖版本不兼容时（例如：需要 requests>=2.30.0，但已安装 2.28.0），调用此接口确认是否允许升级/替换依赖。
>
> **超时机制**：
> - 冲突等待超时时间：5 分钟（`lock_wait_timeout_seconds` 配置）
> - 超过此时间未确认，系统自动取消上传并解锁
> - 前端应在超时前提示用户尽快决策
>
> 与 `/confirm-dependencies` 的区别：
> - `/confirm-dependencies`：确认依赖预览（无冲突时），决定是否安装
> - `/resolve-conflict`：解决版本冲突（有冲突时），决定是否允许升级

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

**新增接口**：`POST /api/v1/skills/upload/resolve-security`

> **接口说明**：此接口用于**解决安全审查确认**。当脚本扫描检测到 MEDIUM 级别风险时，调用此接口确认是否继续上传。
>
> **超时机制**：
> - 安全审查等待超时时间：5 分钟（`lock_wait_timeout_seconds` 配置）
> - 超过此时间未确认，系统自动取消上传
> - 注意：此时尚未加锁，无需解锁
>
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

**新增接口**：`POST /api/v1/skills/upload/confirm-dependencies`

> **接口说明**：此接口用于**确认依赖预览**。当后端解析依赖并检测无冲突后，展示依赖预览对话框给用户，用户确认后调用此接口开始安装。
>
> **超时机制**：
> - 依赖预览等待超时时间：5 分钟（`lock_wait_timeout_seconds` 配置）
> - 超过此时间未确认，系统自动取消上传并解锁
> - 前端应在超时前提示用户尽快决策
>
> 与 `/resolve-conflict` 的区别：
> - `/confirm-dependencies`：确认依赖预览（无冲突时），决定是否安装
> - `/resolve-conflict`：解决版本冲突（有冲突时），决定是否允许升级

用户确认依赖预览后调用：

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

### 1.1 上传接口响应状态汇总

上传流程中，`POST /api/v1/skills/upload` 接口可能返回以下状态：

**流程状态**（需要用户确认或等待）：

| 状态 | 说明 | 后续操作 | 对应流程步骤 |
|------|------|----------|--------------|
| `security_review` | 检测到 MEDIUM 级别安全风险（HTTP 409） | 调用 `/resolve-security` 确认继续 | 步骤 2（安全扫描），尚未加锁 |
| `conflict` | 检测到依赖版本冲突（HTTP 409） | 调用 `/resolve-conflict` 解决冲突 | 步骤 10a（冲突检测），已加锁 |
| `dependency_preview` | 无冲突，展示依赖预览（HTTP 200） | 调用 `/confirm-dependencies` 确认安装 | 步骤 10c（依赖预览），已加锁 |
| `installing` | 依赖正在安装中（HTTP 200） | 轮询 `/upload/{uuid}/progress` 查看进度 | 步骤 11（安装依赖），已加锁 |
| `success` | 上传成功，所有依赖已安装（HTTP 200） | 无需额外操作 | 步骤 16（返回成功） |
| `cancelled` | 用户取消上传（HTTP 200） | 无需额外操作 | 流程终止 |

**错误状态**（直接返回错误，流程终止）：

| 错误码 | HTTP 状态 | 说明 | 对应流程步骤 |
|--------|----------|------|--------------|
| `SCRIPT_SECURITY_HIGH_RISK` | 403 | 检测到 HIGH 级别安全风险，禁止上传 | 步骤 2（安全扫描） |
| `VENV_CREATION_FAILED` | 500 | 虚拟环境创建失败 | 步骤 6（创建虚拟环境） |
| `DEPENDENCY_INSTALL_FAILED` | 500 | 依赖安装失败（详见错误详情） | 步骤 11-12（安装依赖） |
| `RUNTIME_LOCKED` | 423 | 运行时环境被锁定（其他操作进行中） | 任意需要环境的操作 |

> **注意**：检测到 HIGH 级别安全风险时，直接返回 `SCRIPT_SECURITY_HIGH_RISK` 错误（HTTP 403），无需用户确认。

**状态流转图**：

```
POST /api/v1/skills/upload
       │
       │  步骤 1-2: ZIP验证、安全扫描（未加锁）
       ▼
       ├───────── security_review ──────────▶ POST /resolve-security
       │    (检测到 MEDIUM 级别安全风险)              │
       │                                            │ proceed: 用户确认继续
       │                                            │ cancel: 用户取消上传
       │                                            │
       │                              ┌─────────────┴─────────────┐
       │                              │                           │
       │                        proceed                       cancel
       │                              │                           │
       │                              ▼                           ▼
       │                    继续依赖检测流程              cancelled
       │                    （见下方流程）
       │
       │  步骤 3: 加锁运行时环境
       │  步骤 4: 解析依赖声明
       │  步骤 9: 依赖冲突检测
       ▼
       ├───────── conflict ─────────────────▶ POST /resolve-conflict
       │    (检测到依赖版本冲突)                        │
       │                                            │ proceed: 允许升级依赖
       │                                            │ cancel: 用户取消上传
       │                                            │
       │                              ┌─────────────┴─────────────┐
       │                              │                           │
       │                        proceed                       cancel
       │                              │                           │
       │                              ▼                           ▼
       │                    步骤 10b: 卸载冲突包        cancelled
       │                    安装新版本
       │                    │
       │                    │ (直接进入安装)
       │                    │
       │                    ▼
       ├───────── dependency_preview ─────────▶ POST /confirm-dependencies
       │    (无冲突，展示依赖预览)                      │
       │                                            │ proceed: 确认并安装
       │                                            │ cancel: 用户取消上传
       │                                            │
       │                              ┌─────────────┴─────────────┐
       │                              │                           │
       │                        proceed                       cancel
       │                              │                           │
       │                              ▼                           ▼
       │                    步骤 11: 安装依赖            cancelled
       │                              │
       ▼                              │
       └───────── installing ────────────────────▶ 轮询进度
            (依赖安装中)                             │
                                                   │ 安装完成
                                                   ▼
                                            success (或安装失败触发回滚)
```

> **流程说明**：
> - **安全审查阶段**（步骤 1-2）：ZIP 验证和脚本扫描在加锁前执行，此时用户取消无需解锁
> - **依赖安装阶段**（步骤 3-15）：加锁后执行依赖解析、冲突检测和安装，任何失败都会触发回滚并解锁
> - `security_review` 确认后进入加锁和依赖检测流程，`conflict` 和 `dependency_preview` 确认后进入安装流程

### 2. 版本回滚接口

**回滚 Skill 版本**：`POST /api/v1/skills/{skill_uuid}/versions/rollback`

```json
// Request
{
  "target_version": "1.0.0"
}

// Response - 无兼容性问题
{
  "status": "success",
  "skill_uuid": "xxx-xxx-xxx",
  "rolled_back_to": "1.0.0",
  "dependencies_preserved": true,
  "compatibility_issues": []
}

// Response - 存在兼容性警告（需用户确认）
{
  "status": "compatibility_warning",
  "skill_uuid": "xxx-xxx-xxx",
  "target_version": "1.0.0",
  "compatibility_issues": [
    {
      "package": "requests",
      "installed_version": "2.28.0",
      "required_version": ">=2.30.0",
      "warning_type": "version_mismatch",
      "message": "Installed requests=2.28.0 may not satisfy >=2.30.0"
    }
  ],
  "require_confirmation": true
}
```

**确认兼容性警告并继续回滚**：`POST /api/v1/skills/{skill_uuid}/versions/rollback/confirm`

> **接口说明**：当版本回滚检测到依赖兼容性问题时，用户确认后调用此接口继续执行回滚。

```json
// Request
{
  "target_version": "1.0.0",
  "action": "proceed"  // 或 "cancel"
}

// Response (action=proceed)
{
  "status": "success",
  "skill_uuid": "xxx-xxx-xxx",
  "rolled_back_to": "1.0.0",
  "dependencies_preserved": true,
  "compatibility_issues": [...]  // 保留警告信息供参考
}

// Response (action=cancel)
{
  "status": "cancelled",
  "message": "Rollback cancelled by user"
}
```

### 3. 管理接口

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

    ⚠️ **局限性说明**：
    此检测仅为粗略估计，仅检查包名是否在任何 Skill 的依赖声明中出现，
    不检查版本是否兼容。例如：
    - Skill A 声明依赖 requests>=2.30.0
    - 已安装 requests==2.28.0（不满足要求）
    - 当前逻辑会标记 requests 为"已使用"，但实际上该版本并不能被 Skill A 使用

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

**注意**：此检测仅作为参考，管理员在清理未使用依赖前应确认这些依赖确实不再被需要。


---

**导航**： [← 并发安全机制](./05-concurrency.md) | [返回目录](./00-index.md) | [依赖冲突处理 →](./07-dependency-conflict.md)