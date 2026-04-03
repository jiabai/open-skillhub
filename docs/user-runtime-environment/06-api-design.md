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

> **超时机制**：安全审查等待超时时间 5 分钟，超过后上传自动取消。

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
      "error_type": "NETWORK_ERROR",
      "error_message": "Network timeout after 30s"
    }
  },
  "retryable": true
}
```

#### 部署状态流转图

```
POST /api/v1/skills/{uuid}/deploy
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
  "require_confirmation": true
}
```

**确认兼容性警告并继续回滚**：`POST /api/v1/skills/{skill_uuid}/versions/rollback/confirm`

```json
// Request
{
  "target_version": "1.0.0",
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

### 4. 管理接口

#### 4.1 查询用户环境状态

**接口**：`GET /api/v1/admin/users/{user_id}/runtime`

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

**接口**：`DELETE /api/v1/admin/users/{user_id}/runtime`

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

**接口**：`POST /api/v1/admin/users/{user_id}/runtime/cleanup-dependencies`

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

**接口**：`DELETE /api/v1/runtime/dependency-snapshots/{snapshot_id}`

#### 5.4 恢复快照

**接口**：`POST /api/v1/runtime/dependency-snapshots/{snapshot_id}/restore`

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
> 兼容性检测规则：对每个 Skill 的 `dependencies` 列表逐项检查，使用 pip 版本匹配逻辑（`>=`、`==`、`<=`、`~= 等）。

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
    ]
  },
  "summary": {
    "total_checked": 2,
    "kept_ready": 1,
    "reset_to_pending": 1
  }
}
```

**错误响应**：

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `RUNTIME_LOCKED` | 423 | 运行时环境正在被其他操作占用 |
| `SNAPSHOT_NOT_FOUND` | 404 | 快照不存在 |
| `RESTORE_FAILED` | 500 | 依赖恢复失败，详见错误信息 |

---

**导航**： [← 并发安全机制](./05-concurrency.md) | [返回目录](./00-index.md) | [依赖冲突处理 →](./07-dependency-conflict.md)
