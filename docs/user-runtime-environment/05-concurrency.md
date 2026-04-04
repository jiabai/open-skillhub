---
status: draft
ai_read: true
last_updated: 2026-04-03
parent: user-runtime-environment
---

## 并发安全机制

### 问题场景

用户在部署依赖过程中执行 Skill，可能导致：
- 执行失败：venv 未完全创建时，找不到 python 解释器
- 依赖缺失：Skill 需要的包正在安装中，导入失败
- pip 锁冲突：pip install 时文件锁定，执行时无法读取
- 状态不一致：`installed_dependencies` 更新滞后

### 设计方案：用户级操作锁（含超时机制）

采用用户级操作锁机制，在**部署依赖**期间锁定运行时环境，阻止其他执行请求。
同时引入超时机制，防止用户长时间不决策导致锁无限占用。

#### 锁机制说明

| 操作 | 锁行为 | 说明 |
|------|--------|------|
| 上传 Skill | **不加锁** | 上传不涉及 venv 操作，无需加锁 |
| 用户触发部署 | 加锁 | 设置 `runtime_locked = True` |
| 部署成功 | 解锁 | 设置 `runtime_locked = False` |
| 部署失败 | 解锁 | 回滚依赖后解锁 |
| 用户取消部署（冲突/预览阶段） | 解锁 | 冲突/预览确认时用户取消 |
| 冲突等待超时 | 解锁 | 5分钟无响应自动取消 |
| 执行前检查 | 检锁 | 已锁定则返回错误 |
| 依赖恢复 | 加锁 | 恢复期间锁定 |
| 版本回滚（无兼容性问题） | 加锁 → 立即解锁 | 版本指针切换，加锁保证原子性，完成后立即解锁 |
| 版本回滚确认（有兼容性问题） | 加锁 → 立即解锁 | 用户确认后重新加锁执行回滚，完成后立即解锁 |

> **设计说明**：上传不涉及 venv 操作，无需加锁。版本回滚虽然不直接操作 pip，但涉及版本指针切换和 `install_status` 更新，加锁保证原子性。回滚等待用户确认期间**不持有运行时锁**（与会话 ID 机制配合，超时后会话失效即可），与安全审查等待模式一致。加锁在部署、版本回滚和依赖恢复阶段使用。

#### 超时配置

```yaml
# config/default.yaml
runtime:
  # 锁等待超时时间（秒）
  # 仅适用于等待用户确认的场景（依赖冲突/预览确认界面无响应）
  lock_wait_timeout_seconds: 300  # 5分钟

  # 依赖安装超时时间（秒）
  install_timeout_seconds: 300  # 5分钟

  # 虚拟环境创建超时时间（秒）
  venv_creation_timeout_seconds: 60  # 1分钟

  # 依赖恢复超时时间（秒）
  restore_timeout_seconds: 600  # 10分钟

  # 会话超时时间（秒）
  # 适用于需要用户确认的会话场景（安全审查等待、版本回滚确认），超时后会话自动失效
  session_timeout_seconds: 300  # 5分钟
```

#### 锁字段设计

```python
# User 模型字段
runtime_locked: bool              # 是否锁定
runtime_lock_reason: str | None   # 锁定原因
runtime_locked_at: datetime | None  # 锁定时间
runtime_temp_path: str | None     # 上传临时目录路径
```

#### runtime_temp_path 使用场景

上传流程中临时文件的生命周期管理：

| 阶段 | 操作 | runtime_temp_path 状态 |
|------|------|------------------------|
| 上传开始 | 创建临时目录，解压 ZIP | 设置为临时目录路径 |
| 安全审查等待 | 文件暂存，等待用户确认（最多 5 分钟） | 保持设置 |
| 用户确认安全审查 | 文件迁移到正式 skill_dir，创建 Skill 记录 | 清空（设为 None） |
| 安全审查超时 | **惰性检查**或 cron 兜底清理 | 清空 |
| 用户取消上传 | 删除临时目录 | 清空 |
| HIGH 风险拒绝 | 删除临时目录 | 清空 |

> **设计说明**：
> - 临时目录路径：`{TEMP_STORAGE_PATH}/{upload_id}/`
> - 安全审查超时：5 分钟无响应自动失效（见 `session_timeout_seconds`）
> - 清理时机：无论成功/失败/超时/取消，临时目录必须在流程结束时清理

#### 安全审查超时清理机制

安全审查等待期间**不持有运行时锁**（参见 [核心流程 - 上传步骤 3b](./04-core-flows.md)），因此锁超时机制（`lock_wait_timeout_seconds`）不适用于此场景。安全审查超时采用**惰性检查 + 每日 cron 兜底**的双重策略：

**执行者 1：惰性检查（主要路径）**

在 `/api/v1/skills/upload/resolve-security` 接口入口处，检查临时目录是否过期：

- 判断依据：临时目录的文件系统修改时间（`Path.stat().st_mtime`），安全审查等待期间临时目录无写操作，mtime 准确反映会话开始时间
- 过期阈值：`session_timeout_seconds`（默认 300 秒）
- 过期时行为：删除物理临时目录 → 清空 `runtime_temp_path` → 返回 `UPLOAD_SESSION_EXPIRED` 错误
- 无需新增 DB 字段

**执行者 2：每日 cron 兜底（边缘路径）**

在现有 `cleanup_cron` 定时任务中增加上传会话清理步骤（详见 [环境清理策略](./09-cleanup-strategy.md)，cron 基于服务器本地时间）：

- 扫描 `runtime_temp_path IS NOT NULL` 的用户记录
- 检查对应临时目录是否过期，过期则清理
- 覆盖用户放弃会话、进程重启等惰性检查无法触发的场景

#### runtime_lock_reason 值定义

| lock_reason 值 | 含义 | 超时配置 |
|----------------|------|----------|
| `Deploying dependencies` | 正在部署依赖 | `install_timeout_seconds` |
| `Creating virtual environment` | 正在创建虚拟环境 | `venv_creation_timeout_seconds` |
| `Waiting for conflict resolution` | 等待用户确认依赖冲突 | `lock_wait_timeout_seconds` |
| `Waiting for dependency preview confirmation` | 等待用户确认依赖预览 | `lock_wait_timeout_seconds` |
| `Restoring dependencies` | 正在恢复依赖快照 | `restore_timeout_seconds` |
| `Rolling back version` | 正在执行版本回滚 | `session_timeout_seconds` |

> **维护提示**：新增 `runtime_lock_reason` 值时，须同步更新下方 `get_timeout_for_reason()` 函数中的 `timeout_map`。

#### 超时映射辅助函数

```python
def get_timeout_for_reason(reason: str | None) -> int:
    """
    根据 runtime_lock_reason 返回对应的超时时间（秒）。
    未匹配时返回 lock_wait_timeout_seconds 作为兜底。

    Args:
        reason: runtime_lock_reason 字段值，None 表示未锁定

    Returns:
        对应的超时时间（秒）
    """
    from config import get_settings
    import logging

    logger = logging.getLogger(__name__)

    settings = get_settings()
    timeout_map = {
        "Deploying dependencies": settings.install_timeout_seconds,
        "Creating virtual environment": settings.venv_creation_timeout_seconds,
        "Waiting for conflict resolution": settings.lock_wait_timeout_seconds,
        "Waiting for dependency preview confirmation": settings.lock_wait_timeout_seconds,
        "Restoring dependencies": settings.restore_timeout_seconds,
        "Rolling back version": settings.session_timeout_seconds,
    }

    if reason not in timeout_map and reason is not None:
        logger.warning(
            f"Unknown runtime_lock_reason: {reason!r}, "
            f"falling back to lock_wait_timeout_seconds"
        )

    return timeout_map.get(reason, settings.lock_wait_timeout_seconds)
```

#### 执行前检查逻辑

```python
async def check_execution_ready(skill: Skill, user: User) -> None:
    """
    执行前检查 Skill 和运行时状态

    Raises:
        RuntimeErrorNotReadyError: 部署未完成
        RuntimeErrorLockedError: 运行时正在更新
    """
    # 1. 检查部署状态（新增）
    if skill.install_status != "ready":
        raise RuntimeErrorNotReadyError(
            status=skill.install_status,
            message=f"Skill runtime not ready (current: {skill.install_status})"
        )

    # 2. 检查运行时锁
    if not user.runtime_locked:
        return

    elapsed_seconds = (
        datetime.now(timezone.utc) - user.runtime_locked_at
    ).total_seconds()

    timeout_seconds = get_timeout_for_reason(user.runtime_lock_reason)

    lock_timeout = elapsed_seconds > timeout_seconds

    if lock_timeout:
        retry_after = 30
        suggest_admin = True
    elif elapsed_seconds > timeout_seconds * 0.5:
        retry_after = max(5, int(timeout_seconds - elapsed_seconds))
        suggest_admin = True
    else:
        retry_after = max(5, int(timeout_seconds * 0.1))
        suggest_admin = False

    raise RuntimeErrorLockedError(
        reason=user.runtime_lock_reason,
        locked_at=user.runtime_locked_at,
        retry_after=int(retry_after),
        suggest_admin=suggest_admin,
        lock_timeout=lock_timeout
    )
```

#### 前端处理建议

```
收到 RUNTIME_NOT_READY 错误
       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │ 显示部署提示                                     │
  │                                                  │
  │ 🔴 运行环境未部署                                │
  │                                                  │
  │ 该 Skill 尚未部署运行环境，无法执行。             │
  │                                                  │
  │ [部署运行环境]                                    │
  │                                                  │
  └─────────────────────────────────────────────────┘

收到 RUNTIME_LOCKED 错误
       │
       ├── lock_timeout = True（锁已超时）
       │         │
       │         ▼
       │   ┌─────────────────────────────────────────────────┐
       │   │ 显示锁超时提示                                   │
       │   │                                                  │
       │   │ ⚠️ 运行时锁超时                                  │
       │   │                                                  │
       │   │ 原因：Deploying dependencies                    │
       │   │                                                  │
       │   │ 系统检测到锁已超时但未释放，可能存在异常。       │
       │   │ 请联系管理员手动解锁。                          │
       │   │                                                  │
       │   │ [联系管理员]  [返回]                            │
       │   └─────────────────────────────────────────────────┘
       │
       └── lock_timeout = False（锁未超时）
                 │
                 ▼
           ┌─────────────────────────────────────────────────┐
           │ 显示等待提示                                     │
           │                                                  │
           │ ⏳ 运行时环境正在更新                            │
           │                                                  │
           │ 原因：Deploying dependencies                    │
           │                                                  │
           │ 请等待约 30 秒后重试                             │
           │                                                  │
           │ [自动重试（倒计时）]  [取消]                     │
           └─────────────────────────────────────────────────┘
```


---

**导航**： [← 核心流程](./04-core-flows.md) | [返回目录](./00-index.md) | [API 设计 →](./06-api-design.md)
