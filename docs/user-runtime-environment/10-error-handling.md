---
status: draft
ai_read: true
last_updated: 2026-04-03
parent: user-runtime-environment
---

## 错误处理

### 错误码定义

#### 通用错误

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `SKILL_NOT_FOUND` | 404 | Skill 不存在 |
| `VERSION_NOT_FOUND` | 404 | 版本不存在 |
| `PERMISSION_DENIED` | 403 | 权限不足（非 Skill 所有者） |

#### 上传阶段错误

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `SCRIPT_SECURITY_HIGH_RISK` | 403 | 脚本包含高风险操作，禁止上传 |
| `SCRIPT_SECURITY_REVIEW` | 409 | 脚本包含中等风险操作，需要用户确认 |
| `UPLOAD_SESSION_EXPIRED` | 410 | 安全审查等待超时，上传会话已失效，需重新上传 |

#### 部署阶段错误（新增）

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `RUNTIME_NOT_READY` | 400 | Skill 运行环境未部署（install_status != ready） |
| `DEPLOY_NOT_NEEDED` | 400 | Skill 已部署，无需重复部署 |
| `RUNTIME_LOCKED` | 423 | 运行时环境正在被其他操作占用 |
| `RUNTIME_NOT_INITIALIZED` | 400 | 用户运行时环境未初始化 |
| `DEPENDENCY_CONFLICT` | 409 | 依赖版本冲突，需要用户确认 |
| `DEPENDENCY_INSTALL_FAILED` | 500 | 依赖安装失败（通用错误） |
| `DEPENDENCY_NETWORK_ERROR` | 502 | 网络错误，无法连接 PyPI |
| `DEPENDENCY_PACKAGE_NOT_FOUND` | 404 | 包不存在或版本不存在 |
| `DEPENDENCY_VERSION_CONFLICT` | 409 | 版本冲突无法解决 |
| `DEPENDENCY_BUILD_ERROR` | 500 | 编译错误 |
| `DEPENDENCY_DISK_SPACE_ERROR` | 507 | 磁盘空间不足 |
| `DEPENDENCY_PERMISSION_ERROR` | 403 | 无权限安装依赖 |
| `VENV_CREATION_FAILED` | 500 | 虚拟环境创建失败 |
| `RUNTIME_DISK_QUOTA_EXCEEDED` | 507 | 运行时磁盘配额超限 |

#### 执行阶段错误

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `RUNTIME_LOCKED` | 423 | 运行时环境正在部署中，请等待 |
| `RUNTIME_NOT_READY` | 400 | Skill 运行环境未部署 |
| `EXECUTION_TIMEOUT` | 504 | Skill 执行超时 |

#### 版本回滚阶段错误

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `ROLLBACK_NOT_NEEDED` | 400 | 当前已是目标版本，无需回滚 |
| `ROLLBACK_SESSION_EXPIRED` | 410 | 回滚会话超时，需重新发起回滚 |

#### 其他错误

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `SNAPSHOT_NOT_FOUND` | 404 | 依赖快照不存在 |
| `DEPENDENCY_RESTORE_FAILED` | 500 | 依赖恢复失败 |

### 错误响应格式

#### RUNTIME_NOT_READY 错误响应（新增）

```json
{
  "error": "RUNTIME_NOT_READY",
  "message": "Skill runtime environment is not ready",
  "details": {
    "skill_uuid": "xxx-xxx-xxx",
    "install_status": "pending",
    "install_error": null,
    "suggestion": "Please deploy the runtime environment first"
  }
}
```

#### RUNTIME_LOCKED 错误响应

```json
{
  "error": "RUNTIME_LOCKED",
  "message": "Runtime environment is being updated, please wait",
  "runtime_lock_reason": "Deploying dependencies",
  "runtime_locked_at": "2026-03-30T15:30:00Z",
  "retry_after": 30
}
```

#### DEPLOY_NOT_NEEDED 错误响应（新增）

```json
{
  "error": "DEPLOY_NOT_NEEDED",
  "message": "Skill runtime is already deployed and ready",
  "details": {
    "install_status": "ready"
  }
}
```

#### DEPENDENCY_INSTALL_FAILED 错误响应

```json
{
  "error": "DEPENDENCY_INSTALL_FAILED",
  "message": "Failed to install package playwright",
  "details": {
    "failed_package": {
      "name": "playwright",
      "version": "1.40.0",
      "error_type": "DEPENDENCY_NETWORK_ERROR",
      "error_message": "Could not fetch package playwright-1.40.0\nReason: Network timeout after 30s"
    },
    "completed_packages": [
      {"name": "requests", "version": "2.31.0", "status": "success"}
    ],
    "rollback_status": {
      "will_uninstall": ["requests"],
      "message": "Successfully installed packages will be rolled back"
    },
    "retryable": true,
    "suggestions": [
      "检查网络连接是否正常",
      "稍后重新尝试部署"
    ]
  }
}
```

### 部署失败回滚

部署失败时，回滚已安装的依赖包，但不删除 Skill 记录。

```python
async def deploy_with_rollback(
    user: User,
    skill: Skill,
    skill_repo: SkillRepository,
    user_repo: UserRepository,
    snapshot_repo: SnapshotRepository,
) -> dict:
    """
    带回滚机制的部署流程

    调用时机：用户在部署确认接口（deploy/confirm 或 deploy/resolve-conflict）
    中确认后调用。冲突检测、依赖预览等前置步骤由 deploy 触发接口处理，
    此函数仅负责确认后的实际安装过程。

    前置条件（由调用方保证）：
    - 已通过原子加锁获取运行时锁（runtime_locked = True）
    - 已在锁内通过前置条件检查（install_status 为 pending 或 failed）

    流程：
    1. 检查/创建虚拟环境
    2. 保存依赖快照
    3. 安装依赖
    4. 更新 install_status = ready
    5. 解锁

    失败时：
    1. 回滚已安装的依赖
    2. 更新 install_status = failed
    3. 记录 install_error
    4. 解锁
    """
    backup_dependencies = dict(user.installed_dependencies or {})
    newly_installed_packages: set[str] = set()

    try:
        # 前置条件：调用方已原子加锁，此处断言锁状态
        if not user.runtime_locked:
            raise RuntimeError("deploy_with_rollback called without holding runtime lock")

        # 检查/创建 venv
        if not user.venv_path:
            user.runtime_lock_reason = "Creating virtual environment"
            await user_repo.update(user)
            venv_path = Path(VENV_STORAGE_PATH) / user.id
            await create_virtualenv(venv_path)
            user.venv_path = str(venv_path)
            user.venv_created_at = datetime.now(timezone.utc)

        user.venv_last_used_at = datetime.now(timezone.utc)

        # 保存依赖快照
        await save_dependency_snapshot(
            user_id=user.id,
            reason=f"pre_deploy:{skill.name}:v{skill.current_version}",
            dependencies=backup_dependencies,
            snapshot_repo=snapshot_repo,
            is_auto=True,
        )

        # 安装依赖
        user.runtime_lock_reason = "Deploying dependencies"
        await user_repo.update(user)

        for dep in skill.dependencies:
            pkg_name, version_spec = parse_requirement(dep)
            if pkg_name.lower() in (user.installed_dependencies or {}):
                if version_satisfies(user.installed_dependencies[pkg_name.lower()], version_spec):
                    continue
            try:
                await install_single_dependency(user.venv_path, dep)
                newly_installed_packages.add(pkg_name.lower())
            except Exception as e:
                raise DependencyInstallError(package=pkg_name, error=str(e))

        # 部署成功
        skill.install_status = "ready"
        skill.install_error = None
        await skill_repo.update(skill)

        user.installed_dependencies = await get_installed_packages(user.venv_path)
        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        await user_repo.update(user)

        return {"status": "success", "install_status": "ready"}

    except DependencyInstallError as e:
        # 回滚依赖
        await _rollback_new_packages(user, list(newly_installed_packages), backup_dependencies)

        # 回滚后同步 DB 状态，确保 installed_dependencies 与 venv 实际状态一致
        # 避免下次部署时的冲突检测基于过期的 DB 数据
        user.installed_dependencies = await get_installed_packages(user.venv_path)

        skill.install_status = "failed"
        skill.install_error = str(e)
        await skill_repo.update(skill)

        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        await user_repo.update(user)

        return {"status": "failed", "error": str(e), "retryable": True}

    except Exception as e:
        # 未预期的异常，回滚已安装的包并同步 DB 状态
        await _rollback_new_packages(user, list(newly_installed_packages), backup_dependencies)
        try:
            user.installed_dependencies = await get_installed_packages(user.venv_path)
        except Exception:
            logger.warning("Failed to sync installed_dependencies after unexpected error")

        skill.install_status = "failed"
        skill.install_error = str(e)
        await skill_repo.update(skill)

        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        await user_repo.update(user)
        raise
```

async def _rollback_new_packages(
    user: User,
    new_packages: list[str],
    backup_dependencies: dict[str, str],
) -> None:
    """
    回滚本次部署新安装的依赖包

    仅卸载 new_packages 中属于「本次新增」的包（即不在 backup_dependencies 中的包），
    避免误卸载其他 Skill 共用的已有依赖。

    Args:
        user: 用户对象（需要 venv_path）
        new_packages: 本次安装成功的包名列表（小写）
        backup_dependencies: 部署前的依赖快照 {"package": "version"}
    """
    if not new_packages or not user.venv_path:
        return

    pip_path = await get_pip_path(Path(user.venv_path))
    backup_lower = {k.lower() for k in (backup_dependencies or {})}

    for pkg_name in new_packages:
        if pkg_name in backup_lower:
            # 该包在部署前已存在，不是本次新增的，跳过
            continue
        try:
            proc = await asyncio.create_subprocess_exec(
                str(pip_path), "uninstall", "-y", pkg_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                logger.warning(f"Rollback uninstall failed for {pkg_name}: {stderr.decode()}")
        except Exception as e:
            logger.warning(f"Rollback uninstall error for {pkg_name}: {e}")


> **说明**：部署失败不删除 Skill 记录，将 `install_status` 设为 `failed`，用户可以重新触发部署。


---

**导航**： [← 环境清理策略](./09-cleanup-strategy.md) | [返回目录](./00-index.md) | [实施计划 →](./11-implementation-plan.md)
