---
status: draft
ai_read: true
last_updated: 2026-04-03
parent: user-runtime-environment
---

## API 设计

### 1. 上传接口（简化）

**接口**：`POST /api/v1/skills/upload`

**变更说明**：上传接口不再安装依赖，仅验证、扫描、解析元数据，秒级返回。

**响应状态**：

| 状态 | HTTP | 说明 | 后续操作 |
|------|------|------|----------|
| `success` | 200 | 上传成功，install_status=pending | 用户点击「部署运行环境」 |
| `security_review` | 409 | 检测到 MEDIUM 级别安全风险 | 调用 `/resolve-security` 确认 |

**错误状态**：

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `SCRIPT_SECURITY_HIGH_RISK` | 403 | HIGH 级别风险，禁止上传 |
| `SKILL_NOT_FOUND` | 404 | 更新的 Skill 不存在 |
| `UPLOAD_SESSION_EXPIRED` | 410 | 安全审查等待超时（`session_timeout_seconds`），会话已失效 |

**成功响应**：

```json
{
  "status": "success",
  "skill_uuid": "xxx-xxx-xxx",
  "skill_name": "my-skill",
  "version": "1.0.0",
  "install_status": "pending",
  "dependencies": ["requests>=2.30.0", "numpy>=1.24.0"],
  "message": "Skill uploaded successfully. Please deploy the runtime environment."
}
```

**安全审查响应**：

> **说明**：安全审查响应使用临时 `upload_id`（上传会话标识），而非 `skill_uuid`。用户确认安全审查后，系统才创建 Skill/Version 记录并返回真正的 `skill_uuid`。

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
  "upload_id": "upload-xxx-xxx",
  "require_confirmation": true
}
```

**安全审查确认**：`POST /api/v1/skills/upload/resolve-security`

```json
// Request
{
  "upload_id": "upload-xxx-xxx",
  "action": "proceed"
}

// Response
{
  "status": "success",
  "message": "Security review passed, upload completed",
  "skill_uuid": "xxx-xxx-xxx",
  "install_status": "pending"
}
```

> **超时机制**：安全审查等待超时时间 `session_timeout_seconds`（默认 5 分钟），超过后会话自动失效。用户再次调用确认接口时返回 `UPLOAD_SESSION_EXPIRED`（HTTP 410），需重新上传。会话在确认成功后立即失效，防止重放攻击。详见 [并发安全机制 - 安全审查超时清理](./05-concurrency.md#安全审查超时清理机制)。

**超时错误响应**：

```json
// Response - 上传会话已超时
{
  "error": "UPLOAD_SESSION_EXPIRED",
  "message": "Upload session has expired due to security review timeout, please re-upload",
  "upload_id": "upload-xxx-xxx"
}
```

### 2. 部署接口（新增）

#### 2.1 触发部署

**接口**：`POST /api/v1/skills/{skill_uuid}/deploy`

> **说明**：用户手动触发运行环境部署。后端加锁后检测冲突，有冲突返回冲突信息，无冲突返回依赖预览。

**前置条件**：
- `install_status` 为 `pending` 或 `failed`（可重试）
- 运行时环境未锁定

**响应 - 无冲突（依赖预览）**：

```json
{
  "status": "dependency_preview",
  "skill_uuid": "xxx-xxx-xxx",
  "dependencies": {
    "to_install": [
      {"name": "requests", "version": ">=2.30.0", "reason": "new_dependency"},
      {"name": "playwright", "version": "1.40.0", "reason": "new_dependency"}
    ],
    "already_installed": [
      {"name": "numpy", "version": "1.24.0"}
    ]
  },
  "estimated_duration_seconds": 45
}
```

**响应 - 有冲突**：

```json
{
  "status": "conflict",
  "skill_uuid": "xxx-xxx-xxx",
  "conflicts": [
    {
      "package": "requests",
      "installed_version": "2.28.0",
      "required_version": ">=2.30.0",
      "conflict_type": "version_mismatch"
    }
  ],
  "affected_skills": [
    {
      "skill_name": "skill-b",
      "breaks": [
        {
          "package": "requests",
          "simulated_version": "2.30.0",
          "required_version": "==2.28.0",
          "reason": "精确版本要求，升级后将不兼容"
        }
      ]
    }
  ]
}
```

**错误响应**：

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `RUNTIME_LOCKED` | 423 | 运行时环境正在被其他操作占用 |
| `DEPLOY_NOT_NEEDED` | 400 | install_status 已经是 ready |
| `SKILL_NOT_FOUND` | 404 | Skill 不存在 |

#### 2.2 确认部署（无冲突）

**接口**：`POST /api/v1/skills/{skill_uuid}/deploy/confirm`

> **说明**：用户确认依赖预览后调用，开始安装依赖。安装过程使用 **FastAPI BackgroundTasks** 在后台执行，接口立即返回 `installing` 状态。前端应通过轮询 `GET /api/v1/skills/{skill_uuid}/deploy-status` 获取实时进度。部署期间运行时锁保持锁定状态，其他操作（如执行）将被拒绝并返回 `RUNTIME_LOCKED` 错误。
>
> **任务机制选择**：
> - **FastAPI BackgroundTasks**：适合当前场景（单用户单任务、有锁保护、无需复杂调度）
> - 部署期间 `runtime_locked=True`，确保同一用户不会有并发部署任务
> - 任务失败时更新 `install_status=failed`，前端轮询可感知
> - 无需引入额外依赖（Celery/arq），降低运维复杂度

```json
// Request
{
  "action": "proceed"
}

// Response
{
  "status": "installing",
  "message": "Dependency installation started"
}
```

#### 2.3 解决冲突

**接口**：`POST /api/v1/skills/{skill_uuid}/deploy/resolve-conflict`

> **说明**：用户确认冲突解决后调用，开始安装依赖。

```json
// Request
{
  "action": "proceed"
}

// Response
{
  "status": "installing",
  "message": "Dependency installation started"
}
```

#### 2.4 查询部署状态

**接口**：`GET /api/v1/skills/{skill_uuid}/deploy-status`

> **进度数据存储机制**：
>
> `installing` 状态下的实时进度数据（`current_package`、`completed_packages`、`progress_percent`、`elapsed_seconds`、`estimated_remaining_seconds`）**不持久化到数据库**，而是存储在进程内存中（Python dict），键为 `skill_uuid`。
>
> 生命周期：
> 1. `deploy/confirm` 或 `deploy/resolve-conflict` 调用时创建进度记录
> 2. `deploy_with_rollback` 每安装完一个包后更新进度
> 3. 部署完成（成功或失败）时**立即删除**进度记录
>
> 查询逻辑：
> - 内存中存在进度记录 → 返回 `installing` 响应（含进度）
> - 内存中不存在进度记录 → 直接读取 `Skill.install_status`，返回 `ready` 或 `failed`
>
> 容错：进程重启后内存中的进度数据丢失，前端轮询会发现状态回退到 `installing` 但无进度详情，此时后端应根据 `runtime_locked=True` + `install_status=installing` 推断部署仍在进行中，返回一个不含进度细节的 `installing` 响应。部署完成后正常更新状态即可。

```json
// Response - 安装中
{
  "install_status": "installing",
  "current_package": "playwright",
  "current_version": "1.40.0",
  "completed_packages": ["requests", "pydantic"],
  "total_packages": 3,
  "progress_percent": 66,
  "elapsed_seconds": 40,
  "estimated_remaining_seconds": 15
}

// Response - 就绪
{
  "install_status": "ready",
  "installed_dependencies": {
    "requests": "2.31.0",
    "playwright": "1.40.0",
    "pydantic": "2.5.0"
  }
}

// Response - 失败
{
  "install_status": "failed",
  "error": "Failed to install package playwright",
  "details": {
    "failed_package": {
      "name": "playwright",
      "version": "1.40.0",
      "error_type": "DEPENDENCY_NETWORK_ERROR",
      "error_message": "Network timeout after 30s"
    }
  },
  "retryable": true
}

// Response - 进程重启后进度丢失（容错）
{
  "install_status": "installing",
  "message": "Installation in progress, progress details unavailable due to server restart",
  "progress_detail_available": false
}
```

#### 部署状态流转图

> **说明**：`cancelled` 不是一个持久化的 `install_status` 值。用户在依赖预览或冲突确认对话框中选择取消时，运行时锁被释放，`install_status` 保持 `pending` 不变。

```
POST /api/v1/skills/{skill_uuid}/deploy
       │
       ▼
       ├──── 无冲突 ──── dependency_preview ──▶ POST /confirm
       │                                             │
       │                                    ┌────────┴────────┐
       │                                  proceed           cancel
       │                                    │                 │
       │                                    ▼                 ▼
       │                              installing          cancelled（解锁）
       │                                    │
       ├──── 有冲突 ──── conflict ─────────▶ POST /resolve-conflict
       │                                       │
       │                              ┌────────┴────────┐
       │                            proceed           cancel
       │                              │                 │
       │                              ▼                 ▼
       │                        installing          cancelled（解锁）
       │                              │
       ▼                              │
  installing ────── 轮询进度 ──────────┤
                              │        │
                              ▼        ▼
                     ready（解锁）   failed（回滚+解锁）
                                         │
                                         ▼
                                    用户重试 deploy
```

### 3. 版本回滚接口

**回滚 Skill 版本**：`POST /api/v1/skills/{skill_uuid}/versions/rollback`

> **变更说明**：版本回滚不重置 `install_status`。如果当前是 ready，回滚后仍为 ready，但会返回兼容性警告。

**前置条件**：
- `install_status` 为 `ready`（版本回滚仅对已部署的 Skill 有效）
- 运行时环境未锁定

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
  "install_status": "ready"
}

// Response - 存在兼容性警告
{
  "status": "compatibility_warning",
  "skill_uuid": "xxx-xxx-xxx",
  "target_version": "1.0.0",
  "compatibility_issues": [...],
  "require_confirmation": true,
  "rollback_session_id": "rollback-xxx-xxx"
}
```

> **说明**：兼容性警告响应使用临时 `rollback_session_id`（回滚会话标识），而非直接使用 `target_version`。用户确认后，系统才执行回滚操作。`rollback_session_id` 在确认成功或超时后立即失效。同一 Skill 同时只允许一个有效的回滚会话，新的回滚请求会使旧会话自动失效。

**错误响应**：

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `RUNTIME_LOCKED` | 423 | 运行时环境正在被其他操作占用 |
| `SKILL_NOT_FOUND` | 404 | Skill 不存在 |
| `VERSION_NOT_FOUND` | 404 | 目标版本不存在 |
| `ROLLBACK_NOT_NEEDED` | 400 | 当前已是目标版本，无需回滚 |

#### 3.1 确认兼容性警告并继续回滚

**接口**：`POST /api/v1/skills/{skill_uuid}/versions/rollback/confirm`

**前置条件**：
- 存在有效的回滚会话（`rollback_session_id` 未超时）
- `install_status` 为 `ready`（版本回滚仅对已部署的 Skill 有效）
- 运行时环境未锁定

```json
// Request
{
  "rollback_session_id": "rollback-xxx-xxx",
  "action": "proceed"
}

// Response
{
  "status": "success",
  "skill_uuid": "xxx-xxx-xxx",
  "rolled_back_to": "1.0.0",
  "install_status": "ready"
}
```

**错误响应**：

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `ROLLBACK_SESSION_EXPIRED` | 410 | 回滚会话超时，需重新发起回滚 |
| `RUNTIME_LOCKED` | 423 | 运行时环境正在被其他操作占用 |
| `SKILL_NOT_FOUND` | 404 | Skill 不存在 |
| `VERSION_NOT_FOUND` | 404 | 目标版本不存在 |

> **超时机制**：回滚会话等待期间**不持有运行时锁**（与会话 ID 机制配合，超时后会话失效即可），与安全审查等待模式一致。超时时间由 `session_timeout_seconds`（默认 5 分钟）控制，超过后会话自动失效。用户再次调用确认接口时返回 `ROLLBACK_SESSION_EXPIRED`（HTTP 410），需重新发起回滚。会话在确认成功后也立即失效，防止重放攻击。详见 [并发安全机制 - 锁机制说明](./05-concurrency.md#锁机制说明)。

**超时错误响应**：

```json
// Response - 回滚会话已超时
{
  "error": "ROLLBACK_SESSION_EXPIRED",
  "message": "Rollback session has expired, please initiate rollback again",
  "rollback_session_id": "rollback-xxx-xxx"
}
```

#### 版本回滚状态流转图

> **说明**：`cancelled` 不是一个持久化的状态。用户在兼容性警告确认对话框中选择取消时，回滚会话失效，Skill 版本保持不变。

```
POST /api/v1/skills/{skill_uuid}/versions/rollback
       │
       ▼
  ├──── 无兼容性问题 ──── success ──▶ 回滚完成（版本切换）
  │
  ├──── 存在兼容性警告 ── compatibility_warning ──▶ POST /versions/rollback/confirm
  │                                                       │
  │                                              ┌────────┴────────┐
  │                                            proceed           cancel
  │                                              │                 │
  │                                              ▼                 ▼
  │                                        回滚完成（版本切换）   cancelled（会话失效）
  │                                                                     │
  │                                                                     ▼
  │                                                              保持当前版本不变
  │
  └──── 会话超时 ──────▶ ROLLBACK_SESSION_EXPIRED（HTTP 410）
                             │
                             ▼
                        用户重新发起 rollback
```

### 4. 管理接口

#### 4.1 查询用户环境状态

**接口**：`GET /api/v1/admin/users/{user_uuid}/runtime`

```json
{
  "user_id": "xxx-xxx-xxx",
  "venv_exists": true,
  "venv_path": "/data/venvs/xxx-xxx-xxx",
  "installed_count": 15,
  "installed_dependencies": {
    "requests": "2.28.0",
    "playwright": "1.40.0"
  },
  "disk_usage_mb": 256,
  "skill_count": 3,
  "skills_by_status": {
    "ready": 2,
    "pending": 1
  }
}
```

#### 4.2 清理用户环境

**接口**：`DELETE /api/v1/admin/users/{user_uuid}/runtime`

```json
{
  "status": "success",
  "message": "Runtime environment cleaned",
  "disk_freed_mb": 256,
  "skills_reset_to_pending": 2
}
```

> **变更说明**：清理环境后，该用户所有 `install_status=ready` 的 Skill 会被重置为 `pending`。

#### 4.3 清理未使用依赖

**接口**：`POST /api/v1/admin/users/{user_uuid}/runtime/cleanup-dependencies`

```json
// Request
{
  "packages": ["old-package"],
  "dry_run": false
}

// Response
{
  "status": "success",
  "removed_packages": [
    {"name": "old-package", "version": "1.0.0", "disk_freed_kb": 150}
  ],
  "preserved_packages": [
    {"name": "requests", "version": "2.28.0", "used_by_skills": ["skill-a", "skill-b"]}
  ],
  "skills_affected": []
}
```

### 5. 依赖恢复接口

#### 5.1 查询快照列表

**接口**：`GET /api/v1/runtime/dependency-snapshots`

```json
{
  "snapshots": [
    {
      "snapshot_id": "xxx-xxx-xxx",
      "created_at": "2026-04-02T15:00:00Z",
      "reason": "pre_deploy:skill-a:v2.0.0",
      "is_auto": true,
      "dependencies": {"requests": "2.28.0", "playwright": "1.40.0"}
    }
  ],
  "total": 2,
  "auto_count": 1,
  "manual_count": 1
}
```

#### 5.2 创建手动快照

**接口**：`POST /api/v1/runtime/dependency-snapshots`

```json
// Request
{"reason": "Before major update"}

// Response
{
  "status": "success",
  "snapshot": {
    "snapshot_id": "zzz-zzz-zzz",
    "created_at": "2026-04-02T17:00:00Z",
    "reason": "manual:Before major update",
    "is_auto": false,
    "dependencies": {"requests": "2.28.0", "playwright": "1.40.0"}
  }
}
```

#### 5.3 删除快照

**接口**：`DELETE /api/v1/runtime/dependency-snapshots/{snapshot_uuid}`

#### 5.4 恢复快照

**接口**：`POST /api/v1/runtime/dependency-snapshots/{snapshot_uuid}/restore`

> **前置条件**：
> - 运行时环境未锁定（`runtime_locked = False`）
>
> **操作流程**：
> 1. 检查运行时锁状态，已锁定则返回 `RUNTIME_LOCKED` 错误
> 2. 加锁运行时（`runtime_locked = True`）
> 3. 执行依赖恢复（pip uninstall/install）
> 4. 更新 `installed_dependencies`
> 5. 检测 Skill 依赖兼容性，更新 `install_status`
> 6. 解锁运行时（`runtime_locked = False`）
>
> **说明**：恢复快照后，系统会**智能检测**每个 `install_status=ready` 的 Skill 依赖兼容性：
> - **兼容**：依赖版本满足 Skill 要求（如 Skill 需要 `requests>=2.28.0`，恢复后为 `2.29.0`），保持 `ready` 状态
> - **不兼容**：依赖版本不满足 Skill 要求（如 Skill 需要 `requests==2.30.0`，恢复后为 `2.28.0`），自动重置为 `pending`
>
> 兼容性检测规则：对每个 Skill 的 `dependencies` 列表逐项检查，使用 pip 版本匹配逻辑（`>=`、`==`、`<=`、`~= 等`）。

**兼容性检测实现**：

> **说明**：以下函数复用 [附录 - 工具函数](./14-appendix.md) 中已定义的 `parse_requirement()` 和 `version_satisfies()`，确保依赖解析和版本匹配逻辑在项目中保持一致。

```python
# 复用附录中已定义的工具函数
# from appendix import parse_requirement, version_satisfies


def check_dependencies_compatible(
    skill_dependencies: list[str],
    installed_versions: dict[str, str],
) -> bool:
    """
    检查 Skill 的所有依赖是否在当前已安装环境中满足版本要求。
    复用 parse_requirement() 和 version_satisfies()（定义见附录 A），
    确保依赖解析和版本匹配逻辑与项目中其他模块一致。

    Args:
        skill_dependencies: Skill 的依赖列表，如 ["requests>=2.28.0", "numpy~=1.24.0"]
        installed_versions: 当前环境中已安装的包版本，如 {"requests": "2.29.0", "numpy": "1.24.3"}
            键应使用小写格式（与 User.installed_dependencies 存储规范一致）

    Returns:
        True 表示所有依赖都满足，False 表示存在不兼容的依赖
    """
    # 构建小写化的已安装依赖映射，确保大小写不敏感匹配
    installed_lower = {k.lower(): v for k, v in installed_versions.items()}

    for dep_spec in skill_dependencies:
        pkg_name, version_spec = parse_requirement(dep_spec)
        pkg_name_lower = pkg_name.lower()

        if pkg_name_lower not in installed_lower:
            return False

        if not version_satisfies(installed_lower[pkg_name_lower], version_spec):
            return False

    return True


async def check_all_skills_compatibility(
    db: AsyncSession,
    user_id: str,
    installed_versions: dict[str, str],
) -> dict:
    """
    依赖恢复后，检测用户所有 ready 状态 Skill 的依赖兼容性。
    不兼容的 Skill 自动重置为 pending。

    Returns:
        兼容性检测结果，包含 compatible_skills、incompatible_skills 列表和 summary 汇总
    """
    from sqlalchemy import select

    result = {"compatible_skills": [], "incompatible_skills": []}

    # 查询用户所有 install_status=ready 的 Skill
    stmt = select(Skill).where(
        Skill.user_id == user_id,
        Skill.install_status == "ready",
    )
    skills = (await db.execute(stmt)).scalars().all()

    for skill in skills:
        is_compatible = check_dependencies_compatible(
            skill_dependencies=skill.dependencies or [],
            installed_versions=installed_versions,
        )
        if is_compatible:
            result["compatible_skills"].append({
                "skill_name": skill.name,
                "skill_uuid": str(skill.uuid),
                "kept_ready": True,
                "reason": "所有依赖版本满足要求",
            })
        else:
            skill.install_status = "pending"
            result["incompatible_skills"].append({
                "skill_name": skill.name,
                "skill_uuid": str(skill.uuid),
                "reset_to_pending": True,
                "reason": _build_incompatibility_reason(
                    skill.dependencies or [], installed_versions
                ),
            })

    await db.commit()

    # 构建汇总信息
    result["summary"] = {
        "total_checked": len(result["compatible_skills"]) + len(result["incompatible_skills"]),
        "kept_ready": len(result["compatible_skills"]),
        "reset_to_pending": len(result["incompatible_skills"]),
    }

    return result


def _build_incompatibility_reason(
    dependencies: list[str],
    installed_versions: dict[str, str],
) -> str:
    """构建不兼容原因描述字符串，复用 parse_requirement() 和 version_satisfies()"""
    installed_lower = {k.lower(): v for k, v in installed_versions.items()}
    reasons = []

    for dep_spec in dependencies:
        pkg_name, version_spec = parse_requirement(dep_spec)
        pkg_name_lower = pkg_name.lower()

        if pkg_name_lower not in installed_lower:
            reasons.append(f"{pkg_name} 未安装")
            continue

        if version_spec and not version_satisfies(installed_lower[pkg_name_lower], version_spec):
            reasons.append(
                f"{dep_spec.strip()} 不满足，当前 {installed_lower[pkg_name_lower]}"
            )

    return "；".join(reasons) if reasons else "依赖兼容性检查失败"
```

```json
// Response
{
  "status": "success",
  "restored_dependencies": {"requests": "2.28.0", "playwright": "1.40.0"},
  "backup_snapshot_id": "zzz-zzz-zzz",
  "compatibility_check_result": {
    "compatible_skills": [
      {"skill_name": "skill-a", "skill_uuid": "xxx-xxx", "kept_ready": true, "reason": "所有依赖版本满足要求"}
    ],
    "incompatible_skills": [
      {"skill_name": "skill-b", "skill_uuid": "yyy-yyy", "reset_to_pending": true, "reason": "requests==2.30.0 不满足，当前 2.28.0"}
    ],
    "summary": {
      "total_checked": 2,
      "kept_ready": 1,
      "reset_to_pending": 1
    }
  }
}
```

**错误响应**：

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `RUNTIME_LOCKED` | 423 | 运行时环境正在被其他操作占用 |
| `SNAPSHOT_NOT_FOUND` | 404 | 快照不存在 |
| `DEPENDENCY_RESTORE_FAILED` | 500 | 依赖恢复失败，详见错误信息 |

---

**导航**： [← 并发安全机制](./05-concurrency.md) | [返回目录](./00-index.md) | [依赖冲突处理 →](./07-dependency-conflict.md)
