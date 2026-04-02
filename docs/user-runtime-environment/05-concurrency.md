---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
---

## 并发安全机制

### 问题场景

用户在安装依赖过程中执行其他 Skill，可能导致：
- 执行失败：venv 未完全创建时，找不到 python 解释器
- 依赖缺失：Skill 需要的包正在安装中，导入失败
- pip 锁冲突：pip install 时文件锁定，执行时无法读取
- 状态不一致：`installed_dependencies` 更新滞后

### 设计方案：用户级操作锁（含超时机制）

采用用户级操作锁机制，在上传/安装依赖期间锁定运行时环境，阻止其他执行请求。
同时引入超时机制，防止用户长时间不决策导致锁无限占用。

#### 锁机制说明

| 操作 | 锁行为 | 说明 |
|------|--------|------|
| 安全扫描通过后 | 加锁 | 设置 `runtime_locked = True`（步骤1-2安全扫描时尚未加锁） |
| 安装成功 | 解锁 | 设置 `runtime_locked = False` |
| 安装失败 | 解锁 | 异常路径也要解锁 |
| 用户取消上传（依赖冲突阶段） | 解锁 | 冲突解决时用户取消 |
| 用户取消上传（安全审查阶段） | 无需解锁 | 此时尚未加锁 |
| 冲突等待超时 | 解锁 | 5分钟无响应自动取消 |
| 安全审查等待超时 | 无需解锁 | 此时尚未加锁 |
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
  # 安装过程通常 10-60 秒完成，不应被打断
  # 若安装过程异常卡住，应由运维人员手动介入或通过进程监控机制处理
  #
  # 配置建议：
  # - 生产环境：300秒（5分钟）
  # - 测试环境：60秒（1分钟）
  lock_wait_timeout_seconds: 300  # 5分钟

  # 依赖安装超时时间（秒）
  # 适用于 pip install 过程，防止网络问题导致无限等待
  # 单个包的安装通常不超过 2 分钟，复杂包（如 ML 库）可能需要更长时间
  # 超过此时间将中断安装并触发回滚
  #
  # 注意：对于大型 ML 库（如 PyTorch、TensorFlow），
  # 首次安装可能超过 5 分钟。如有此类需求，建议：
  # 1. 适当调大此配置（如 600 秒）
  # 2. 或预装常用 ML 库到系统 Python 环境
  install_timeout_seconds: 300  # 5分钟

  # 虚拟环境创建超时时间（秒）
  venv_creation_timeout_seconds: 60  # 1分钟

  # 依赖恢复超时时间（秒）
  # 依赖恢复可能涉及多个包的卸载和安装，耗时较长
  # 超过此时间将中断恢复并触发回滚（使用备份快照恢复）
  restore_timeout_seconds: 600  # 10分钟
```

**安装过程卡住的处理机制**：

如果安装过程因网络问题或其他原因卡住：
1. **进程监控**：运维人员应配置进程监控，检测长时间运行的 pip 进程
2. **手动介入**：管理员可通过管理接口强制解锁用户环境
3. **自动恢复**：建议配置 systemd 或 supervisord 监控 pip 进程，超时自动终止

```python
# 示例：带超时的依赖安装（防止无限等待）
async def install_dependency_with_timeout(
    venv_path: Path,
    package: str,
    timeout_seconds: int = 300
) -> None:
    """带超时的依赖安装"""
    pip_path = await get_pip_path(venv_path)

    proc = await asyncio.create_subprocess_exec(
        str(pip_path), "install", package,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=timeout_seconds
        )
    except asyncio.TimeoutError:
        # 超时：终止进程
        proc.kill()
        await proc.wait()
        raise DependencyInstallTimeoutError(
            f"Installation of {package} timed out after {timeout_seconds}s"
        )
```

**超时适用场景说明**：

| 场景 | 是否受超时限制 | 说明 |
|------|---------------|------|
| 等待用户确认冲突 | ✅ 受限制 | 用户无响应 5 分钟后自动取消 |
| 等待用户确认安全审查 | ✅ 受限制 | 用户无响应 5 分钟后自动取消 |
| 正在安装依赖 | 有独立超时 | 使用 `install_timeout_seconds`（5分钟）而非 `lock_wait_timeout_seconds` |
| 环境正在创建 | 有独立超时 | 使用 `venv_creation_timeout_seconds`（60秒）而非 `lock_wait_timeout_seconds` |

#### 锁字段设计

```python
# User 模型字段
runtime_locked: bool              # 是否锁定
runtime_lock_reason: str | None   # 锁定原因，用于前端提示
runtime_locked_at: datetime | None  # 锁定时间，用于超时检测和估算等待时长
runtime_temp_path: str | None     # 上传临时目录路径，用于超时清理时定位临时文件
```

#### runtime_lock_reason 值定义

| lock_reason 值 | 含义 | 超时配置 |
|----------------|------|----------|
| `Installing dependencies` | 正在安装依赖 | `install_timeout_seconds` |
| `Creating virtual environment` | 正在创建虚拟环境 | `venv_creation_timeout_seconds` |
| `Parsing skill metadata` | 正在解析 Skill 元数据 | `lock_wait_timeout_seconds` |
| `Waiting for conflict resolution` | 等待用户确认依赖冲突 | `lock_wait_timeout_seconds` |
| `Waiting for dependency preview confirmation` | 等待用户确认依赖预览 | `lock_wait_timeout_seconds` |
| `Restoring dependencies` | 正在恢复依赖快照 | `restore_timeout_seconds`（独立配置，默认 600 秒） |
| 其他值 | 其他操作 | `lock_wait_timeout_seconds` |

#### 锁超时检测逻辑

```python
# 超时配置（应从配置文件读取）
LOCK_WAIT_TIMEOUT_SECONDS = 300  # 等待用户确认超时
INSTALL_TIMEOUT_SECONDS = 300    # 依赖安装超时
VENV_CREATION_TIMEOUT_SECONDS = 60  # 虚拟环境创建超时
RESTORE_TIMEOUT_SECONDS = 600    # 依赖恢复超时


def get_timeout_for_reason(lock_reason: str | None) -> int:
    """
    根据锁定原因获取对应的超时时间

    Args:
        lock_reason: 锁定原因

    Returns:
        对应的超时时间（秒）
    """
    if lock_reason == "Installing dependencies":
        return INSTALL_TIMEOUT_SECONDS
    elif lock_reason == "Creating virtual environment":
        return VENV_CREATION_TIMEOUT_SECONDS
    elif lock_reason == "Restoring dependencies":
        return RESTORE_TIMEOUT_SECONDS
    elif lock_reason in (
        "Waiting for conflict resolution",
        "Waiting for dependency preview confirmation",
    ):
        return LOCK_WAIT_TIMEOUT_SECONDS
    else:
        return LOCK_WAIT_TIMEOUT_SECONDS


async def check_lock_timeout(
    user: User,
    timeout_seconds: int | None = None
) -> bool:
    """
    检查运行时锁是否超时

    Args:
        user: 用户对象
        timeout_seconds: 超时时间（秒），为 None 时根据 lock_reason 自动选择

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

    # 根据 lock_reason 选择超时时间
    if timeout_seconds is None:
        timeout_seconds = get_timeout_for_reason(user.runtime_lock_reason)

    elapsed = (
        datetime.now(timezone.utc) - user.runtime_locked_at
    ).total_seconds()

    return elapsed > timeout_seconds


async def cleanup_expired_locks(
    user_repo: UserRepository,
    lock_wait_timeout_seconds: int = 300,
    install_timeout_seconds: int = 300,
    skip_installing: bool = True,
) -> list[str]:
    """
    清理超时的运行时锁（定时任务调用）

    Args:
        user_repo: 用户仓库
        lock_wait_timeout_seconds: 等待确认超时时间（秒）
        install_timeout_seconds: 安装超时时间（秒）
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
        # 可选：跳过正在安装的用户（但检查安装超时）
        if skip_installing and user.runtime_lock_reason == "Installing dependencies":
            # 使用安装超时时间判断
            if await check_lock_timeout(user, install_timeout_seconds):
                logger.warning(f"Install timeout for user {user.id}, will cleanup")
                # 继续清理流程
            else:
                logger.debug(f"Skipping installing user {user.id}")
                continue

        # 其他用户使用等待确认超时
        if await check_lock_timeout(user, lock_wait_timeout_seconds):
            # 超时解锁
            user.runtime_locked = False
            user.runtime_lock_reason = None
            user.runtime_locked_at = None

            # 清理临时文件（使用存储的临时目录路径）
            # 临时目录路径在上传加锁时保存到 user.runtime_temp_path
            # 避免路径不一致导致的清理失败（参见 12-security.md 中的临时目录创建逻辑）
            if user.runtime_temp_path:
                temp_upload_path = Path(user.runtime_temp_path)
                if temp_upload_path.exists():
                    shutil.rmtree(temp_upload_path)
                user.runtime_temp_path = None  # 清理后重置

            await user_repo.update(user)

            cleaned.append(user.id)
            logger.info(f"Cleaned expired runtime lock for user {user.id}")

    return cleaned
```

#### 执行前检查逻辑

```python
# 配置值（应从配置文件读取）
LOCK_WAIT_TIMEOUT_SECONDS = 300  # 等待用户确认超时


async def check_runtime_lock(user: User) -> None:
    """
    执行前检查运行时锁状态

    根据 lock_reason 选择对应的超时时间进行判断，
    与 get_timeout_for_reason 保持一致。

    Raises:
        RuntimeErrorLocked: 环境正在更新
    """
    if not user.runtime_locked:
        return

    elapsed_seconds = (
        datetime.now(timezone.utc) - user.runtime_locked_at
    ).total_seconds()

    # 根据 lock_reason 选择对应的超时时间
    timeout_seconds = get_timeout_for_reason(user.runtime_lock_reason)

    # 分段处理
    # 使用 timeout_seconds 的比例来动态计算分段阈值，避免硬编码
    # 设置最小重试间隔（MIN_RETRY_AFTER_SECONDS），避免接近超时时产生过小的 retry_after
    MIN_RETRY_AFTER_SECONDS = 5  # 最小重试间隔，防止频繁重试

    if elapsed_seconds > timeout_seconds:  # 超过对应操作的超时阈值
        # 锁应该已经被清理，建议稍后重试或联系管理员
        retry_after = 30
        suggest_admin = True
    elif elapsed_seconds > timeout_seconds * 0.5:  # 超过超时时间的一半
        # 接近超时，建议较长等待
        # 使用 max() 确保最小重试间隔，避免 elapsed 接近 timeout 时 retry_after 过小
        retry_after = max(MIN_RETRY_AFTER_SECONDS, int(timeout_seconds - elapsed_seconds))
        suggest_admin = True
    else:
        # 正常范围内，按剩余时间估算
        retry_after = max(MIN_RETRY_AFTER_SECONDS, int(timeout_seconds * 0.1))
        suggest_admin = False

    raise RuntimeErrorLockedError(
        reason=user.runtime_lock_reason,
        locked_at=user.runtime_locked_at,
        retry_after=int(retry_after),
        suggest_admin=suggest_admin
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

**导航**： [← 核心流程](./04-core-flows.md) | [返回目录](./00-index.md) | [API 设计 →](./06-api-design.md)