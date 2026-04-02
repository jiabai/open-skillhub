---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
---

## 错误处理

### 错误码定义

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `RUNTIME_LOCKED` | 423 | 运行时环境正在更新（安装依赖），请等待 |
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
| `SCRIPT_SECURITY_HIGH_RISK` | 403 | 脚本包含高风险操作，禁止上传 |
| `SCRIPT_SECURITY_REVIEW` | 409 | 脚本包含中等风险操作，需要用户确认 |
| `SKILL_NOT_FOUND` | 404 | Skill 不存在 |
| `VERSION_NOT_FOUND` | 404 | 版本不存在 |
| `EXECUTION_TIMEOUT` | 504 | Skill 执行超时 |
| `PERMISSION_DENIED` | 403 | 权限不足（非 Skill 所有者） |
| `SNAPSHOT_NOT_FOUND` | 404 | 依赖快照不存在 |
| `DEPENDENCY_RESTORE_FAILED` | 500 | 依赖恢复失败 |

#### RUNTIME_LOCKED 错误响应格式

```json
{
  "error": "RUNTIME_LOCKED",
  "message": "Runtime environment is being updated, please wait",
  "runtime_lock_reason": "Installing dependencies",
  "runtime_locked_at": "2026-03-30T15:30:00Z",
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

当检测到 MEDIUM 级别风险时，返回 HTTP 409 状态码，响应格式如下：

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

> **说明**：此响应与 `06-api-design.md` 中的 `security_review` 状态一致。用户确认后调用 `POST /api/v1/skills/upload/resolve-security` 继续上传。

#### DEPENDENCY_INSTALL_FAILED 错误响应格式

当依赖安装失败时，返回详细错误信息：

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

### 安装失败回滚

```python
async def upload_with_rollback(
    user: User,
    skill: Skill,
    filename: str,
    content: bytes,
    skill_repo: SkillRepository,
    user_repo: UserRepository,
    metadata: dict | None = None,
) -> dict:
    """
    带回滚机制的上传流程

    此函数执行流程图（04-core-flows.md）中的以下步骤：
    - 步骤 3：加锁运行时环境
    - 步骤 5-7：检查/创建虚拟环境、更新使用时间
    - 步骤 8：解析 SKILL.md metadata，设置 script_file 字段
    - 步骤 10b/10d：保存依赖快照（如有冲突解决或预览确认后）
    - 步骤 11：安装新依赖
    - 步骤 14：创建 Skill 版本（解锁前执行，确保一致性）
    - 步骤 15：解锁运行时环境

    以下步骤由上层调用方处理（参见 04-core-flows.md）：
    - 步骤 1-2：ZIP 文件验证和脚本安全扫描
    - 步骤 4：解析依赖声明
    - 步骤 9-10：依赖冲突检测、依赖预览和用户交互确认
    - 步骤 13 中的临时文件清理：上传失败时，上层调用方负责删除临时解压目录和临时 Skill 目录

    函数职责边界：
    - 此函数是"确认后执行"阶段的核心，假定安全扫描已通过、冲突已解决/预览已确认
    - metadata 参数来源于上层调用方在步骤 2（安全扫描）阶段解析的 SKILL.md 内容
    - 函数不负责用户交互（冲突确认、预览确认），仅负责加锁后的实际安装和版本创建

    ⚠️ **调用前置条件**：
    - skill 参数必须是一个已持久化的 Skill 对象（已有 id）
    - 对于新 Skill：调用方应在调用前创建 Skill 记录（步骤 1-2 之间）
    - 对于更新 Skill：调用方应已查询到现有 Skill 记录
    - skill.dependencies 字段应已填充（由上层调用方在步骤 4 解析）

    Args:
        user: 用户对象
        skill: Skill 对象（必须已持久化，包含 id 和 dependencies）
        filename: 文件名
        content: ZIP 文件内容
        metadata: SKILL.md 解析的元数据（来源：上层调用方在步骤 2 解析，
                  包含 script_entry 等配置；若未解析则为 None，使用默认值）
        skill_repo: Skill 仓库
        user_repo: 用户仓库

    Returns:
        上传结果 {"status": "success", "skill_id": str}
    """
    # 1. 加锁运行时环境（对应流程图步骤 3）
    # 注意：安全扫描和依赖解析由上层调用方处理，此函数在确认无冲突后调用
    user.runtime_locked = True
    user.runtime_lock_reason = "Creating virtual environment"  # 初始阶段，后续根据实际操作更新
    user.runtime_locked_at = datetime.now(timezone.utc)
    await user_repo.update(user)

    # 2. 备份当前状态
    backup_dependencies = dict(user.installed_dependencies or {})
    backup_venv_path = user.venv_path
    # 记录本次安装新增的依赖（用于回滚时卸载）
    # 使用 set 避免重试场景下的重复记录，确保每个包名唯一
    newly_installed_packages: set[str] = set()

    try:
        # 3. 检查/创建虚拟环境（对应流程图步骤 5-7）
        if not user.venv_path:
            # 首次上传：创建环境
            venv_path = Path(VENV_STORAGE_PATH) / user.id
            await create_virtualenv(venv_path)
            user.venv_path = str(venv_path)
            user.venv_created_at = datetime.now(timezone.utc)
            user.venv_last_used_at = datetime.now(timezone.utc)
        else:
            # 环境已存在：更新使用时间
            user.venv_last_used_at = datetime.now(timezone.utc)

        # 更新 lock_reason 为当前阶段（对应流程图步骤 8）
        user.runtime_lock_reason = "Parsing skill metadata"
        await user_repo.update(user)

        # 4. 解析 SKILL.md metadata，设置 script_file 字段（对应流程图步骤 8）
        script_entry = metadata.get("script_entry", "main.py") if metadata else "main.py"
        skill.script_file = script_entry

        # 更新 lock_reason 为安装阶段（对应流程图步骤 10b/10d）
        user.runtime_lock_reason = "Installing dependencies"
        await user_repo.update(user)

        # 5. 安装依赖（对应流程图步骤 11）
        # 注意：冲突检测由上层调用方处理，此函数假定依赖已确认
        for dep in skill.dependencies:
            pkg_name, version_spec = parse_requirement(dep)

            # 检查是否已安装
            if pkg_name.lower() in (user.installed_dependencies or {}):
                installed_ver = user.installed_dependencies[pkg_name.lower()]
                if version_satisfies(installed_ver, version_spec):
                    # 已满足要求，跳过
                    continue

            # 安装依赖
            try:
                await install_single_dependency(user.venv_path, dep)
                newly_installed_packages.add(pkg_name.lower())  # 使用小写格式，确保一致性
            except Exception as e:
                raise DependencyInstallError(
                    package=pkg_name,
                    error=str(e),
                    newly_installed_packages=list(newly_installed_packages)
                )

        # 6. 创建版本记录（对应流程图步骤 14）
        # 注意：版本创建在解锁之前执行，确保最终一致性
        try:
            await skill_repo.create_version(skill)
        except Exception as e:
            # 版本创建失败，触发回滚
            raise VersionCreationError(
                error=str(e),
                newly_installed_packages=list(newly_installed_packages)
            )

        # 7. 更新用户记录并解锁（对应流程图步骤 15）
        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        user.installed_dependencies = await get_installed_packages(user.venv_path)
        await user_repo.update(user)

        return {"status": "success", "skill_id": skill.id}

    except DependencyInstallError as e:
        # 安装失败，回滚依赖（先回滚再解锁）
        logger.error(f"Dependency install failed: {e}")

        # 回滚策略：
        # 1. 卸载本次新安装的包
        # 2. 对于升级的包，恢复到备份版本（如果备份中有）
        await _rollback_new_packages(user, e.newly_installed_packages, backup_dependencies)

        # 恢复依赖记录
        user.installed_dependencies = backup_dependencies

        # 最后解锁
        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        await user_repo.update(user)

        raise ValueError(f"Dependency install failed: {e}")

    except VersionCreationError as e:
        # 版本创建失败，回滚依赖并解锁（对应流程图步骤 13）
        logger.error(f"Version creation failed: {e}")

        # 回滚依赖
        await _rollback_new_packages(user, e.newly_installed_packages, backup_dependencies)
        user.installed_dependencies = backup_dependencies

        # 解锁
        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        await user_repo.update(user)

        raise ValueError(f"Version creation failed: {e}")

    except Exception as e:
        # 其他异常，确保解锁
        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        await user_repo.update(user)
        raise


async def _rollback_new_packages(
    user: User,
    newly_installed: list[str],
    backup_dependencies: dict[str, str]
) -> None:
    """
    回滚新安装的依赖

    策略：
    1. 卸载本次新安装的包
    2. 对于已存在但被升级的包，降级回备份版本

    Args:
        user: 用户对象
        newly_installed: 本次新安装的包名列表
        backup_dependencies: 安装前的依赖状态备份
    """
    venv_path = Path(user.venv_path)
    pip_path = await get_pip_path(venv_path)

    # 回滚操作超时时间（秒），避免网络问题导致回滚卡住
    ROLLBACK_TIMEOUT = 120

    for pkg_name in newly_installed:
        pkg_name_lower = pkg_name.lower()

        if pkg_name_lower in backup_dependencies:
            # 包已存在，需要降级到备份版本
            target_version = backup_dependencies[pkg_name_lower]
            logger.info(f"Rolling back {pkg_name} to version {target_version}")

            proc = await asyncio.create_subprocess_exec(
                str(pip_path), "install", f"{pkg_name}=={target_version}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=ROLLBACK_TIMEOUT
                )
            except asyncio.TimeoutError:
                logger.error(f"Rollback timeout for {pkg_name}=={target_version}, killing process")
                proc.kill()
                await proc.wait()  # 进程已被 kill，使用 wait() 等待退出
                raise RuntimeError(f"Rollback timed out for {pkg_name}=={target_version}")
        else:
            # 全新安装的包，直接卸载
            logger.info(f"Uninstalling newly installed package: {pkg_name}")

            proc = await asyncio.create_subprocess_exec(
                str(pip_path), "uninstall", "-y", pkg_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=ROLLBACK_TIMEOUT
                )
            except asyncio.TimeoutError:
                logger.error(f"Rollback timeout for uninstalling {pkg_name}, killing process")
                proc.kill()
                await proc.wait()  # 进程已被 kill，使用 wait() 等待退出
                raise RuntimeError(f"Rollback timed out for uninstalling {pkg_name}")
```


---

**导航**： [← 环境清理策略](./09-cleanup-strategy.md) | [返回目录](./00-index.md) | [实施计划 →](./11-implementation-plan.md)