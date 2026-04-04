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
| 用户取消部署（冲突/预览阶段） | 解锁 | 用户调用 `POST /deploy/cancel` 主动释放锁，`install_status` 保持 `pending` 不变 |
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

  # 版本回滚执行超时时间（秒）
  # 仅适用于版本回滚的实际执行阶段（数据库字段更新），通常在毫秒级完成
  # 此值作为异常情况（如数据库锁竞争）的兜底保护
  rollback_execution_timeout_seconds: 30  # 30秒
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
| `Deploying dependencies` | 正在部署依赖（pip install 执行中） | `install_timeout_seconds` |
| `Creating virtual environment` | 正在创建虚拟环境（venv 创建执行中） | `venv_creation_timeout_seconds` |
| `Waiting for conflict resolution` | 等待用户确认依赖冲突（无后台进程，纯等待用户操作） | `lock_wait_timeout_seconds` |
| `Waiting for dependency preview confirmation` | 等待用户确认依赖预览（无后台进程，纯等待用户操作） | `lock_wait_timeout_seconds` |
| `Restoring dependencies` | 正在恢复依赖快照（pip 恢复执行中） | `restore_timeout_seconds` |
| `Rolling back version` | 正在执行版本回滚（版本指针切换，通常在毫秒级完成） | `rollback_execution_timeout_seconds` |
| `Waiting for rollback confirmation` | 等待用户确认有兼容性风险的回滚（无后台进程，纯等待用户操作） | `session_timeout_seconds` |

> **关于版本回滚的超时拆分说明**：
>
> 版本回滚存在两种截然不同的阶段，对应不同的超时策略：
> - **实际回滚执行**（`Rolling back version`）：仅涉及数据库字段更新（切换 `current_version` 指针），耗时极短。使用 `rollback_execution_timeout_seconds`（建议值：30 秒），作为异常情况（如数据库锁竞争）的兜底保护
> - **等待用户确认**（`Waiting for rollback confirmation`）：当检测到兼容性风险时，需要用户手动确认是否继续回滚。此阶段**不持有运行时锁**（与会话 ID 机制配合），使用 `session_timeout_seconds`（5 分钟）控制会话有效期
>
> 这种拆分避免了将「毫秒级操作」和「分钟级用户交互」混用同一个超时值的问题。

> **维护提示**：新增 `runtime_lock_reason` 值时，须同步更新下方 `get_timeout_for_reason()` 函数中的 `timeout_map` 以及配置文件中的对应超时参数。

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
        "Rolling back version": settings.rollback_execution_timeout_seconds,
        "Waiting for rollback confirmation": settings.session_timeout_seconds,
    }

    if reason not in timeout_map and reason is not None:
        logger.warning(
            f"Unknown runtime_lock_reason: {reason!r}, "
            f"falling back to lock_wait_timeout_seconds"
        )

    return timeout_map.get(reason, settings.lock_wait_timeout_seconds)
```

#### 超时解锁安全性分类

> **问题背景**：系统设计了基于 `runtime_locked_at` + `runtime_lock_reason` 的超时自动解锁机制（参见 [锁机制概述](#锁机制概述)），但不同场景下超时解锁的**安全性**差异很大。某些场景下超时解锁是安全的，而另一些场景下可能导致**数据不一致**或**环境损坏**。
>
> 本节对所有 `runtime_lock_reason` 值进行安全性分类，并为不安全场景定义**进程存活检查**机制作为补充安全措施。

##### 安全性分类矩阵

| lock_reason 值 | 安全性 | 超时解锁后果 | 风险等级 | 是否需要进程存活检查 |
|----------------|--------|-------------|---------|---------------------|
| `Waiting for dependency preview confirmation` | **安全** | 用户未确认依赖预览，锁被释放，`install_status` 保持 `pending` | 🟢 低 | ❌ 不需要 |
| `Waiting for conflict resolution` | **安全** | 用户未确认冲突处理方案，锁被释放，`install_status` 保持 `pending` | 🟢 低 | ❌ 不需要 |
| `Deploying dependencies` | **⚠️ 有条件安全** | pip 安装可能正在进行中；如果安装进程已结束则安全，否则 venv 可能处于半安装状态 | 🟡 中 | ✅ 需要 |
| `Creating virtual environment` | **⚠️ 有条件安全** | venv 创建可能正在进行中；如果创建进程已结束则安全，否则 venv 目录可能不完整 | 🟡 中 | ✅ 需要 |
| `Restoring dependencies` | **⚠️ 有条件安全** | pip 恢复操作可能正在进行中；同上 | 🟡 中 | ✅ 需要 |
| `Rolling back version` | **⚠️ 有条件安全** | 版本回滚可能正在进行中 | 🟡 中 | ✅ 需要 |

##### 分类依据详解

**🟢 安全类 — 等待用户交互的场景**

`Waiting for dependency preview confirmation` 和 `Waiting for conflict resolution` 这两个值对应的是**等待用户点击按钮**的状态。在此状态下：
- 后台没有任何正在运行的进程（pip、venv 创建等）
- 唯一发生的事情是：前端展示了一个对话框，等待用户操作
- 超时解锁的后果仅仅是：用户长时间未操作 → 锁自动释放 → 下次操作时需重新触发部署流程
- **不会造成任何数据损坏或环境不一致**

因此，这两类场景的超时解锁是**无条件安全**的。

**🟡 有条件安全类 — 存在活跃后台进程的场景**

`Deploying dependencies`、`Creating virtual environment`、`Restoring dependencies`、`Rolling back version` 这四个值对应的是**有活跃后台进程正在执行 I/O 操作**的状态。在此状态下：

- pip install / venv 创建 / 依赖恢复等子进程正在运行
- 这些进程正在修改文件系统（写入 .whl 文件到 site-packages、创建 venv 目录结构等）
- 如果在进程运行期间强制超时解锁，后续请求可能在**半完成的环境**中执行脚本
- 典型后果：import 缺失模块、版本冲突、venv 目录结构损坏

**但是**，如果超时时对应的进程已经**正常结束**（无论是成功还是失败），那么超时解锁就是安全的——因为此时进程已经完成了所有 I/O 操作，只是由于某种原因未能及时更新数据库中的锁状态（例如异常未被正确捕获）。

##### 进程存活检查机制

针对「有条件安全」类场景，超时解锁前必须执行**进程存活检查**：

```python
async def is_process_still_active(lock_reason: str) -> bool:
    """
    检查给定 lock_reason 对应的后台进程是否仍在运行

    Args:
        lock_reason: 当前的 runtime_lock_reason 值

    Returns:
        True: 进程仍在运行 → 不应超时解锁（延长等待或告警）
        False: 进程已结束 → 可以安全地超时解锁
        None: 无法确定（无关联进程信息）→ 保守策略：不解锁，触发管理员告警
    """
    # 通过 BackgroundTask ID 或 PID 追踪机制判断进程状态
    # 具体实现取决于使用的任务队列/进程管理方式
    ...
```

**超时处理的完整决策流程**：

```
检测到锁已超时 (elapsed > timeout)
       │
       ▼
  判断 lock_reason 类型
       │
       ├── 🟢 安全类（Waiting for ...）
       │         │
       │         ▼
       │   直接超时解锁 ✅
       │   （无需额外检查）
       │
       └── 🟡 有条件安全类（Deploying / Creating / Restoring / Rolling back）
                 │
                 ▼
           执行进程存活检查
                 │
           ┌─────┴─────┐
           │             │
        进程仍在运行   进程已结束
           │             │
           ▼             ▼
      不解锁 ⛔     解锁 ✅
      （延长等待    （安全释放，
       或告警）      无活跃进程）
           
           │
        无法确定
           │
           ▼
      不解锁 + 告警 🔴
      （保守策略，
       需人工介入）
```

##### 实现要点

1. **进程追踪**：每个有条件安全类的加锁操作必须记录关联的进程信息（BackgroundTask ID 或 subprocess PID），以便超时检查时查询
2. **保守默认策略**：当无法确定进程状态时，选择「不解锁」而非「冒险解锁」——宁可让锁多持有一会儿，也不要冒着损坏环境的风险
3. **告警集成**：对于「无法确定」和「进程仍在运行但严重超时」的情况，应触发告警通知管理员人工排查
4. **与现有清理逻辑的关系**：本节的超时解锁是**主动式**的安全保障，而 [环境清理策略](./09-cleanup-strategy.md) 中的空闲清理是**被动式**的资源回收。两者互补但不重叠

#### 前置快速检查（可选优化）

> **调用时机**：在原子加锁之前调用。用于提前返回友好的错误信息，减少无意义的加锁尝试。
> **安全定位**：纯优化层，不参与并发安全保证。即使此函数返回 None（表示"看起来可以继续"），
> 调用方仍必须执行原子加锁 + 锁内校验。

```python
async def pre_lock_check(
    skill: Skill,
    user: User,
) -> RuntimeErrorNotReadyError | RuntimeErrorLockedError | None:
    """
    加锁前的无锁快速检查（pre-lock hint）

    用于在尝试获取运行时锁之前，提前发现明显的前置条件不满足情况，
    返回精确的错误信息以改善用户体验、减少不必要的加锁竞争。

    ⚠️ 此函数的返回值不能作为「可以安全执行」的依据！
       即使返回 None，调用方仍须：
         1. 执行原子加锁（atomic_acquire_lock）
         2. 在持有锁的状态下执行 validate_under_lock() 二次校验

    Args:
        skill: 待执行的 Skill 对象
        user: Skill 所属的用户对象

    Returns:
        - RuntimeErrorNotReadyError: 部署未完成，无需尝试加锁
        - RuntimeErrorLockedError: 运行时已被锁定，含 retry_after 等信息
        - None: 前置条件看似满足，可继续尝试加锁（但不保证安全）
    """
    # 1. 检查部署状态
    if skill.install_status != "ready":
        return RuntimeErrorNotReadyError(
            status=skill.install_status,
            message=f"Skill runtime not ready (current: {skill.install_status})"
        )

    # 2. 检查运行时锁
    if not user.runtime_locked:
        return None

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

    return RuntimeErrorLockedError(
        reason=user.runtime_lock_reason,
        locked_at=user.runtime_locked_at,
        retry_after=int(retry_after),
        suggest_admin=suggest_admin,
        lock_timeout=lock_timeout
    )
```

#### 锁内校验（必须执行）

> **调用时机**：在成功获取运行时锁之后、开始执行脚本之前调用。
> **安全定位**：防止 TOCTOU 竞态条件的最终安全门。这是唯一能保证并发安全的校验点。

```python
def validate_under_lock(skill: Skill) -> None:
    """
    在持有运行时锁的状态下，二次校验 Skill 是否可以执行

    ⚠️ 调用方必须确保在调用此函数时已经持有了该用户的运行时锁
       （runtime_locked = True），否则此函数的校验结果不具备安全性。

    为什么需要「锁内二次校验」？
    ─────────────────────────
    从「前置快速检查」通过到「原子加锁成功」之间存在时间窗口。
    在这个窗口期内，其他操作可能已经修改了 install_status：
      - 另一个请求可能触发了部署流程，将 install_status 改为 installing
      - 管理员可能重置了该 Skill 的部署状态

    如果不加锁就信任之前读取的 install_status = ready，
    就会在一个正在被修改的环境中执行脚本 → 数据不一致 / 执行失败

    Args:
        skill: 待执行的 Skill 对象（从数据库最新读取，确保是当前值）

    Raises:
        RuntimeErrorNotReadyError: 部署状态非 ready，调用方必须在解锁后抛出此异常
    """
    if skill.install_status != "ready":
        raise RuntimeErrorNotReadyError(
            status=skill.install_status,
            message=(
                f"Skill runtime not ready under lock "
                f"(current: {skill.install_status}). "
                f"The status changed between pre-lock check and lock acquisition."
            )
        )
```

#### 完整执行流程伪代码

以下是将上述两个函数组合使用的完整执行流程示例：

```python
async def execute_skill_safe(
    skill_id: str,
    user_id: str,
    skill_repo: SkillRepository,
    user_repo: UserRepository,
) -> dict:
    """
    安全执行 Skill（先加锁再检查模式）

    流程：前置快速检查(可选) → 原子加锁 → 锁内校验(必须) → 执行 → finally 解锁
    """
    skill = await skill_repo.get(skill_id)
    user = await user_repo.get(user_id)

    # ── Step 1: 可选的前置快速检查（性能/体验优化，非安全保证）──
    pre_error = await pre_lock_check(skill, user)
    if pre_error is not None:
        raise pre_error  # 提前返回友好错误，避免无意义的加锁尝试

    # ── Step 2: 原子加锁 ──
    acquired = await atomic_acquire_runtime_lock(
        user_id=user_id,
        reason="Executing skill",
        user_repo=user_repo,
    )
    if not acquired:
        raise RuntimeErrorLockedError(
            reason="Unknown",
            locked_at=None,
            retry_after=5,
            suggest_admin=False,
            lock_timeout=False,
        )

    try:
        # ── Step 3: 锁内二次校验（TOCTOU 安全门）──
        #     重新从数据库读取最新状态，确保与加锁时刻一致
        fresh_skill = await skill_repo.get(skill_id)
        validate_under_lock(fresh_skill)

        # ── Step 4~6: 构建环境 + 执行脚本 ──
        safe_env, temp_dir = build_safe_environment(user, skill.skill_dir, Path(user.venv_path), {})
        try:
            result = await run_script(safe_env, ...)
            return result
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

        # ── Step 7: 更新 veng_last_used_at（锁内更新）──
        user.venv_last_used_at = datetime.now(timezone.utc)
        await user_repo.update(user)

    except RuntimeErrorNotReadyError as e:
        # 锁内校验失败 → 必须先解锁再重新抛出异常
        await release_runtime_lock(user_id, user_repo)
        raise e

    except Exception as e:
        # 其他异常 → 解锁后重新抛出
        await release_runtime_lock(user_id, user_repo)
        raise e

    else:
        # 正常完成 → 解锁
        await release_runtime_lock(user_id, user_repo)
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
