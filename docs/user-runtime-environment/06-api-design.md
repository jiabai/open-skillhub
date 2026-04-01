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

> **接口说明**：此接口用于**解决安全审查确认**。当脚本扫描检测到 MEDIUM 级别风险时，调用此接口确认是否继续上传。
>
> **超时机制**：
> - 安全审查等待超时时间：5 分钟（`lock_wait_timeout_seconds` 配置）
> - 超过此时间未确认，系统自动取消上传并解锁
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